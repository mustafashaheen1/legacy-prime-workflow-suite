import { handle } from '@hono/node-server/vercel';
import app from '../backend/hono.js';

export const config = {
  maxDuration: 10,
};

// WORKAROUND for @hono/node-server/vercel POST body parsing bug
// See: https://github.com/honojs/node-server/issues/84
export default handle(app);
