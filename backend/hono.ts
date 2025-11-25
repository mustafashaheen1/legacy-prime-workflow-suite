import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { timeout } from "hono/timeout";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import twilio from "twilio";

const app = new Hono();

try {
  app.use("*", cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }));

  app.use("/trpc/*", timeout(60000));

  app.use(
    "/trpc/*",
    trpcServer({
      endpoint: "/trpc",
      router: appRouter,
      createContext,
      onError({ path, error }) {
        console.error(`[tRPC Error] Path: ${path}`);
        console.error(`[tRPC Error] Message:`, error.message);
        console.error(`[tRPC Error] Stack:`, error.stack?.substring(0, 500));
      },
    })
  );
} catch (error) {
  console.error("[Backend] Failed to initialize middleware:", error);
  throw error;
}

app.get("/", (c) => {
  return c.json({ 
    status: "ok", 
    message: "API is running",
    openai: process.env.OPENAI_API_KEY ? "configured" : "missing",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (c) => {
  return c.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

app.post("/twilio/assistant", async (c) => {
  const body = await c.req.parseBody();
  const { SpeechResult, CallSid, From } = body;

  console.log('[Twilio Webhook] Incoming call:', { CallSid, From, SpeechResult });

  const twiml = new twilio.twiml.VoiceResponse();
  
  if (!SpeechResult || SpeechResult === '') {
    const gather = twiml.gather({
      input: ['speech'],
      action: '/api/twilio/assistant',
      method: 'POST',
      speechTimeout: 'auto',
      timeout: 5,
    });
    
    gather.say(
      { voice: 'alice', language: 'es-MX' },
      'Lo siento, no escuché tu respuesta. ¿Puedes repetir por favor?'
    );
    
    twiml.say(
      { voice: 'alice', language: 'es-MX' },
      'No recibí ninguna respuesta. Por favor, llama de nuevo cuando estés listo. ¡Gracias!'
    );
  } else {
    twiml.say(
      { voice: 'alice', language: 'es-MX' },
      'Gracias por tu información. Hemos registrado tu consulta y un miembro de nuestro equipo te contactará muy pronto. ¡Gracias por llamar!'
    );
  }

  return c.text(twiml.toString(), 200, {
    'Content-Type': 'text/xml',
  });
});

console.log("[Backend] ========================================");
console.log("[Backend] ✓ Hono server initialized successfully");
console.log("[Backend] OpenAI API Key:", process.env.OPENAI_API_KEY ? "✓ Configured" : "✗ Missing");
if (process.env.OPENAI_API_KEY) {
  console.log("[Backend] OpenAI API Key preview:", process.env.OPENAI_API_KEY.substring(0, 10) + "...");
}
console.log("[Backend] Routes registered:");
console.log("[Backend]   - GET  /");
console.log("[Backend]   - POST /trpc/*");
console.log("[Backend]   - POST /twilio/assistant");
console.log("[Backend] ========================================");

export default app;
