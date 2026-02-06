export default async function handler(req: Request) {
  console.log('[Simple Test] Function called!');
  console.log('[Simple Test] Method:', req.method);
  console.log('[Simple Test] URL:', req.url);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed', method: req.method }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    console.log('[Simple Test] Body received:', JSON.stringify(body));

    return new Response(JSON.stringify({
      success: true,
      message: 'POST endpoint works!',
      receivedData: body,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Simple Test] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  maxDuration: 10,
};
