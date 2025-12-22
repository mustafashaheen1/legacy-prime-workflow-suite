import { handle } from '@hono/node-server/vercel';
import app from '../backend/hono.js';

export const config = {
  runtime: 'nodejs20.x',
  maxDuration: 60,
  regions: ['iad1'],
};

export default handle(app);
