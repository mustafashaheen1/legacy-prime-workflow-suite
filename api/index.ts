import app from '../backend/hono.js';

// Use Vercel's native edge runtime instead of @hono/node-server/vercel
// The node adapter has known issues with POST request body parsing
export const config = {
  runtime: 'edge',
};

export default app.fetch;
