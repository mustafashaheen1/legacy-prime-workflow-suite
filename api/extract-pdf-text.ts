import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure PDF.js worker (same setup as convert-pdf-to-image.ts)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pdfUrl, fileName } = req.body;
  if (!pdfUrl) {
    return res.status(400).json({ error: 'pdfUrl is required' });
  }

  try {
    console.log('[ExtractPdfText] Fetching PDF:', fileName, pdfUrl.substring(0, 60));

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: HTTP ${response.status}`);
    }

    const data = new Uint8Array(await response.arrayBuffer());
    console.log('[ExtractPdfText] PDF size:', data.length, 'bytes');

    const pdf = await (pdfjsLib as any).getDocument({
      data,
      useSystemFonts: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
    }).promise;

    const totalPages: number = pdf.numPages;
    const maxPages = Math.min(totalPages, 25);
    console.log('[ExtractPdfText] Pages:', totalPages, '— extracting', maxPages);

    const pageTexts: string[] = [];
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const text = (textContent.items as any[])
        .filter((item: any) => item.str)
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) {
        pageTexts.push(totalPages > 1 ? `[Page ${p}/${totalPages}]\n${text}` : text);
      }
    }

    if (totalPages > maxPages) {
      pageTexts.push(`[Note: Document has ${totalPages} pages; only first ${maxPages} extracted.]`);
    }

    const extractedText = pageTexts.join('\n\n');
    console.log('[ExtractPdfText] Extracted chars:', extractedText.length);

    return res.status(200).json({
      success: true,
      text: extractedText,
      pages: totalPages,
    });
  } catch (err: any) {
    console.error('[ExtractPdfText] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to extract PDF text' });
  }
}
