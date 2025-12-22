import { handle } from '@hono/node-server/vercel';
import app from '../backend/hono.js';

export const config = {
  maxDuration: 300,
};

export default handle(app);
