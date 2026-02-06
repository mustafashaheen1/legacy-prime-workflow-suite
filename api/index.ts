import { handle } from '@hono/node-server/vercel';
import app from '../backend/hono.js';

export const config = {
  // Vercel Hobby plan limit is 10 seconds
  // To use 60s, upgrade to Vercel Pro: https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration
  maxDuration: 10,
};

export default handle(app as any);
