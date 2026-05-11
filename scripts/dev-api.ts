/**
 * Local development server for Vercel API routes.
 * Auto-discovers all api/*.ts handlers and runs them through a minimal
 * VercelRequest/VercelResponse shim backed by Node's http module.
 *
 * Usage — two terminals:
 *   Terminal 1:  bun run api:dev
 *   Terminal 2:  bun run start:local
 *
 * Bun loads .env automatically, so RESEND_API_KEY / SUPABASE_SERVICE_ROLE_KEY
 * etc. are all available to handlers with zero extra setup.
 */

import http from 'node:http';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PORT = 3001;

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:19006',
  'http://192.168.20.149:8081',
  'http://192.168.20.149:19006',
  'https://legacy-prime-workflow-suite.vercel.app',
  // ngrok tunnel — update this URL each time ngrok restarts
  process.env.NGROK_URL,
].filter(Boolean) as string[];

// ─── Minimal VercelResponse shim ──────────────────────────────────────────────
// Implements the subset of http.ServerResponse that Vercel handlers use.
function makeVercelRes() {
  let _status = 200;
  const _headers: Record<string, string> = {};
  let _body = '';

  const res = {
    status(code: number) { _status = code; return res; },
    setHeader(key: string, value: string) { _headers[key.toLowerCase()] = value; return res; },
    getHeader(key: string) { return _headers[key.toLowerCase()]; },
    removeHeader(key: string) { delete _headers[key.toLowerCase()]; return res; },
    json(data: unknown) {
      _headers['content-type'] = 'application/json';
      _body = JSON.stringify(data);
      return res;
    },
    send(data: unknown) {
      _body = typeof data === 'string' ? data : JSON.stringify(data);
      return res;
    },
    end(data?: string) {
      if (data !== undefined) _body = data;
      return res;
    },
    // Expose internal state for the server to build the final response
    _get: () => ({ status: _status, headers: _headers, body: _body }),
  };

  return res;
}

type Handler = (req: unknown, res: ReturnType<typeof makeVercelRes>) => Promise<unknown> | unknown;
const routes = new Map<string, Handler>();

// ─── Route auto-discovery ─────────────────────────────────────────────────────
async function loadRoutes(): Promise<void> {
  const apiDir = resolve('api');
  const failed: string[] = [];

  async function scan(dir: string, prefix: string): Promise<void> {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        await scan(full, `${prefix}/${entry}`);
      } else if (entry.endsWith('.ts') && !entry.startsWith('tsconfig')) {
        const routePath = `/api${prefix}/${entry.slice(0, -3)}`;
        try {
          const mod = await import(full);
          if (typeof mod.default === 'function') {
            routes.set(routePath, mod.default as Handler);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
          failed.push(`  ✗  ${routePath}: ${msg}`);
        }
      }
    }
  }

  await scan(apiDir, '');
  console.log(`\n✅  Loaded ${routes.size} API routes`);
  if (failed.length) {
    console.warn(`⚠️   ${failed.length} route(s) skipped (non-fatal):`);
    failed.forEach(f => console.warn(f));
  }
  console.log('');
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const rawUrl = req.url ?? '/';
  const url = new URL(rawUrl, `http://localhost:${PORT}`);
  const origin = (req.headers['origin'] as string) ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const corsHeaders: Record<string, string> = {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, X-Requested-With',
    'access-control-max-age': '86400',
  };

  // Handle CORS preflight — handlers never see OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const pathname = url.pathname;
  const handler = routes.get(pathname);

  if (!handler) {
    res.writeHead(404, { 'content-type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: `No local handler for ${pathname}` }));
    return;
  }

  // Read request body
  let body: unknown = {};
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk as ArrayBuffer));
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    const ct = (req.headers['content-type'] as string) ?? '';
    if (ct.includes('application/json') && raw.trim()) {
      try { body = JSON.parse(raw); } catch { /* empty or malformed body */ }
    } else if (ct.includes('application/x-www-form-urlencoded') && raw.trim()) {
      body = Object.fromEntries(new URLSearchParams(raw).entries());
    }
  }

  // Query string as flat object (matches VercelRequest.query)
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });

  const vercelReq = {
    method: req.method ?? 'GET',
    url: rawUrl,
    headers: req.headers as Record<string, string>,
    body,
    query,
  };

  const vercelRes = makeVercelRes();

  try {
    await handler(vercelReq, vercelRes);
    const { status, headers, body: responseBody } = vercelRes._get();
    res.writeHead(status, { ...corsHeaders, ...headers });
    res.end(responseBody);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${pathname}] Unhandled error:`, msg);
    res.writeHead(500, { 'content-type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: msg }));
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
await loadRoutes();

server.listen(PORT, () => {
  console.log(`🚀  Local API server  →  http://localhost:${PORT}`);
  console.log(`📱  Start frontend    →  bun run start:local`);
  console.log(`🔑  .env loaded automatically by Bun\n`);
});

server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`❌  Port ${PORT} is already in use. Run: lsof -ti:${PORT} | xargs kill -9`);
  } else {
    console.error('Server error:', e.message);
  }
  process.exit(1);
});
