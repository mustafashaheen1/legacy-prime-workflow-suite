import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../backend/trpc/app-router.js';
import { createContext } from '../backend/trpc/create-context.js';

export const config = {
  maxDuration: 30,
};

// Hop-by-hop headers must never be forwarded from the tRPC Fetch Response
// to the Node.js ServerResponse — they're connection-scoped, not content-scoped.
const HOP_BY_HOP = new Set([
  'transfer-encoding', 'connection', 'keep-alive',
  'upgrade', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer',
]);

/**
 * Direct tRPC fetch handler — bypasses @hono/node-server/vercel entirely.
 *
 * Root cause of the original 504:
 *   @hono/node-server/vercel tries to read the raw IncomingMessage stream for the body.
 *   Vercel's Node.js runtime auto-parses JSON bodies into req.body first, consuming the
 *   stream. The adapter finds nothing, hangs, and Vercel kills it after 10 s.
 *
 * Fix: reconstruct a Fetch Request manually from req.body (already parsed by Vercel)
 * and pass it directly to fetchRequestHandler — no Hono involved.
 */
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  try {
    // Build the full URL that fetchRequestHandler needs to route to the correct procedure.
    const host = Array.isArray(req.headers['x-forwarded-host'])
      ? req.headers['x-forwarded-host'][0]
      : (req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost');
    const proto = Array.isArray(req.headers['x-forwarded-proto'])
      ? req.headers['x-forwarded-proto'][0]
      : (req.headers['x-forwarded-proto'] ?? 'https');
    const url = `${proto}://${host}${req.url}`;

    // Forward only the headers that tRPC actually needs.
    // Intentionally omit connection-level headers (host, content-length,
    // transfer-encoding) — they can corrupt the internal Fetch Request.
    const headers = new Headers();
    for (const name of ['authorization', 'content-type', 'accept', 'accept-language', 'x-trpc-source']) {
      const val = req.headers[name];
      if (val) headers.set(name, Array.isArray(val) ? val[0] : val);
    }

    // Reconstruct the body from req.body.
    // Vercel's Node.js runtime auto-parses JSON before the stream is readable,
    // so req.body is the only reliable source for POST/PUT/PATCH bodies.
    let body: BodyInit | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      headers.set('content-type', 'application/json');
    }

    const fetchReq = new Request(url, { method: req.method, headers, body });

    const response = await fetchRequestHandler({
      endpoint: '/trpc',
      req: fetchReq,
      router: appRouter,
      createContext,
      onError({ path, error }) {
        console.error(`[tRPC Error] Path: ${path}`, error.message);
      },
    });

    // Read body before setting status/headers so the stream is fully consumed.
    const responseBody = await response.text();

    res.status(response.status);
    response.headers.forEach((value: string, key: string) => {
      // Skip hop-by-hop headers and let Node.js calculate content-length from the body.
      if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== 'content-length') {
        res.setHeader(key, value);
      }
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('content-length', Buffer.byteLength(responseBody, 'utf-8'));
    res.end(responseBody);

  } catch (err: any) {
    console.error('[tRPC Handler] Fatal crash:', err?.message, err?.stack?.substring(0, 800));
    if (!res.headersSent) {
      res.status(500).json({
        error: [{ message: err?.message ?? 'Internal server error', code: 'INTERNAL_SERVER_ERROR' }],
      });
    }
  }
}
