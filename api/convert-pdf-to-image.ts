import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdfUrl, pdfData, fileName } = req.body;

    if (!pdfUrl && !pdfData) {
      return res.status(400).json({ error: 'No PDF URL or data provided' });
    }

    console.log('[PDF Conversion] Starting conversion...');

    // Get PDF data
    let pdfBuffer: Buffer;

    if (pdfUrl) {
      // Download from URL (S3 or other)
      const response = await fetch(pdfUrl);
      const arrayBuffer = await response.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    } else {
      // Convert base64 to buffer
      const base64Data = pdfData.replace(/^data:.+;base64,/, '');
      pdfBuffer = Buffer.from(base64Data, 'base64');
    }

    console.log('[PDF Conversion] PDF loaded, size:', pdfBuffer.length, 'bytes');

    // Load PDF with PDF.js
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
    });

    const pdf = await loadingTask.promise;
    console.log('[PDF Conversion] PDF has', pdf.numPages, 'pages');

    // Get first page
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x for better quality

    // Create canvas
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // Render PDF page to canvas
    await page.render({
      canvasContext: context as any,
      viewport: viewport,
    }).promise;

    console.log('[PDF Conversion] Rendered to canvas:', viewport.width, 'x', viewport.height);

    // Convert canvas to PNG buffer
    const imageBuffer = canvas.toBuffer('image/png');
    console.log('[PDF Conversion] PNG created, size:', imageBuffer.length, 'bytes');

    // Upload to S3
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

    const timestamp = Date.now();
    const imageFileName = `takeoff-images/${timestamp}-${fileName || 'converted'}.png`;

    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: imageFileName,
      Body: imageBuffer,
      ContentType: 'image/png',
    });

    await s3Client.send(uploadCommand);

    const imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${imageFileName}`;

    console.log('[PDF Conversion] Image uploaded to S3:', imageUrl);

    return res.status(200).json({
      success: true,
      imageUrl,
      originalPages: pdf.numPages,
      convertedPage: 1,
    });
  } catch (error: any) {
    console.error('[PDF Conversion] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to convert PDF to image',
    });
  }
}
