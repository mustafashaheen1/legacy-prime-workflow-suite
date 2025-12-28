import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { timeout } from "hono/timeout";
import { appRouter } from "./trpc/app-router.js";
import { createContext } from "./trpc/create-context.js";
import twilio from "twilio";
import { supabase } from "./lib/supabase.js";

const app = new Hono();

try {
  // Log all incoming requests
  app.use("*", async (c, next) => {
    const start = Date.now();
    console.log(`[Request] ${c.req.method} ${c.req.url}`);
    await next();
    const duration = Date.now() - start;
    console.log(`[Response] ${c.req.method} ${c.req.url} - ${c.res.status} (${duration}ms)`);
  });

  app.use("*", cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }));

  app.use("/trpc/*", timeout(60000));

  // Debug middleware to see what's happening before tRPC
  app.use("/trpc/*", async (c, next) => {
    console.log(`[tRPC Middleware] Path: ${c.req.path}`);
    console.log(`[tRPC Middleware] Method: ${c.req.method}`);
    console.log(`[tRPC Middleware] Headers:`, Object.fromEntries(c.req.raw.headers.entries()));
    console.log(`[tRPC Middleware] About to call tRPC server...`);
    await next();
    console.log(`[tRPC Middleware] tRPC server responded`);
  });

  app.use(
    "/trpc/*",
    trpcServer({
      endpoint: "/trpc",
      router: appRouter,
      createContext,
      batching: {
        enabled: false, // Disabled to prevent timeout issues
      },
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

app.get("/test-uuid", (c) => {
  try {
    const testUuid = crypto.randomUUID();
    return c.json({
      status: "ok",
      uuid: testUuid,
      crypto_available: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({
      status: "error",
      error: error.message,
      crypto_available: false,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/debug/env", (c) => {
  return c.json({
    status: "ok",
    environment_check: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ? "✓ configured" : "✗ MISSING",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ configured" : "✗ MISSING",
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ? "✓ configured" : "✗ MISSING",
      EXPO_PUBLIC_TWILIO_ACCOUNT_SID: process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID ? "✓ configured" : "✗ MISSING",
      EXPO_PUBLIC_TWILIO_AUTH_TOKEN: process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN ? "✓ configured" : "✗ MISSING",
      EXPO_PUBLIC_TWILIO_PHONE_NUMBER: process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER ? "✓ configured" : "✗ MISSING",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "✓ configured" : "✗ missing (optional)",
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/debug/supabase", async (c) => {
  try {
    console.log('[Debug] Testing Supabase connection...');

    if (!supabase) {
      return c.json({
        status: "error",
        error: "Supabase client not initialized - check environment variables",
        timestamp: new Date().toISOString(),
      });
    }

    const startTime = Date.now();

    // Simple query to test connection
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    const duration = Date.now() - startTime;

    if (error) {
      console.error('[Debug] Supabase test query failed:', error);
      return c.json({
        status: "error",
        error: error.message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[Debug] Supabase connection successful (${duration}ms)`);
    return c.json({
      status: "ok",
      message: "Supabase connection working",
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Debug] Supabase test error:', error);
    return c.json({
      status: "error",
      error: error.message || "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/debug/inspection-videos", async (c) => {
  try {
    console.log('[Debug] Testing inspection_videos table...');

    if (!supabase) {
      return c.json({
        status: "error",
        error: "Supabase client not initialized",
        timestamp: new Date().toISOString(),
      });
    }

    const startTime = Date.now();

    // Test if table exists by querying it
    const { data: tableData, error: tableError } = await supabase
      .from('inspection_videos')
      .select('id')
      .limit(1);

    const queryDuration = Date.now() - startTime;

    if (tableError) {
      return c.json({
        status: "error",
        error: tableError.message,
        duration_ms: queryDuration,
        timestamp: new Date().toISOString(),
      });
    }

    // Now try to insert a test record
    const { data: clients } = await supabase.from('clients').select('id, name').limit(1).single();
    const { data: companies } = await supabase.from('companies').select('id').limit(1).single();

    if (!clients || !companies) {
      return c.json({
        status: "error",
        error: "No test clients or companies found",
        timestamp: new Date().toISOString(),
      });
    }

    const testToken = crypto.randomUUID();
    const testId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const insertStart = Date.now();
    const { data: insertData, error: insertError } = await supabase
      .from('inspection_videos')
      .insert({
        id: testId,
        token: testToken,
        client_id: clients.id,
        company_id: companies.id,
        client_name: clients.name,
        client_email: 'test@example.com',
        status: 'pending',
        notes: 'Debug test insertion',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    const insertDuration = Date.now() - insertStart;

    if (insertError) {
      return c.json({
        status: "error",
        message: "Insert failed",
        error: insertError.message,
        insert_duration_ms: insertDuration,
        timestamp: new Date().toISOString(),
      });
    }

    // Clean up test record
    await supabase.from('inspection_videos').delete().eq('id', testId);

    return c.json({
      status: "ok",
      message: "inspection_videos table working correctly",
      query_duration_ms: queryDuration,
      insert_duration_ms: insertDuration,
      total_duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Debug] inspection_videos test error:', error);
    return c.json({
      status: "error",
      error: error.message || "Unknown error",
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString(),
    });
  }
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

      // Save qualified lead to database
      try {
        if (!supabase) {
          console.warn('[Twilio Receptionist] ⚠️ Supabase not configured - skipping database save');
        } else {
          // First, get the default company (assuming first company for now - you can make this configurable)
          const { data: companies, error: companyError } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single();

          if (!companyError && companies) {
            // Create client in CRM
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert({
                company_id: companies.id,
                name: state.collectedInfo.name,
                email: `${state.collectedInfo.phone}@temporary.com`, // Placeholder email
                phone: state.collectedInfo.phone,
                source: 'Phone Call',
                status: 'Lead',
                last_contacted: 'AI Call - ' + new Date().toLocaleString(),
                last_contact_date: new Date().toISOString(),
                next_follow_up_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
              })
              .select()
              .single();

            if (!clientError && newClient) {
              console.log('[Twilio Receptionist] ✅ Client saved to CRM:', newClient.id);

              // Create call log
              await supabase
                .from('call_logs')
                .insert({
                  company_id: companies.id,
                  call_sid: CallSid as string,
                  from_number: state.collectedInfo.phone,
                  to_number: process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER,
                  direction: 'inbound',
                  status: 'completed',
                  lead_qualified: true,
                  lead_data: {
                    name: state.collectedInfo.name,
                    phone: state.collectedInfo.phone,
                    projectType: state.collectedInfo.projectType,
                    budget: state.collectedInfo.budget,
                    conversationHistory: state.conversationHistory,
                  },
                });

              console.log('[Twilio Receptionist] ✅ Call log saved');
            } else {
              console.error('[Twilio Receptionist] Error saving client:', clientError);
            }
          } else {
            console.error('[Twilio Receptionist] Error fetching company:', companyError);
          }
        }
      } catch (dbError) {
        console.error('[Twilio Receptionist] Database error:', dbError);
      }

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
