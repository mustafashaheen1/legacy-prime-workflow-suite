import { handle } from '@hono/node-server/vercel';
import app from '../backend/hono.js';

export const config = {
  maxDuration: 60, // Vercel Pro plan maximum
};

export default handle(app as any);
