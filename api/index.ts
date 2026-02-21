import { handle } from '@hono/node-server/vercel';
import app from '../backend/hono.js';

export const config = {
  maxDuration: 30,
};

// NOTE: This handler works for tRPC GET queries only.
// POST mutations cannot use this path due to the @hono/node-server/vercel body
// parsing bug — Vercel's Node.js runtime consumes the request stream before
// Hono reads it, causing all POST mutations to hang or crash.
//
// Workaround: all write operations use dedicated plain Vercel functions
// (api/add-payment.ts, api/update-project.ts, etc.) that call Supabase directly.
// @ts-ignore - Hono type compatibility with Vercel adapter
export default handle(app);
