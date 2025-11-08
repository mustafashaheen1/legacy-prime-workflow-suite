import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import twilio from "twilio";

const app = new Hono();

app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
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

export default app;
