#!/usr/bin/env bun

// Start the backend Hono server using Bun (which has native TypeScript support)
import { serve } from '@hono/node-server';
import app from './backend/hono';
import { networkInterfaces } from 'os';

const port = process.env.PORT || 3000;

console.log(`[Backend] Starting server on port ${port}...`);

serve({
  fetch: app.fetch,
  port: port,
}, (info) => {
  console.log(`[Backend] Server running at http://localhost:${info.port}`);
  console.log(`[Backend] Network: http://${getLocalIP()}:${info.port}`);
});

function getLocalIP() {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}
