import { createSign } from 'crypto';

/**
 * Zero-dependency FCM v1 messaging client.
 * Uses Node.js built-in `crypto` for RS256 JWT signing and native `fetch`
 * for the OAuth2 token exchange + FCM HTTP v1 send call.
 * No npm packages — ncc bundles this trivially.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

export interface FcmMessage {
  token: string;
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
  apns?: {
    headers?: Record<string, string>;
    payload?: { aps?: { badge?: number; sound?: string } };
  };
  android?: {
    priority?: string;
    notification?: { sound?: string; channelId?: string };
  };
}

// Cached access token with expiry
let _cachedToken: string | null = null;
let _tokenExpiresAt: number     = 0;

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeServiceAccountJwt(clientEmail: string, privateKey: string): string {
  const now     = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss:   clientEmail,
    sub:   clientEmail,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  }));
  const sigInput = `${header}.${payload}`;
  const sign     = createSign('RSA-SHA256');
  sign.update(sigInput);
  const sig = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${sigInput}.${sig}`;
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && now < _tokenExpiresAt - 300) {
    return _cachedToken;
  }

  const jwt = makeServiceAccountJwt(clientEmail, privateKey);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[fcm] OAuth2 token exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _cachedToken    = data.access_token;
  _tokenExpiresAt = now + (data.expires_in ?? 3600);
  return _cachedToken;
}

class FcmMessaging {
  private projectId:   string;
  private clientEmail: string;
  private privateKey:  string;

  constructor(projectId: string, clientEmail: string, privateKey: string) {
    this.projectId   = projectId;
    this.clientEmail = clientEmail;
    this.privateKey  = privateKey;
  }

  async send(message: FcmMessage): Promise<string> {
    const accessToken = await getAccessToken(this.clientEmail, this.privateKey);

    const body: Record<string, unknown> = {
      message: {
        token: message.token,
        ...(message.notification && { notification: message.notification }),
        ...(message.data         && { data: message.data }),
        ...(message.apns         && { apns: message.apns }),
        ...(message.android      && {
          android: {
            priority: message.android.priority,
            ...(message.android.notification && {
              notification: {
                sound:      message.android.notification.sound,
                channel_id: message.android.notification.channelId,
              },
            }),
          },
        }),
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as any;
      const fcmCode: string =
        errBody?.error?.details?.find((d: any) =>
          d['@type']?.includes('FcmError')
        )?.errorCode ??
        errBody?.error?.status ??
        'UNKNOWN';
      const err: any = new Error(`[fcm] send failed (${response.status}): ${fcmCode}`);
      err.errorInfo = { code: fcmCode };
      err.code      = fcmCode;
      throw err;
    }

    const result = await response.json() as { name: string };
    return result.name;
  }
}

let _instance: FcmMessaging | null = null;

/**
 * Returns a cached FCM messaging client. Throws if credentials are missing.
 */
export async function getFirebaseMessaging(): Promise<FcmMessaging> {
  if (_instance) return _instance;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[fcm] Missing credentials — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Vercel env vars'
    );
  }

  _instance = new FcmMessaging(projectId, clientEmail, privateKey);
  return _instance;
}
