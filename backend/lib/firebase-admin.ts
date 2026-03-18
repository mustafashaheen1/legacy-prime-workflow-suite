/**
 * Returns a Firebase Admin Messaging instance, lazily initializing the SDK.
 *
 * Uses a dynamic import() so firebase-admin is never loaded at module
 * top-level — this prevents FUNCTION_INVOCATION_FAILED on Vercel when
 * the module is bundled across ESM/CJS directory boundaries.
 *
 * Required env vars (Vercel secrets):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (newlines stored as \n — we unescape here)
 */
export async function getFirebaseMessaging() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = (await import('firebase-admin')).default as typeof import('firebase-admin');

  if (admin.apps.length === 0) {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        '[firebase-admin] Missing credentials — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Vercel env vars'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  return admin.messaging();
}
