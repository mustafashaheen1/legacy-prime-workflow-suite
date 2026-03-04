import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createCanvas } from 'canvas';

// pdfjs-dist v3.11.174 only ships CJS files — no .mjs variants exist.
// Use require() to load the legacy CJS build and disable the web worker for Node.js.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js') as typeof import('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc = ''; // disable worker thread — run inline in Node.js

export const config = {
  maxDuration: 30,
};

// Required by pdfjs for server-side rendering without a browser canvas API.
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(_canvasAndContext: { canvas: any; context: any }) {
    // nothing to release
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdfUrl, pdfData, fileName, maxPages = 3 } = req.body;

    if (!pdfUrl && !pdfData) {
      return res.status(400).json({ error: 'No PDF URL or data provided' });
    }

    console.log('[PDF Conversion] Starting conversion, maxPages:', maxPages);

    // Fetch PDF bytes
    let pdfBuffer: Buffer;
    if (pdfUrl) {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`Failed to fetch PDF: HTTP ${response.status}`);
      pdfBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      const base64Data = (pdfData as string).replace(/^data:.+;base64,/, '');
      pdfBuffer = Buffer.from(base64Data, 'base64');
    }

    console.log('[PDF Conversion] PDF loaded, size:', pdfBuffer.length, 'bytes');

    const canvasFactory = new NodeCanvasFactory();

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    console.log('[PDF Conversion] PDF has', totalPages, 'pages');

    const pagesToConvert = Math.min(totalPages, Number(maxPages) || 3);

    // S3 setup
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const bucketName = process.env.AWS_S3_BUCKET;
    if (!bucketName) {
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    const imageUrls: string[] = [];
    const timestamp = Date.now();
    const baseName = (fileName as string || 'pdf').replace(/\.pdf$/i, '');

    for (let pageNum = 1; pageNum <= pagesToConvert; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x for better OCR quality

      const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

      await page.render({
        canvasContext: context as any,
        viewport,
        canvasFactory,
      } as any).promise;

      const imageBuffer = (canvas as any).toBuffer('image/png') as Buffer;
      const imageKey = `takeoff-images/${timestamp}-${baseName}-p${pageNum}.png`;

      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: imageKey,
        Body: imageBuffer,
        ContentType: 'image/png',
      }));

      const imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${imageKey}`;
      imageUrls.push(imageUrl);
      console.log(`[PDF Conversion] Page ${pageNum}/${pagesToConvert} → ${imageKey.slice(-40)}`);
    }

    return res.status(200).json({
      success: true,
      imageUrls,
      originalPages: totalPages,
      convertedPages: pagesToConvert,
    });
  } catch (error: any) {
    console.error('[PDF Conversion] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to convert PDF to image' });
  }
}
