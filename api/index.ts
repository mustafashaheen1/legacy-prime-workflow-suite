import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../backend/trpc/app-router.js';
import { createContext } from '../backend/trpc/create-context.js';

export const config = {
  maxDuration: 30,
};

/**
 * Direct tRPC fetch handler — bypasses @hono/node-server/vercel entirely.
 *
 * Root cause of the 504 bug:
 *   @hono/node-server/vercel converts the Node.js IncomingMessage to a Fetch Request
 *   by reading the raw stream. Vercel's Node.js runtime auto-parses JSON bodies into
 *   req.body BEFORE the handler runs, which consumes the stream. When Hono's adapter
 *   then tries to read the stream for POST bodies, it finds nothing — the request hangs
 *   until the 10s timeout fires.
 *
 * Fix: construct the Fetch Request manually from req.body (already parsed by Vercel)
 * and pass it straight to fetchRequestHandler, skipping Hono completely.
 */
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Reconstruct full URL from Vercel's Node.js request
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers.host as string) || 'localhost';
  const url = `${proto}://${host}${req.url}`;

  // Copy incoming headers into Fetch Headers
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers as Record<string, string | string[]>)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
  }

  // Reconstruct body from req.body — Vercel has already parsed the JSON stream into this.
  // This is the exact fix for the @hono/node-server/vercel POST body bug.
  let body: string | undefined;
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

  res.status(response.status);
  response.headers.forEach((value: string, key: string) => {
    res.setHeader(key, value);
  });
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(await response.text());
}
