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

app.post("/twilio/receptionist", async (c) => {
  try {
    const body = await c.req.parseBody();
    const { SpeechResult, CallSid, From, conversationState } = body;

    console.log('[Twilio Receptionist] Incoming request:', { CallSid, From, SpeechResult: SpeechResult || '(initial)', conversationState: conversationState ? 'present' : 'none' });

    const twiml = new twilio.twiml.VoiceResponse();

    let state: any = {
      step: 0,
      collectedInfo: {
        name: "",
        phone: From as string,
        projectType: "",
        budget: "",
        timeline: "",
        propertyType: "",
      },
      conversationHistory: [],
    };

    if (conversationState && typeof conversationState === 'string') {
      try {
        const decoded = Buffer.from(conversationState, 'base64').toString();
        state = JSON.parse(decoded);
        console.log('[Twilio Receptionist] Restored state:', state);
      } catch (e) {
        console.error('[Twilio Receptionist] Failed to parse state:', e);
      }
    }

    if (state.step === 0 && !SpeechResult) {
      const greeting = "Thank you for calling Legacy Prime Construction. How can I help you today?";
      
      state.conversationHistory.push({
        role: 'assistant',
        content: greeting,
      });
      state.step = 1;

      twiml.say({ voice: 'alice' }, greeting);
      
      const gather = twiml.gather({
        input: ['speech'],
        action: `${process.env.EXPO_PUBLIC_API_URL || ''}/api/twilio/receptionist`,
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US',
        hints: 'kitchen,bathroom,remodel,addition,roofing,thousand,dollars,budget,month,months',
      });

      const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
      (gather as any).parameter({ name: 'conversationState', value: encodedState });

      console.log('[Twilio Receptionist] Sent greeting');
      return c.text(twiml.toString(), 200, {
        'Content-Type': 'text/xml',
      });
    }

    if (SpeechResult) {
      console.log('[Twilio Receptionist] Processing speech:', SpeechResult);
      
      state.conversationHistory.push({
        role: 'user',
        content: SpeechResult,
      });

      const lowerSpeech = (SpeechResult as string).toLowerCase();
      
      if (!state.collectedInfo.name && lowerSpeech.match(/(?:my name is|i'm|this is|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i)) {
        const match = (SpeechResult as string).match(/(?:my name is|i'm|this is|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i);
        if (match && match[1]) {
          state.collectedInfo.name = match[1].trim();
        }
      }

      if (!state.collectedInfo.projectType) {
        if (lowerSpeech.match(/kitchen/)) state.collectedInfo.projectType = "Kitchen Remodel";
        else if (lowerSpeech.match(/bathroom/)) state.collectedInfo.projectType = "Bathroom Remodel";
        else if (lowerSpeech.match(/addition|add|extension|expand/)) state.collectedInfo.projectType = "Addition";
        else if (lowerSpeech.match(/roof|roofing/)) state.collectedInfo.projectType = "Roofing";
      }

      if (!state.collectedInfo.budget && lowerSpeech.match(/\$?\d{1,3}(?:,\d{3})*/)) {
        const match = (SpeechResult as string).match(/\$?\d{1,3}(?:,\d{3})*/);
        if (match) state.collectedInfo.budget = match[0];
      }
    }

    const hasName = state.collectedInfo.name.length > 0;
    const hasProjectType = state.collectedInfo.projectType.length > 0;
    const hasBudget = state.collectedInfo.budget.length > 0;

    console.log('[Twilio Receptionist] Info status:', { hasName, hasProjectType, hasBudget });

    if (hasName && (hasProjectType || hasBudget)) {
      const closingMessage = `Thank you ${state.collectedInfo.name.split(' ')[0]}. We have noted your ${state.collectedInfo.projectType || 'project'} request${state.collectedInfo.budget ? ' with a budget of ' + state.collectedInfo.budget : ''}. A member of our team will call you back within 24 hours.`;
      
      console.log('[Twilio Receptionist] Closing message:', closingMessage);
      console.log('[Twilio Receptionist] ✅ QUALIFIED LEAD:', state.collectedInfo);

      twiml.say({ voice: 'alice' }, closingMessage);
      twiml.pause({ length: 1 });
      twiml.say({ voice: 'alice' }, "Have a great day!");
      twiml.hangup();

      return c.text(twiml.toString(), 200, {
        'Content-Type': 'text/xml',
      });
    }

    let nextResponse = '';
    if (!hasName) {
      nextResponse = "Great! What's your name?";
    } else if (!hasProjectType) {
      nextResponse = "And what type of project are you interested in?";
    } else if (!hasBudget) {
      nextResponse = "What's your budget range for this project?";
    }

    console.log('[Twilio Receptionist] Next response:', nextResponse);

    state.conversationHistory.push({
      role: 'assistant',
      content: nextResponse,
    });
    state.step++;

    twiml.say({ voice: 'alice' }, nextResponse);
    
    const gather = twiml.gather({
      input: ['speech'],
      action: `${process.env.EXPO_PUBLIC_API_URL || ''}/api/twilio/receptionist`,
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US',
      hints: 'kitchen,bathroom,remodel,addition,roofing,thousand,dollars,budget,month,months',
    });

    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
    (gather as any).parameter({ name: 'conversationState', value: encodedState });

    return c.text(twiml.toString(), 200, {
      'Content-Type': 'text/xml',
    });
  } catch (error: any) {
    console.error('[Twilio Receptionist] ERROR:', error);
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'alice' }, 
      "I apologize, but I'm experiencing technical difficulties. Please call back in a few minutes, or leave a message and we'll call you back."
    );
    twiml.hangup();
    
    return c.text(twiml.toString(), 200, {
      'Content-Type': 'text/xml',
    });
  }
});

console.log("[Backend] ========================================");
console.log("[Backend] ✓ Hono server initialized successfully");
console.log("[Backend] ========================================");
console.log("[Backend] Environment Configuration:");
console.log("[Backend]   OpenAI API Key:", process.env.OPENAI_API_KEY ? "✓ Configured" : "✗ Missing");
console.log("[Backend]   Twilio Account SID:", process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID ? "✓ Configured" : "✗ Missing");
console.log("[Backend]   Twilio Auth Token:", process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN ? "✓ Configured" : "✗ Missing");
console.log("[Backend]   Twilio Phone Number:", process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER ? "✓ Configured" : "✗ Missing");
console.log("[Backend]   Stripe Secret Key:", process.env.STRIPE_SECRET_KEY ? "✓ Configured" : "✗ Missing");
console.log("[Backend] ========================================");
console.log("[Backend] Routes registered:");
console.log("[Backend]   - GET  /");
console.log("[Backend]   - GET  /health");
console.log("[Backend]   - POST /trpc/*");
console.log("[Backend]   - POST /twilio/receptionist");
console.log("[Backend] ========================================");

export default app;
