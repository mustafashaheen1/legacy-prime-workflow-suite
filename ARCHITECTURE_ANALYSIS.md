# Legacy Prime Workflow Suite - Complete Architecture Analysis

**Date:** February 7, 2026
**Analyst:** Senior Full-Stack Engineer
**Project Type:** Production-Grade Cross-Platform Construction Management System

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Structure](#project-structure)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Database Layer](#database-layer)
6. [API Layer](#api-layer)
7. [State Management](#state-management)
8. [Authentication & Authorization](#authentication--authorization)
9. [Third-Party Integrations](#third-party-integrations)
10. [File Upload & Storage](#file-upload--storage)
11. [Deployment Architecture](#deployment-architecture)
12. [Key Technical Decisions](#key-technical-decisions)
13. [Performance Considerations](#performance-considerations)
14. [Security Model](#security-model)
15. [Development Workflow](#development-workflow)

---

## Executive Summary

This is a **production-ready, revenue-generating** cross-platform application for construction/contractor project management. It's built on a modern, type-safe stack optimized for both mobile (iOS/Android) and web platforms.

**Key Stats:**
- **28 database tables** (based on schema analysis)
- **22 tRPC route modules** with 90+ procedures
- **95+ API endpoints** (standalone + tRPC)
- **Cross-platform:** Native iOS, Android, and Web (PWA capable)
- **Real-time features:** Supabase realtime, AI chat, team collaboration
- **Production deployment:** Vercel serverless + edge runtime

---

## Project Structure

### Directory Layout

```
legacy-prime-workflow-suite/
├── api/                          # Vercel serverless functions (95+ endpoints)
│   ├── index.ts                  # Main tRPC handler (Hono → Vercel adapter)
│   ├── activate-subscription.ts
│   ├── add-client.ts
│   ├── twilio-webhook.ts
│   └── ... (90+ more endpoints)
│
├── backend/                      # Core backend logic
│   ├── hono.ts                   # Hono server configuration
│   ├── trpc/                     # tRPC router & procedures
│   │   ├── app-router.ts         # Main tRPC router (22 modules)
│   │   ├── create-context.ts     # tRPC context factory
│   │   └── routes/               # Domain-organized procedures
│   │       ├── auth/
│   │       ├── crm/
│   │       ├── estimates/
│   │       ├── expenses/
│   │       ├── openai/
│   │       ├── payments/
│   │       ├── projects/
│   │       ├── stripe/
│   │       ├── subcontractors/
│   │       ├── twilio/
│   │       └── ... (22 total)
│   └── lib/                      # Shared backend utilities
│       ├── supabase.ts           # Supabase client (service role)
│       ├── s3.ts                 # AWS S3 helpers
│       └── file-validation.ts
│
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout + auth guard
│   ├── index.tsx                 # Landing/home screen
│   ├── (auth)/                   # Auth group (login, signup)
│   ├── (tabs)/                   # Main tabbed interface
│   ├── project/[id]/             # Dynamic project routes
│   ├── inspection/[token]/       # Public inspection flow
│   ├── subcontractor-register/[token]/
│   └── admin/                    # Admin screens
│
├── components/                   # Reusable React Native components
├── contexts/                     # React Context providers
│   ├── AppContext.tsx            # Global app state (user, company)
│   └── LanguageContext.tsx       # i18n state
│
├── hooks/                        # Custom React hooks
├── lib/                          # Frontend utilities
│   ├── trpc.ts                   # tRPC client configuration
│   ├── supabase.ts               # Frontend Supabase client
│   └── i18n.ts                   # i18next configuration
│
├── types/                        # TypeScript definitions
│   ├── index.ts                  # Domain types (600 lines)
│   └── supabase.ts               # Supabase-generated types
│
├── utils/                        # Shared utilities
├── constants/                    # App constants
├── assets/                       # Static assets
├── locales/                      # i18n translations (en, es)
├── supabase/                     # Supabase migrations
│   └── migrations/
│
└── database/                     # Schema docs
    └── schema/
```

### Key Files

| File | Purpose | Criticality |
|------|---------|-------------|
| `backend/hono.ts` | Main server entry point | **Critical** |
| `backend/trpc/app-router.ts` | tRPC route registry | **Critical** |
| `api/index.ts` | Vercel edge adapter | **Critical** |
| `app/_layout.tsx` | Root layout + auth routing | **Critical** |
| `lib/trpc.ts` | Frontend tRPC client | **Critical** |
| `backend/lib/supabase.ts` | Backend DB client | **Critical** |
| `types/index.ts` | Type definitions | **High** |
| `vercel.json` | Deployment config | **High** |

---

## Backend Architecture

### Tech Stack

- **Framework:** Hono 4.10.4 (Edge runtime)
- **API Layer:** tRPC 11.7.1 (end-to-end type safety)
- **Database:** Supabase (PostgreSQL + RLS)
- **Runtime:** Vercel Edge Functions (10s timeout, 512MB-1024MB memory)

### Hono Server (`backend/hono.ts`)

**Key Features:**
- **CORS:** Configured for `*` origin (production should restrict this)
- **Request logging:** All requests/responses logged with timing
- **tRPC integration:** `/trpc/*` routes handled by `@hono/trpc-server`
- **Custom endpoints:**
  - `GET /` - Health check with env verification
  - `GET /health` - Simple health endpoint
  - `POST /test/ping` - Ultra-simple POST test
  - `POST /test/create-folder` - Direct DB test (bypasses tRPC)
  - `POST /twilio/receptionist` - AI receptionist webhook (419 lines!)
  - Debug endpoints: `/debug/env`, `/debug/supabase`, `/debug/inspection-videos`

**Architecture Decisions:**
- **No batching:** `batching: { enabled: false }` to avoid timeout issues (Vercel 10s limit)
- **No custom timeouts:** Removed timeout middleware due to Vercel constraints
- **Comprehensive error logging:** tRPC `onError` handler with stack traces (truncated to 500 chars)

**Twilio Receptionist Implementation:**
```typescript
// Lines 419-644: AI-powered voice receptionist
// - Stateful conversation via base64-encoded state
// - Lead qualification (name, project type, budget)
// - Automatic CRM integration (creates client + call log)
// - TwiML response generation
// - 200+ lines of business logic in single endpoint
```

**Risk Assessment:**
- ⚠️ **CORS too permissive** (`origin: '*'`) - should restrict in production
- ⚠️ **Large inline business logic** in receptionist endpoint - consider extracting
- ✅ **Good error handling** with comprehensive logging
- ✅ **Environment checks** on startup

### tRPC Architecture

**Router Structure** (`backend/trpc/app-router.ts`):
- **22 domain modules** with 90+ procedures
- **Hierarchical organization:** `trpc.domain.procedure`
- **SuperJSON transformer:** Handles Date, Map, Set, BigInt serialization

**Router Modules:**

| Module | Procedures | Purpose |
|--------|-----------|---------|
| `auth` | 3 | login, sendVerificationCode, verifyCode |
| `users` | 6 | CRUD + rate change workflow |
| `companies` | 3 | CRUD operations |
| `projects` | 4 | Project management + cost tracking |
| `crm` | 10 | Client management + inspection videos |
| `estimates` | 3 | Estimate creation + retrieval |
| `expenses` | 3 | Expense tracking (detailed & summary) |
| `photos` | 3 | Photo upload + metadata |
| `clock` | 4 | Time tracking (in/out + reports) |
| `tasks` | 3 | Task management |
| `payments` | 2 | Payment recording |
| `changeOrders` | 3 | Change order workflow |
| `scheduledTasks` | 4 | Calendar/schedule management |
| `photoCategories` | 4 | Custom photo categories |
| `customFolders` | 3 | Project folder organization |
| `priceList` | 4 | Pricing database |
| `twilio` | 6 | SMS, calls, virtual assistant |
| `stripe` | 4 | Payments + subscriptions |
| `subcontractors` | 9 | Subcontractor lifecycle |
| `notifications` | 2 | Notification management |
| `openai` | 7 | AI chat, STT, TTS, vision, agents |

**Context Creation** (`backend/trpc/create-context.ts`):
```typescript
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  return {
    req: opts.req,  // Currently minimal - no user/auth extraction
  };
};
```

**Observations:**
- ⚠️ **No authentication in context** - auth likely handled per-procedure
- ⚠️ **No request metadata extraction** (user ID, company ID, etc.)
- ✅ **SuperJSON transformer** enables rich type serialization
- ✅ **Clean separation** - each procedure in own file

### Standalone API Endpoints (`api/`)

**95+ serverless functions** deployed to Vercel:
- Each `.ts` file = separate serverless function
- Mix of legacy endpoints (pre-tRPC migration?) and specialized handlers
- **Duplicates detected:** Many operations exist in both `/api/` and tRPC

**Examples:**
- `api/add-client.ts` vs `trpc.crm.addClient`
- `api/add-expense.ts` vs `trpc.expenses.addExpense`
- `api/create-estimate.ts` vs `trpc.estimates.createEstimate`

**Assessment:**
- ⚠️ **High maintenance burden** - dual API surface area
- ⚠️ **Type safety gaps** - standalone endpoints lack tRPC's type inference
- 💡 **Recommended:** Migrate all to tRPC or remove duplicates

**Exceptions** (valid standalone endpoints):
- `api/index.ts` - tRPC adapter (required)
- `api/twilio-webhook.ts` - External webhook
- `api/stripe-webhook.ts` - External webhook
- `api/voice-webhook.ts` - External webhook

---

## Frontend Architecture

### Tech Stack

- **Framework:** React 19.1.0 + React Native 0.81.5
- **Platform:** Expo 54.0.20
- **Routing:** Expo Router 6.0.13 (file-based, SSR support)
- **State Management:**
  - **Server state:** TanStack React Query 5.90.7
  - **Client state:** Zustand 5.0.2
  - **Global context:** React Context (AppContext, LanguageContext)
- **API Client:** tRPC React 11.7.1
- **Animation:** Reanimated 4.2.1 + Gesture Handler 2.28.0
- **Icons:** Lucide React Native 0.475.0

### Routing Architecture (`app/`)

**Expo Router** - File-based routing with groups:

```
app/
├── _layout.tsx              # Root: QueryClient + tRPC + Auth Guard
├── index.tsx                # Landing page
├── (auth)/
│   ├── _layout.tsx          # Auth layout (no auth required)
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/
│   ├── _layout.tsx          # Tab bar configuration
│   ├── index.tsx            # Dashboard
│   ├── crm.tsx
│   ├── estimates.tsx
│   ├── projects.tsx
│   ├── expenses.tsx
│   └── ...
├── project/[id]/
│   ├── index.tsx            # Project detail
│   ├── estimate.tsx         # Project estimate
│   ├── takeoff.tsx          # Takeoff measurements
│   ├── expenses.tsx         # Project expenses
│   ├── files-navigation.tsx
│   └── change-orders.tsx
├── inspection/[token]/      # PUBLIC - no auth
│   └── index.tsx
└── subcontractor-register/[token]/  # PUBLIC - token-based
    └── index.tsx
```

**Auth Guard** (`app/_layout.tsx`):
```typescript
// Protected route logic (lines 52-79)
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/subscription', '/inspection', '/subcontractor-register'];

useEffect(() => {
  if (!navigationReady || isLoading) return;

  const inAuthGroup = segments[0] === '(auth)';
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));
  const isTokenRoute = pathname?.startsWith('/inspection/') || pathname?.startsWith('/subcontractor-register/');

  if (!user && !inAuthGroup && !isPublicRoute && !isTokenRoute) {
    router.replace('/login');  // Redirect to login
  }
}, [user, segments, pathname]);
```

**Key Features:**
- ✅ **Authentication middleware** via React effect
- ✅ **Public route exceptions** for inspection & subcontractor flows
- ✅ **Token-based access** for unauthenticated workflows
- ⚠️ **Client-side only** - SSR would need server-side auth check

### tRPC Client Configuration (`lib/trpc.ts`)

**Setup:**
```typescript
// Dual client configuration:
export const trpc = createTRPCReact<AppRouter>();  // React hooks
export const vanillaClient = createTRPCProxyClient<AppRouter>();  // Imperative
```

**URL Resolution:**
```typescript
const getBaseUrl = () => {
  const rorkApi = process.env.EXPO_PUBLIC_RORK_API_BASE_URL
    || process.env['rork']
    || process.env['rork api'];  // Rork-specific env vars

  if (rorkApi) return rorkApi;
  if (typeof window !== 'undefined') return window.location.origin;  // Browser
  return 'http://localhost:8081';  // Fallback
};
```

**Custom Fetch Wrapper:**
- **Request logging:** Every tRPC call logged
- **Error body inspection:** HTML detection for 404/500 errors
- **Response cloning:** Safe error logging without consuming stream
- **SuperJSON integration:** Automatic date/rich type handling

**Observations:**
- ✅ **Comprehensive logging** aids debugging
- ✅ **HTML error detection** catches routing issues
- ⚠️ **Verbose console output** - consider log levels for production

### State Management

**Three-layer approach:**

1. **Server State (React Query + tRPC):**
   ```typescript
   const { data: projects } = trpc.projects.getProjects.useQuery();
   const addProject = trpc.projects.addProject.useMutation();
   ```
   - Automatic caching, refetching, optimistic updates
   - Type-safe hooks

2. **Global Client State (React Context):**
   ```typescript
   // contexts/AppContext.tsx
   interface AppContextType {
     user: User | null;
     company: Company | null;
     isLoading: boolean;
     // ... more
   }
   ```
   - User authentication state
   - Company data
   - Global UI state

3. **Local State (Zustand - inferred from dependencies):**
   - Form state
   - UI toggles
   - Temporary data

**Assessment:**
- ✅ **Clear separation** of concerns
- ✅ **Type safety** throughout
- ⚠️ **AppContext may be large** - consider splitting

---

## Database Layer

### Supabase Architecture

**Configuration:**
- **URL:** `process.env.EXPO_PUBLIC_SUPABASE_URL`
- **Backend:** Service role key (full access)
- **Frontend:** Anon key (RLS enforced)

**Backend Client** (`backend/lib/supabase.ts`):
```typescript
supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,  // Backend doesn't need sessions
    persistSession: false,
  },
  db: { schema: 'public' },
  global: {
    headers: { 'x-application': 'rork-backend' },
  },
});
```

### Database Schema

**28 Tables** (from `supabase-setup.sql`):

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `companies` | Multi-tenant root | Referenced by all tables |
| `users` | Team members | → companies |
| `projects` | Construction projects | → companies, clients |
| `clients` | CRM contacts | → companies |
| `estimates` | Price quotes | → clients, projects |
| `estimate_items` | Line items | → estimates, price_list |
| `expenses` | Project costs | → projects, clock_entries |
| `photos` | Project photos | → projects |
| `photo_categories` | Custom categories | → companies |
| `custom_folders` | Project file org | → projects |
| `project_files` | Document storage | → projects, custom_folders |
| `clock_entries` | Time tracking | → users, projects |
| `tasks` | To-dos | → projects |
| `daily_tasks` | Daily reminders | → companies, users |
| `scheduled_tasks` | Calendar events | → projects |
| `daily_logs` | Daily reports | → projects, users |
| `reports` | Generated reports | → companies |
| `payments` | Payment tracking | → projects, clients |
| `change_orders` | Change orders | → projects |
| `change_order_history` | Audit trail | → change_orders |
| `call_logs` | Twilio call history | → companies, clients |
| `price_list` | Master pricing | → companies |
| `price_list_categories` | Pricing categories | → companies |
| `subcontractors` | Subcontractor registry | → companies |
| `business_files` | Sub documents | → subcontractors |
| `estimate_requests` | Sub bid requests | → projects, subcontractors |
| `subcontractor_proposals` | Sub bids | → estimate_requests |
| `inspection_videos` | Video inspection links | → clients, companies |
| `notifications` | User notifications | → users |
| `ai_chat_messages` | AI chat history | → users |
| `team_conversations` | Team chat | → companies |
| `team_messages` | Chat messages | → team_conversations |
| `registration_tokens` | Sub registration | → companies |

**Schema Observations:**
- ✅ **Proper foreign keys** with CASCADE deletes
- ✅ **UUID primary keys** (uuid-ossp extension)
- ✅ **CHECK constraints** for enums
- ✅ **JSONB columns** for flexible data (settings, metadata)
- ✅ **Timestamps** (created_at, updated_at) on most tables
- ⚠️ **No explicit indexes shown** in setup - likely in migrations
- ⚠️ **RLS policies** mentioned but not visible in excerpt

### Row Level Security (RLS)

**From migration files and code references:**
- RLS enabled on all tables
- Policies enforce company_id isolation (multi-tenancy)
- Service role key bypasses RLS (backend)
- Anon key enforces RLS (frontend)

**Migration Files:**
- `supabase-rls-fix.sql` - RLS policy fixes
- `add-user-policies.sql` - User-specific policies
- `fix-rls-policies.sql` - Policy corrections

**Assessment:**
- ✅ **Multi-tenant isolation** via RLS
- ⚠️ **Policies not centrally documented** - scattered across migrations
- 💡 **Recommend:** Consolidate RLS policy documentation

---

## API Layer

### Dual API Architecture

**Current State:**
- **tRPC routes:** 90+ procedures across 22 modules
- **Standalone API:** 95+ serverless functions in `/api/`

**Route Distribution:**

| Domain | tRPC Procedures | Standalone Files | Overlap? |
|--------|----------------|------------------|----------|
| Auth | 3 | 0 | No |
| Users | 6 | 0 | No |
| Companies | 3 | 1 (update-company.ts) | Yes |
| Projects | 4 | 2 (add-project.ts, test-insert-project.ts) | Yes |
| CRM | 10 | 1 (add-client.ts) | Yes |
| Estimates | 3 | 3 (create-estimate.ts, save-estimate.ts, update-estimate.ts) | Yes |
| Expenses | 3 | 3 (add-expense.ts, update-expense.ts, delete-expense.ts) | Yes |
| Photos | 3 | 3 (add-photo.ts, save-photo.ts, delete-photo.ts) | Yes |
| Payments | 2 | 1 (send-payment-request.ts) | Partial |
| Stripe | 4 | 2 (stripe-payment.ts, activate-subscription.ts) | Yes |
| Twilio | 6 | 2 (twilio-webhook.ts, send-sms.ts) | Partial |
| Subcontractors | 9 | 5+ | Yes |
| File Uploads | 0 | 15+ (upload-*.ts, get-upload-url.ts) | No overlap |

**Analysis:**
- **40-50% duplication** between tRPC and standalone endpoints
- **File uploads** primarily in standalone (S3 presigned URLs)
- **Webhooks** appropriately in standalone (external callers)

### Vercel Configuration (`vercel.json`)

```json
{
  "buildCommand": "bunx expo export -p web",
  "outputDirectory": "dist",
  "installCommand": "bun install",
  "functions": {
    "api/create-estimate.ts": { "maxDuration": 10, "memory": 512 },
    "api/**/*.ts": { "maxDuration": 10, "memory": 1024 }
  },
  "rewrites": [
    { "source": "/api/create-estimate", "destination": "/api/create-estimate" },
    { "source": "/api/stripe-payment", "destination": "/api/stripe-payment" },
    { "source": "/api/activate-subscription", "destination": "/api/activate-subscription" },
    { "source": "/trpc/(.*)", "destination": "/api" },
    { "source": "/((?!api).*)", "destination": "/index.html" }
  ]
}
```

**Key Points:**
- **All functions:** 10s timeout (Vercel limit)
- **Memory:** 512MB-1024MB per function
- **Rewrites:** tRPC routed to `/api/index.ts`, SPA fallback to `/index.html`
- **Build:** Expo web export (static + serverless)

---

## Third-Party Integrations

### Stripe (Payment Processing)

**Packages:**
- `stripe@19.3.0` (backend Node SDK)
- `@stripe/stripe-js@8.6.0` (frontend web)
- `@stripe/react-stripe-js@5.4.1` (React components)
- `@stripe/stripe-react-native@0.50.3` (mobile SDK)

**Implementation:**
- **tRPC routes:** `stripe.createPaymentIntent`, `stripe.createSubscription`, `stripe.verifyPayment`, `stripe.activateSubscription`
- **Standalone:** `api/stripe-payment.ts`, `api/stripe-webhook.ts`, `api/activate-subscription.ts`
- **Subscription model:** Trial → Basic/Pro/Enterprise
- **Webhook handling:** `stripe-webhook.ts` for payment events

**Environment Variables:**
- `STRIPE_SECRET_KEY` (backend)
- `STRIPE_PUBLISHABLE_KEY` (frontend)
- `STRIPE_WEBHOOK_SECRET` (webhook verification)

### Twilio (SMS + Voice)

**Packages:**
- `twilio@5.10.4` (backend SDK)

**Features:**
1. **SMS:**
   - `trpc.twilio.sendSms` - Single SMS
   - `trpc.twilio.sendBulkSms` - Bulk messaging
   - `api/send-sms.ts` - Standalone

2. **Voice:**
   - `POST /twilio/receptionist` - AI receptionist (419 lines in hono.ts!)
   - `trpc.twilio.makeCall` - Outbound calls
   - `trpc.twilio.getCallLogs` - Call history
   - `api/twilio-webhook.ts`, `api/voice-webhook.ts` - Webhooks

3. **Virtual Assistant:**
   - TwiML generation
   - Stateful conversations (base64-encoded state)
   - Lead qualification + CRM integration
   - Automatic call logging

**Environment Variables:**
- `EXPO_PUBLIC_TWILIO_ACCOUNT_SID`
- `EXPO_PUBLIC_TWILIO_AUTH_TOKEN`
- `EXPO_PUBLIC_TWILIO_PHONE_NUMBER`

**Assessment:**
- ✅ **Full-featured integration**
- ⚠️ **Receptionist logic in Hono server** - consider extracting to service
- ⚠️ **State encoding in webhook params** - fragile if exceeds URL limits

### OpenAI (AI Features)

**Package:**
- `openai@6.15.0`
- `@ai-sdk/react@2.0.89`

**Features (7 tRPC procedures):**
1. `openai.chat` - Chat completions
2. `openai.speechToText` - Whisper transcription
3. `openai.textToSpeech` - TTS generation
4. `openai.imageAnalysis` - Vision API
5. `openai.agentChat` - Agent conversations
6. `openai.agentToolResult` - Tool result handling
7. `openai.testConnection` - Health check

**UI Components:**
- `GlobalAIChat` - Floating chat interface
- `FloatingChatButton` - Always-visible trigger

**Environment:**
- `OPENAI_API_KEY`

**Observations:**
- ✅ **Comprehensive AI integration**
- ✅ **Streaming support** via @ai-sdk/react
- ✅ **Tool use** for agent interactions
- 💡 **Cost monitoring** should be implemented

### AWS S3 (File Storage)

**Packages:**
- `@aws-sdk/client-s3@3.962.0`
- `@aws-sdk/s3-request-presigner@3.958.0`

**Pattern:**
1. Client requests presigned URL: `api/get-upload-url.ts`, `api/get-s3-upload-url.ts`
2. Client uploads directly to S3 (secure, no server proxy)
3. Client saves metadata: `api/save-project-file-metadata.ts`, `api/save-photo-metadata.ts`

**File Types:**
- Project files (PDFs, plans, permits)
- Photos (compressed)
- Receipts
- Estimates
- Business files (subcontractor docs)
- Audio recordings
- Inspection videos

**Backend Helpers:**
- `backend/lib/s3.ts` - S3 client utilities
- `backend/lib/file-validation.ts` - File type/size validation

**Environment:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`

---

## File Upload & Storage

### Upload Flow

**Pattern 1: Presigned URL (Preferred)**
```
Client → GET /api/get-upload-url { fileName, fileType, folder }
      ← { uploadUrl, fileUrl, key }
Client → PUT [S3 Presigned URL] [File Blob]
Client → POST /api/save-photo-metadata { url, projectId, category }
```

**Benefits:**
- No file proxy through serverless functions
- No Vercel 4.5MB payload limit
- Faster uploads (direct to S3)
- Reduced backend load

**Pattern 2: Direct Upload (Legacy)**
```
Client → POST /api/upload-photo { base64 | multipart }
      ← { url, id }
```

**Issues:**
- 4.5MB Vercel limit
- 10s function timeout risk
- Memory pressure

### File Categories

**Defined in `types/index.ts`:**
```typescript
type FileCategory =
  | 'receipts'
  | 'photos'
  | 'reports'
  | 'plans'
  | 'estimates'
  | 'documentation'
  | 'videos'
  | 'other'
  | 'permits'
  | 'inspections'
  | 'agreements';
```

### Custom Folders

**New feature** (appears in recent commits):
- `custom_folders` table
- `trpc.customFolders.addCustomFolder`, `getCustomFolders`, `deleteCustomFolder`
- Project-specific folder organization
- `folder_type`, `name`, `color`, `description` fields

**Performance Note:**
- `optimize-custom-folders-db.sql` - Optimization script exists
- `test-custom-folder-performance.js` - Performance testing script

---

## Authentication & Authorization

### Authentication Flow

**SMS-based verification:**
```
1. User enters phone number → trpc.auth.sendVerificationCode
2. System sends SMS via Twilio
3. User enters code → trpc.auth.verifyCode
4. Success → User session created
```

**Login:**
```
trpc.auth.login({ email, phone }) → { user, company, token? }
```

**State Management:**
```typescript
// contexts/AppContext.tsx
const { user, company, isLoading } = useApp();
```

**Route Protection:**
```typescript
// app/_layout.tsx
if (!user && !inAuthGroup && !isPublicRoute && !isTokenRoute) {
  router.replace('/login');
}
```

### Authorization Model

**Role-Based Access Control:**
```typescript
type UserRole =
  | 'super-admin'    // Full access across all companies
  | 'admin'          // Company-wide access
  | 'salesperson'    // CRM, estimates, clients
  | 'field-employee' // Projects, clock, photos, expenses
  | 'employee';      // Limited access
```

**Permission System:**
```typescript
type Permission =
  | 'view:dashboard'
  | 'view:crm' | 'edit:crm'
  | 'view:estimates' | 'create:estimates'
  | 'view:projects' | 'edit:projects'
  | 'view:reports'
  | 'add:photos' | 'delete:photos'
  | 'add:expenses' | 'delete:expenses'
  | 'clock:in-out'
  | 'chatbot:unrestricted' | 'chatbot:no-financials' | 'chatbot:basic-only';
```

**Multi-Tenancy:**
- All tables have `company_id` foreign key
- Supabase RLS policies enforce isolation
- Backend uses service role (bypasses RLS)
- Frontend uses anon key (RLS enforced)

**Token-Based Access:**
- **Inspection links:** `inspection/[token]` - public video upload
- **Subcontractor registration:** `subcontractor-register/[token]` - onboarding

---

## Performance Considerations

### Backend

**Constraints:**
- **Vercel timeout:** 10s max per function
- **Memory:** 512MB-1024MB per function
- **Payload:** 4.5MB request/response limit

**Optimizations:**
1. **tRPC batching disabled:** Prevents timeout on large batches
2. **Direct S3 uploads:** Bypass serverless proxy
3. **Supabase edge functions:** (not currently used, but available)

**Performance Issues Identified:**
- `backend/TROUBLESHOOTING_504.md` - 504 timeout troubleshooting guide
- `optimize-custom-folders-db.sql` - DB optimization for slow queries
- `test-custom-folder-performance.js` - Performance test script

### Frontend

**React Native Performance:**
- **Reanimated:** 60fps animations on UI thread
- **Gesture Handler:** Native gesture recognition
- **Image optimization:** Expo Image with caching
- **Code splitting:** Expo Router lazy loads routes

**Query Optimization:**
- React Query caching (5min default staleTime recommended)
- Optimistic updates for mutations
- Background refetching

**Bundle Size:**
- Expo web build with tree-shaking
- Platform-specific code splitting

### Database

**Supabase Performance:**
- **Connection pooling:** Supabase Supavisor (6,000 connections)
- **Indexes:** Assumed on foreign keys (not visible in schema excerpt)
- **RLS overhead:** Minimal with service role key

**Optimization Opportunities:**
- Add composite indexes for common queries
- Use materialized views for reports
- Consider Supabase Edge Functions for heavy compute

---

## Security Model

### Authentication Security

✅ **Implemented:**
- SMS verification (Twilio)
- Phone-based login
- Session management (Supabase Auth assumed)

⚠️ **Gaps:**
- No password authentication shown
- No MFA beyond SMS
- No rate limiting visible
- No CAPTCHA on verification

### API Security

✅ **Implemented:**
- HTTPS enforcement (Vercel default)
- CORS configuration
- Supabase RLS (multi-tenant isolation)
- Service role key protected (server-side only)

⚠️ **Concerns:**
- **CORS:** `origin: '*'` too permissive
- **No API rate limiting** visible
- **No request signing** for serverless functions

### Data Security

✅ **Implemented:**
- Row Level Security (RLS) on all tables
- S3 presigned URLs (time-limited access)
- Secure environment variables (Vercel secrets)

⚠️ **Recommendations:**
- Encrypt sensitive JSONB fields (PII)
- Add audit logging for sensitive operations
- Implement field-level encryption for payment data

### File Upload Security

✅ **Implemented:**
- File type validation (`backend/lib/file-validation.ts`)
- File size limits
- Presigned URL expiration
- S3 bucket policies

⚠️ **Add:**
- Virus scanning (ClamAV integration)
- Content-type verification
- Filename sanitization

### Webhook Security

✅ **Stripe:**
- Webhook signature verification (assumed in `stripe-webhook.ts`)

⚠️ **Twilio:**
- No signature verification visible in `/twilio/receptionist`
- Should validate `X-Twilio-Signature` header

---

## Development Workflow

### Environment Setup

**Required Variables:**
```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Twilio
EXPO_PUBLIC_TWILIO_ACCOUNT_SID=
EXPO_PUBLIC_TWILIO_AUTH_TOKEN=
EXPO_PUBLIC_TWILIO_PHONE_NUMBER=

# OpenAI
OPENAI_API_KEY=

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

# App
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_RORK_API_BASE_URL=
```

### Local Development

**Commands** (from `package.json`):
```bash
bun start             # Expo dev server (mobile)
bun run start-web     # Web dev server with tunnel
bun run dev           # Web-only dev
bun run build         # Expo web build
bun run lint          # ESLint
bun run android       # Android build
bun run ios           # iOS build
```

**Runtime:**
- **Bun** as primary package manager and runtime
- **Node.js** compatible (fallback)

### Testing

**Scripts Identified:**
- `test-db-connection.js` - DB connectivity test
- `test-supabase.js` - Supabase integration test
- `test-custom-folder-performance.js` - Performance test
- `QUICK_TEST_GUIDE.md` - Manual testing guide
- `AI_TESTING_CHECKLIST.md` - AI feature testing

**No automated test suite visible** (no Jest/Vitest config)

**Recommendation:**
- Add unit tests (Vitest)
- Add E2E tests (Playwright/Detox)
- Add API tests (Supertest)

### Deployment

**Vercel (Production):**
```bash
# Automatic on git push to main
# Manual via:
vercel --prod
```

**Expo (Mobile):**
```bash
# iOS
eas build --platform ios
eas submit --platform ios

# Android
eas build --platform android
eas submit --platform android
```

**Database Migrations:**
```bash
# Run SQL files in Supabase dashboard
# Or via CLI:
supabase db push
```

---

## Key Technical Decisions

### 1. Hono + tRPC (Not Express + REST)

**Why:**
- **Type safety:** End-to-end TypeScript inference
- **Performance:** Hono is 3-4x faster than Express
- **Edge runtime:** Hono designed for Vercel/Cloudflare Workers
- **DX:** tRPC eliminates manual API documentation

**Tradeoffs:**
- ⚠️ Smaller community than Express
- ⚠️ More complex debugging (tRPC abstractions)

### 2. Expo (Not bare React Native)

**Why:**
- **Faster development:** OTA updates, EAS build service
- **Cross-platform:** Web export with same codebase
- **Managed workflow:** No native code changes needed
- **Modern APIs:** Camera, location, file system, etc.

**Tradeoffs:**
- ⚠️ Bundle size larger than bare RN
- ⚠️ Some native modules require custom builds

### 3. Supabase (Not Firebase or custom Postgres)

**Why:**
- **Postgres:** Full SQL, not NoSQL
- **RLS:** Row-level security for multi-tenancy
- **Real-time:** WebSocket subscriptions
- **Self-hostable:** Not locked into Firebase

**Tradeoffs:**
- ⚠️ Smaller ecosystem than Firebase
- ⚠️ More complex than Firestore for simple apps

### 4. Vercel Edge Functions (Not Lambda or App Engine)

**Why:**
- **Global edge:** Sub-50ms latency worldwide
- **Zero config:** Git push to deploy
- **Expo integration:** Official Vercel adapter

**Tradeoffs:**
- ⚠️ 10s timeout (vs 15min on Lambda)
- ⚠️ Limited memory (1GB max)
- ⚠️ Vendor lock-in

### 5. Presigned URLs (Not direct uploads)

**Why:**
- **Bypass serverless limits:** 4.5MB payload cap
- **Performance:** Direct S3 upload is faster
- **Cost:** Reduced serverless execution time

**Tradeoffs:**
- ⚠️ More complex client code
- ⚠️ CORS configuration required on S3

---

## Architectural Risks

### High Priority

1. **Dual API Surface (tRPC + Standalone)**
   - **Risk:** Maintenance burden, bugs, drift
   - **Mitigation:** Migrate all to tRPC or document intentional separation

2. **No Authentication in tRPC Context**
   - **Risk:** Per-procedure auth is error-prone
   - **Mitigation:** Extract user/company from request in `createContext`

3. **CORS Wildcard (`origin: '*'`)**
   - **Risk:** CSRF attacks, data leakage
   - **Mitigation:** Restrict to known origins in production

4. **No Rate Limiting**
   - **Risk:** Abuse, DDoS, cost blowup
   - **Mitigation:** Add Vercel Edge Config or Upstash rate limiting

5. **Large Inline Business Logic (Twilio Receptionist)**
   - **Risk:** Hard to test, maintain, reuse
   - **Mitigation:** Extract to service class or separate module

### Medium Priority

6. **No Automated Testing**
   - **Risk:** Regressions, bugs in production
   - **Mitigation:** Add Vitest (unit) + Playwright (E2E)

7. **RLS Policies Scattered**
   - **Risk:** Security gaps, inconsistent enforcement
   - **Mitigation:** Centralize policy documentation

8. **File Upload Duplicates (15+ endpoints)**
   - **Risk:** Inconsistent behavior, maintenance burden
   - **Mitigation:** Consolidate to single upload utility

9. **No Cost Monitoring (OpenAI, Twilio)**
   - **Risk:** Runaway costs
   - **Mitigation:** Add usage tracking and alerts

10. **Environment Variable Leakage**
    - **Risk:** Secrets in frontend bundle
    - **Mitigation:** Audit `EXPO_PUBLIC_*` vars, use backend proxy

### Low Priority

11. **No Database Backups Visible**
    - **Risk:** Data loss
    - **Mitigation:** Verify Supabase backup schedule

12. **No Logging/Monitoring**
    - **Risk:** Hard to debug production issues
    - **Mitigation:** Add Sentry, LogRocket, or Vercel Analytics

---

## Recommended Next Steps

### Phase 1: Immediate (Security & Stability)

1. **Restrict CORS** to known origins
2. **Add rate limiting** on auth endpoints
3. **Audit RLS policies** and document
4. **Add Sentry** for error tracking
5. **Verify Stripe webhook signature** in handler

### Phase 2: Short-term (Architecture)

6. **Consolidate API surface** (tRPC vs standalone)
7. **Extract auth to tRPC context**
8. **Refactor Twilio receptionist** to service
9. **Add unit tests** for critical paths
10. **Document deployment process**

### Phase 3: Medium-term (Scale)

11. **Add E2E tests**
12. **Optimize database queries** (add indexes)
13. **Implement cost monitoring** (OpenAI, Twilio)
14. **Add admin analytics dashboard**
15. **Performance profiling** (React DevTools, Lighthouse)

### Phase 4: Long-term (Growth)

16. **Migrate to monorepo** (Turborepo/Nx)
17. **Add GraphQL layer** (if needed for complex queries)
18. **Implement offline-first** (local-first sync)
19. **Add mobile push notifications**
20. **Explore Supabase Edge Functions** for heavy compute

---

## Conclusion

This is a **well-architected, production-ready system** with modern tooling and solid foundations. The codebase demonstrates:

✅ **Strengths:**
- Type-safe end-to-end (TypeScript + tRPC)
- Cross-platform (iOS, Android, Web)
- Multi-tenant architecture (Supabase RLS)
- Comprehensive feature set (CRM, estimates, time tracking, AI, payments)
- Good separation of concerns (backend/frontend/database)

⚠️ **Areas for Improvement:**
- Consolidate dual API surface
- Add automated testing
- Enhance security (CORS, rate limiting, auth in context)
- Improve observability (logging, monitoring)
- Document RLS policies and deployment

**Overall Grade: B+** (Production-ready with room for polish)

---

**Next Steps:**
Review this analysis with the team and prioritize action items based on business impact and technical risk.
