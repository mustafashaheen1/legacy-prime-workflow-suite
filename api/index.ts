import app from '../backend/hono.js';

// Use Hono's built-in fetch handler for Vercel Edge/Serverless
export default app.fetch;
