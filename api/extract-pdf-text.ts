import type { VercelRequest, VercelResponse } from '@vercel/node';
import { inflateSync } from 'zlib';

// Pure Node.js PDF text extraction — zero external dependencies.
// Uses only built-in `zlib` + `Buffer`:
//  - pdfjs-dist/legacy/build/pdf.mjs doesn't exist in the installed package
//  - pdf-parse v2 requires @napi-rs/canvas (native binary, wrong platform on Vercel)
// This handles FlateDecode-compressed streams and BT/ET text blocks,
// covering the vast majority of standard text-based PDFs.

export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

// Decode PDF string escape sequences into readable characters
function decodePdfStr(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

// Extract visible text from a single decompressed PDF content stream
function extractTextFromStream(stream: string): string {
  const parts: string[] = [];

  // BT...ET blocks contain all text rendering operations
  const btEtRe = /BT[\s\S]*?ET/g;
  let btMatch: RegExpExecArray | null;
  while ((btMatch = btEtRe.exec(stream)) !== null) {
    const block = btMatch[0];

    // TJ operator: [(string) kerning (string) ...] TJ — most common in modern PDFs
    const tjArrRe = /\[([\s\S]*?)\]\s*TJ/g;
    let m: RegExpExecArray | null;
    while ((m = tjArrRe.exec(block)) !== null) {
      const strItems = m[1].match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) ?? [];
      const text = strItems.map((s: string) => decodePdfStr(s.slice(1, -1))).join('');
      if (text.trim()) parts.push(text);
    }

    // Tj operator: (string) Tj — also common
    const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
    while ((m = tjRe.exec(block)) !== null) {
      const text = decodePdfStr(m[1]);
      if (text.trim()) parts.push(text);
    }

    parts.push(' ');
  }

  return parts.join('');
}

function extractTextFromPdf(data: Buffer): { text: string; pages: number } {
  const content = data.toString('binary');
  const streamTexts: string[] = [];

  // Walk every object stream in the PDF
  const streamRe = /<<([^>]*)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;

  while ((m = streamRe.exec(content)) !== null) {
    const dict = m[1];
    const streamBytes = Buffer.from(m[2], 'binary');

    // Skip image data and cross-reference streams — no text there
    if (/\/Subtype\s*\/Image/.test(dict)) continue;
    if (/\/Type\s*\/XRef/.test(dict)) continue;

    let streamText: string;
    try {
      if (dict.includes('FlateDecode')) {
        streamText = inflateSync(streamBytes).toString('latin1');
      } else {
        streamText = streamBytes.toString('latin1');
      }
    } catch {
      // Stream may be truncated or use a different compression; try raw
      streamText = streamBytes.toString('latin1');
    }

    const text = extractTextFromStream(streamText);
    if (text.trim()) streamTexts.push(text);
  }

  // Count page objects as a simple page number heuristic
  const pageCount = (content.match(/\/Type\s*\/Page(?:[^s]|$)/g) ?? []).length;

  const fullText = streamTexts
    .join('\n')
    .replace(/\s{3,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text: fullText, pages: Math.max(pageCount, 1) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pdfUrl, fileName } = req.body;
  if (!pdfUrl) {
    return res.status(400).json({ error: 'pdfUrl is required' });
  }

  try {
    console.log('[ExtractPdfText] Fetching PDF:', fileName, pdfUrl.substring(0, 80));

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: HTTP ${response.status}`);
    }

    const data = Buffer.from(await response.arrayBuffer());
    console.log('[ExtractPdfText] PDF size:', data.length, 'bytes');

    const { text, pages } = extractTextFromPdf(data);
    console.log('[ExtractPdfText] Extracted chars:', text.length, '— pages:', pages);

    return res.status(200).json({
      success: true,
      text: text || '',
      pages,
    });
  } catch (err: any) {
    console.error('[ExtractPdfText] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to extract PDF text' });
  }
}
