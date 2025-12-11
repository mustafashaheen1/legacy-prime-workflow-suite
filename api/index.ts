import { handle } from '@hono/node-server/vercel';
import app from '../backend/hono.js';

export default handle(app);
