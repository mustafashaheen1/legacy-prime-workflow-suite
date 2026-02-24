import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verificationStore } from '../lib/verification-store.js';

const MAX_ATTEMPTS = 3;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phoneNumber, code } = req.body;
  if (!phoneNumber || !code) {
    return res.status(400).json({ error: 'phoneNumber and code are required' });
  }

  try {
    const stored = verificationStore.get(`verification:${phoneNumber}`);

    if (!stored) {
      return res.status(400).json({ error: 'Verification code not found or expired' });
    }

    if (new Date(stored.expiresAt) < new Date()) {
      verificationStore.delete(`verification:${phoneNumber}`);
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    if (stored.attempts >= MAX_ATTEMPTS) {
      verificationStore.delete(`verification:${phoneNumber}`);
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new code' });
    }

    if (stored.code !== code) {
      stored.attempts += 1;
      verificationStore.set(`verification:${phoneNumber}`, stored);
      return res.status(400).json({ error: `Incorrect code. Attempts remaining: ${MAX_ATTEMPTS - stored.attempts}` });
    }

    verificationStore.delete(`verification:${phoneNumber}`);
    return res.status(200).json({ success: true, phoneNumber, verified: true });
  } catch (error: any) {
    console.error('[API] verify-code error:', error);
    return res.status(500).json({ error: error.message || 'Failed to verify code' });
  }
}
