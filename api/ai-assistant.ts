import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Define the function calling tools for the AI assistant
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_projects',
      description: 'Query projects by name, status, or get all projects. Use this when user asks about their projects.',
      parameters: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'Filter by project name (partial match)',
          },
          status: {
            type: 'string',
            enum: ['active', 'completed', 'on-hold', 'archived'],
            description: 'Filter by project status',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_clients',
      description: 'Query clients by name or get all clients. Use this when user asks about their clients.',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'Filter by client name (partial match)',
          },
          status: {
            type: 'string',
            enum: ['Lead', 'Project', 'Completed'],
            description: 'Filter by client status',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_expenses',
      description: 'Query expenses, optionally filter by project or those with receipts/attachments.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Filter by project ID',
          },
          projectName: {
            type: 'string',
            description: 'Filter by project name',
          },
          withReceipts: {
            type: 'boolean',
            description: 'Only return expenses that have receipt attachments',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_estimates',
      description: 'Query estimates by client name, project, or status.',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'Filter by client name',
          },
          projectId: {
            type: 'string',
            description: 'Filter by project ID',
          },
          status: {
            type: 'string',
            enum: ['draft', 'sent', 'approved', 'rejected', 'paid'],
            description: 'Filter by estimate status',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_followup',
      description: 'Set a follow-up date for a client. Use this when user wants to schedule a follow-up.',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'The name of the client',
          },
          followUpDate: {
            type: 'string',
            description: 'The follow-up date in ISO format (YYYY-MM-DD)',
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the follow-up',
          },
        },
        required: ['clientName', 'followUpDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_inspection_link',
      description: 'Send an inspection link to a client.',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'The name of the client',
          },
        },
        required: ['clientName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_payment',
      description: 'Request payment for an estimate from a client.',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'The name of the client',
          },
          estimateId: {
            type: 'string',
            description: 'The ID of the estimate to request payment for',
          },
        },
        required: ['clientName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_client',
      description: 'Add a new client to the CRM. Use this when user wants to add a new client/lead. Ask for all required information before calling this function.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Full name of the client (required)',
          },
          email: {
            type: 'string',
            description: 'Email address of the client (required)',
          },
          phone: {
            type: 'string',
            description: 'Phone number of the client (required)',
          },
          address: {
            type: 'string',
            description: 'Address of the client (optional)',
          },
          source: {
            type: 'string',
            enum: ['Google', 'Referral', 'Ad', 'Phone Call'],
            description: 'How the client found us (required). Always ask the user.',
          },
        },
        required: ['name', 'email', 'phone', 'source'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_report',
      description: 'Generate a report based on business data. Use this for custom reports.',
      parameters: {
        type: 'object',
        properties: {
          reportType: {
            type: 'string',
            enum: ['expenses', 'projects', 'time-tracking', 'financial', 'clients'],
            description: 'Type of report to generate',
          },
          withReceipts: {
            type: 'boolean',
            description: 'For expense reports, only include expenses with receipts',
          },
          projectId: {
            type: 'string',
            description: 'Filter by specific project',
          },
          dateRange: {
            type: 'object',
            properties: {
              startDate: { type: 'string' },
              endDate: { type: 'string' },
            },
          },
        },
        required: ['reportType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_estimate',
      description: 'Generate a new estimate for a client.',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'The name of the client',
          },
          projectType: {
            type: 'string',
            description: 'Type of project (e.g., bathroom remodel, kitchen renovation)',
          },
          budget: {
            type: 'number',
            description: 'Budget amount for the project',
          },
          description: {
            type: 'string',
            description: 'Additional description or notes',
          },
        },
        required: ['clientName', 'projectType', 'budget'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_estimate',
      description: 'Send an estimate to a client via email. Generates a PDF and opens the mail client. If estimateId is not provided and client has multiple estimates, will list them for selection.',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'The name of the client to send the estimate to',
          },
          estimateId: {
            type: 'string',
            description: 'The specific estimate ID to send. If not provided, will use the most recent or ask user to choose.',
          },
        },
        required: ['clientName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_summary',
      description: 'Get a business summary/overview of projects, clients, or financials.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['overview', 'financial', 'projects', 'clients'],
            description: 'Type of summary to get',
          },
        },
        required: ['type'],
      },
    },
  },
  // NEW TOOLS FOR COMPLETE BUSINESS INTELLIGENCE
  {
    type: 'function',
    function: {
      name: 'query_price_list',
      description: 'Search the price list for items by name or category. Use for pricing questions like "what\'s the price on X".',
      parameters: {
        type: 'object',
        properties: {
          searchTerm: {
            type: 'string',
            description: 'Item name or keyword to search for',
          },
          category: {
            type: 'string',
            description: 'Optional category filter',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_clock_entries',
      description: 'Query clock/time entries. Use for "who clocked today", "total hours worked", "hours by employee".',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Filter by date (YYYY-MM-DD). Use "today" for current date.',
          },
          employeeId: {
            type: 'string',
            description: 'Filter by employee ID',
          },
          employeeName: {
            type: 'string',
            description: 'Filter by employee name',
          },
          projectId: {
            type: 'string',
            description: 'Filter by project ID',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_payments',
      description: 'Query payments/sales received. Use for "sales today", "payments this week", "revenue".',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Filter by specific date (YYYY-MM-DD)',
          },
          startDate: {
            type: 'string',
            description: 'Start of date range',
          },
          endDate: {
            type: 'string',
            description: 'End of date range',
          },
          projectId: {
            type: 'string',
            description: 'Filter by project ID',
          },
          clientName: {
            type: 'string',
            description: 'Filter by client name',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_daily_logs',
      description: 'Query daily work logs for projects. Use for "what work was done today", "daily report".',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Filter by date (YYYY-MM-DD)',
          },
          projectId: {
            type: 'string',
            description: 'Filter by project ID',
          },
          projectName: {
            type: 'string',
            description: 'Filter by project name',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_tasks',
      description: 'Query tasks. Use for "pending tasks", "completed tasks", "tasks for project".',
      parameters: {
        type: 'object',
        properties: {
          completed: {
            type: 'boolean',
            description: 'Filter by completion status',
          },
          projectId: {
            type: 'string',
            description: 'Filter by project ID',
          },
          projectName: {
            type: 'string',
            description: 'Filter by project name',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_photos',
      description: 'Query photos for projects. Use for "how many photos", "photos by category".',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Filter by project ID',
          },
          projectName: {
            type: 'string',
            description: 'Filter by project name',
          },
          category: {
            type: 'string',
            description: 'Filter by photo category',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_change_orders',
      description: 'Query change orders. Use for "pending change orders", "approved changes".',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected'],
            description: 'Filter by status',
          },
          projectId: {
            type: 'string',
            description: 'Filter by project ID',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_subcontractors',
      description: 'Query subcontractors. Use for "available subs", "plumbing subcontractors".',
      parameters: {
        type: 'object',
        properties: {
          trade: {
            type: 'string',
            description: 'Filter by trade/specialty',
          },
          availability: {
            type: 'string',
            enum: ['available', 'busy', 'unavailable'],
            description: 'Filter by availability',
          },
          approved: {
            type: 'boolean',
            description: 'Filter by approval status',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_call_logs',
      description: 'Query call logs. Use for "call history", "qualified leads from calls".',
      parameters: {
        type: 'object',
        properties: {
          isQualified: {
            type: 'boolean',
            description: 'Filter by qualified status',
          },
          date: {
            type: 'string',
            description: 'Filter by date',
          },
          status: {
            type: 'string',
            enum: ['answered', 'missed', 'voicemail'],
            description: 'Filter by call status',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_team_members',
      description: 'Query team members/employees. Use for "who are my employees", "employee list", "hourly rates".',
      parameters: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['super-admin', 'admin', 'salesperson', 'field-employee', 'employee'],
            description: 'Filter by role',
          },
          isActive: {
            type: 'boolean',
            description: 'Filter by active status',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_proposals',
      description: 'Query subcontractor proposals. Use for "pending proposals", "accepted bids".',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['submitted', 'accepted', 'rejected', 'negotiating'],
            description: 'Filter by status',
          },
          projectId: {
            type: 'string',
            description: 'Filter by project ID',
          },
          subcontractorId: {
            type: 'string',
            description: 'Filter by subcontractor ID',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_price_list_items',
      description: 'Create new price list items (and optionally a new category) when user wants to add items for estimate creation. Use this when the price list does not have items matching the requested project type.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'The category name (e.g., "Pool", "Solar", "HVAC")',
          },
          isNewCategory: {
            type: 'boolean',
            description: 'Whether this is a new category to create',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Item name (e.g., "Pool Excavation")' },
                unit: { type: 'string', description: 'Unit of measure (EA, SF, HR, LF, etc.)' },
                unitPrice: { type: 'number', description: 'Price per unit' },
                description: { type: 'string', description: 'Optional description' },
              },
              required: ['name', 'unit', 'unitPrice'],
            },
            description: 'Array of items to create',
          },
        },
        required: ['category', 'items'],
      },
    },
  },
];

// System prompt for dual-purpose assistant with knowledge base rules
const systemPrompt = `You are Legacy AI, the AI assistant for Legacy Prime Construction's workflow management platform.

## CRITICAL RULES (MUST FOLLOW)

### Rule 1: Never Confirm Actions Without Verification
- Do NOT say "I've added [client]" or "Done!" until the action is actually completed
- After any write operation, wait for confirmation before telling the user it succeeded
- If action fails, inform the user of the failure honestly

### Rule 2: One Task At A Time
- Complete the current task before starting a new one
- If user changes topic mid-task, ASK: "Would you like me to complete [current task] first, or switch to [new topic]?"
- NEVER carry over context from a previous task to a new unrelated task

### Rule 3: Reset Context On Topic Change
- When user mentions a NEW client, project, or entity, treat it as a FRESH request
- Do NOT reference previous clients/projects from earlier in the conversation
- Ask for all required information again for the new entity
- Example: If discussing "John" then user says "add a different client", FORGET John completely and ask for the new name

### Rule 4: Explicit Requests Only
- NEVER perform an action unless the user EXPLICITLY requests it
- NEVER auto-create estimates, projects, or clients based on assumptions
- If an action seems implied, ASK for confirmation first
- Example: User mentions a budget → Ask "Would you like me to create an estimate with this budget?" Do NOT just create it

### Rule 5: Required Fields Must Be Collected
- Do NOT proceed with partial information
- Do NOT make assumptions about missing fields
- Ask for missing required fields explicitly
- For clients: Need name AND (email OR phone) - do not proceed without both

### Rule 6: Verify Before Confirming
- After write operations, verify the action completed successfully
- Only then confirm success to the user
- If you cannot verify, say "I'm attempting to add..." not "I've added..."

### Rule 7: EXACT Client Names in Tool Calls (CRITICAL)
When calling any tool that takes a clientName parameter, you MUST pass the EXACT name the user said:
- If user says "Sarah", pass clientName: "Sarah" - NOT "Sarah Johnson" even if you discussed Sarah Johnson earlier
- If user says "Tom", pass clientName: "Tom" - NOT "Tom Smith" even if you know Tom Smith from context
- NEVER expand, complete, or infer the full client name from conversation history
- The tool will handle disambiguation if multiple clients match the partial name
- This rule OVERRIDES any context from previous messages
- Violating this rule causes the wrong client to be selected

### Rule 8: Disambiguation Follow-Through (CRITICAL)
When a tool returns multiple client matches and user selects one, you MUST:
1. Identify the EXACT name they selected from the list (e.g., if they say "second one" and list showed "1. Sarah Johnson 2. Sarah", they selected "Sarah")
2. IMMEDIATELY call the SAME tool again with the selected client's EXACT name
3. Do NOT just acknowledge the selection - you MUST make the tool call to complete the action

**Example Flow:**
- User: "Create estimate for Sarah"
- Tool returns: "Multiple clients: 1. Sarah Johnson 2. Sarah"
- User: "Second one"
- You MUST call generate_estimate with clientName: "Sarah" (the exact name from option 2)
- Do NOT say "Let me proceed..." without actually calling the tool

**What NOT to do:**
- Do NOT just say "Okay, I'll proceed with Sarah" without calling the tool
- Do NOT wait for another user message - call the tool immediately after they select
- Do NOT ask for confirmation again - they already made their choice

### Rule 9: Handling Missing Price List Items (CRITICAL)
When user asks to create an estimate for a project type with NO matching items in the price list:

1. DO NOT create empty estimates or auto-generate placeholder items
2. Inform the user that no matching items exist for that project type
3. Suggest relevant item names based on the project type
4. Ask if they want to create a new category with these items
5. For each item, ask for: unit (EA/SF/HR/LF/etc.) and unit price
6. After user provides info, call the create_price_list_items tool to create them
7. THEN proceed to create the original estimate

**Suggested Items by Project Type:**
- Pool/Spa: Excavation & Grading, Shell/Concrete, Plumbing & Equipment, Tile/Interior, Decking/Coping
- Solar: Panels, Inverter, Mounting Hardware, Electrical Work, Permits & Inspection
- HVAC: Equipment, Ductwork, Electrical, Thermostat/Controls, Labor
- Landscaping: Design, Plants & Materials, Irrigation, Hardscape, Labor
- For other types: suggest 3-5 logical phases/components

**Example conversation:**
User: "Create estimate for pool"
AI: "I don't have pool items in your price list. I can create a 'Pool' category with:
     1. Pool Excavation & Grading
     2. Pool Shell & Concrete Work
     3. Pool Plumbing & Equipment
     4. Pool Tile & Interior Finish
     5. Pool Decking & Coping
     Would you like to proceed? Please provide the unit and price for each."
User: "Yes, all EA. Excavation $50K, Concrete $150K, Plumbing $80K, Tile $100K, Decking $120K"
AI: [Calls create_price_list_items with category: "Pool", items: [...]]
AI: "Pool category created! Now creating your estimate..."
AI: [Calls generate_estimate]

## CLIENT MANAGEMENT

**Required Fields:**
- name (REQUIRED - always ask first)
- email OR phone (at least one contact method required)

**Optional Fields:**
- address
- source (Google, Referral, Ad, Phone Call)

**Correct Process:**
1. Ask for name first
2. Ask for email OR phone (at least one required)
3. Confirm details with user before adding
4. Execute add_client action
5. Verify client was added
6. Report success or failure honestly

**Handling Name Changes:**
If user corrects or changes the client name mid-conversation:
- STOP processing the old name immediately
- Acknowledge the correction
- Start fresh with the new name
- Do NOT carry over any details from the old name

## ESTIMATE MANAGEMENT

**Hierarchy: CLIENT → ESTIMATE → PROJECT**
- Estimates belong to CLIENTS, not projects
- A client MUST exist before creating an estimate
- Projects are created FROM approved estimates, not before

**Never auto-create estimates.** Always ask:
1. Which client is this for?
2. What type of project?
3. What is the budget?

## SENDING ESTIMATES

**Context Awareness:**
- When user says "send THIS estimate" or "send it", refer to the estimate you just created or discussed
- If estimate ID is known from recent context, use it directly
- Only ask "which estimate?" if there are multiple and context is unclear

**Email Handling:**
- Only mention client's email in responses if they actually have one on file
- If client has no email, still proceed with sending - mail client will open and user can input email manually
- Do NOT say "to client@email.com" if the client has no email address

**Process:**
1. If user says "send this estimate" after creating one, use that estimate's ID
2. If context unclear and client has 1 estimate, send it
3. If context unclear and client has multiple estimates, list them and ask
4. Generate PDF and open mail client

## CONTEXT EXAMPLES

**GOOD - Handling Topic Change:**
User: "Add client John Doe"
AI: "I'll add John Doe. What's his email or phone number?"
User: "Actually, add a different client"
AI: "Sure! What is the name of the client you'd like to add?" [Completely forgets John]

**BAD - Context Bleeding (NEVER DO THIS):**
User: "Add client John Doe"
AI: "What's John's email?"
User: "Add a different client"
AI: "What's John's email?" ← WRONG! Should ask for new client's name

**GOOD - Honest About Actions:**
AI: "I'm adding Sarah Johnson to your CRM now..."
[After action completes]
AI: "Sarah Johnson has been successfully added."

**BAD - False Confirmation (NEVER DO THIS):**
AI: "Sarah has been added to your CRM!" ← WRONG if action hasn't completed yet

## AVAILABLE FEATURES
- Dashboard: Overview of all projects, tasks, and metrics
- CRM: Client management and lead tracking
- Estimates: Create and send project estimates (for CLIENTS)
- Projects: Manage active projects (created FROM estimates)
- Schedule: Calendar view of tasks and projects
- Expenses: Track project expenses and receipts
- Photos: Upload and organize project photos
- Chat: Team communication
- Reports: Generate financial and administrative reports
- Clock: Employee time tracking

## RESPONSE STYLE
- Be concise and direct
- Use bullet points and numbered lists for clarity
- Be friendly but professional
- Never use excessive praise or flattery
- Respond in English

When you need to query or modify data, use the available tools. The tools have access to the user's actual business data.`;

// Helper function to suggest items for a project type when none exist in price list
function getSuggestedItemsForProjectType(projectType: string): string[] {
  const typeLower = (projectType || '').toLowerCase();

  // Industry-standard breakdowns for common project types
  if (typeLower.includes('pool') || typeLower.includes('spa')) {
    return [
      'Pool Excavation & Grading',
      'Pool Shell & Concrete Work',
      'Pool Plumbing & Equipment',
      'Pool Tile & Interior Finish',
      'Pool Decking & Coping',
    ];
  }

  if (typeLower.includes('solar')) {
    return [
      'Solar Panels',
      'Solar Inverter',
      'Mounting Hardware & Racking',
      'Electrical Work & Wiring',
      'Permits & Inspection',
    ];
  }

  if (typeLower.includes('hvac') || typeLower.includes('heating') || typeLower.includes('cooling')) {
    return [
      'HVAC Equipment',
      'Ductwork Installation',
      'Electrical Connections',
      'Thermostat & Controls',
      'Labor & Installation',
    ];
  }

  if (typeLower.includes('landscape') || typeLower.includes('landscaping')) {
    return [
      'Design & Planning',
      'Plants & Materials',
      'Irrigation System',
      'Hardscape Work',
      'Labor & Installation',
    ];
  }

  if (typeLower.includes('fence') || typeLower.includes('fencing')) {
    return [
      'Fence Posts & Hardware',
      'Fence Panels/Materials',
      'Gate & Hardware',
      'Labor & Installation',
    ];
  }

  if (typeLower.includes('deck') || typeLower.includes('patio')) {
    return [
      'Deck Framing & Structure',
      'Decking Materials',
      'Railing & Hardware',
      'Finishing & Sealing',
      'Labor & Installation',
    ];
  }

  // Generic breakdown for unknown project types
  return [
    `${projectType} - Materials`,
    `${projectType} - Labor`,
    `${projectType} - Equipment`,
    `${projectType} - Permits & Fees`,
    `${projectType} - Project Management`,
  ];
}

// Helper function to find client by name with disambiguation for multiple matches
function findClientByName(clients: any[], clientName: string): { client?: any; error?: string; multiple?: boolean; message?: string; clients?: any[] } {
  const matches = clients.filter((c: any) =>
    c.name?.toLowerCase().includes(clientName.toLowerCase())
  );

  if (matches.length === 0) {
    return { error: `No client found matching "${clientName}"` };
  }

  if (matches.length === 1) {
    return { client: matches[0] };
  }

  // Multiple matches - return list for disambiguation
  return {
    multiple: true,
    message: `Multiple clients match "${clientName}". Which one did you mean?`,
    clients: matches.map((c: any, i: number) => ({
      number: i + 1,
      name: c.name,
      email: c.email || 'No email',
      phone: c.phone || 'No phone',
    })),
  };
}

// Execute tool calls against the provided app data
function executeToolCall(
  toolName: string,
  args: any,
  appData: any
): { result: any; actionRequired?: string; actionData?: any } {
  const { projects = [], clients = [], expenses = [], estimates = [], payments = [], clockEntries = [], company } = appData;

  switch (toolName) {
    case 'query_projects': {
      let filtered = projects;
      if (args.projectName) {
        filtered = filtered.filter((p: any) =>
          p.name?.toLowerCase().includes(args.projectName.toLowerCase())
        );
      }
      if (args.status) {
        filtered = filtered.filter((p: any) => p.status === args.status);
      }
      return {
        result: {
          count: filtered.length,
          projects: filtered.map((p: any) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            budget: p.budget,
            expenses: p.expenses,
            progress: p.progress,
          })),
        },
      };
    }

    case 'query_clients': {
      let filtered = clients;
      if (args.clientName) {
        filtered = filtered.filter((c: any) =>
          c.name?.toLowerCase().includes(args.clientName.toLowerCase())
        );
      }
      if (args.status) {
        filtered = filtered.filter((c: any) => c.status === args.status);
      }
      return {
        result: {
          count: filtered.length,
          clients: filtered.map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            status: c.status,
            lastContacted: c.lastContacted,
            nextFollowUpDate: c.nextFollowUpDate,
          })),
        },
      };
    }

    case 'query_expenses': {
      let filtered = expenses;
      if (args.projectId) {
        filtered = filtered.filter((e: any) => e.projectId === args.projectId);
      }
      if (args.projectName) {
        const project = projects.find((p: any) =>
          p.name?.toLowerCase().includes(args.projectName.toLowerCase())
        );
        if (project) {
          filtered = filtered.filter((e: any) => e.projectId === project.id);
        }
      }
      if (args.withReceipts) {
        filtered = filtered.filter((e: any) => e.receiptUrl);
      }
      const total = filtered.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      return {
        result: {
          count: filtered.length,
          total,
          expenses: filtered.map((e: any) => ({
            id: e.id,
            type: e.type,
            subcategory: e.subcategory,
            amount: e.amount,
            store: e.store,
            date: e.date,
            hasReceipt: !!e.receiptUrl,
            projectId: e.projectId,
          })),
        },
      };
    }

    case 'query_estimates': {
      let filtered = estimates;
      let clientFound = null;

      if (args.clientName) {
        // Find the client by name
        clientFound = clients.find((c: any) =>
          c.name?.toLowerCase().includes(args.clientName.toLowerCase())
        );
        if (clientFound) {
          // Filter estimates by client ID - estimates are now linked directly to clients
          filtered = filtered.filter((e: any) => e.clientId === clientFound.id);
        } else {
          // Client not found - return empty result with helpful message
          return {
            result: {
              count: 0,
              estimates: [],
              message: `No client found matching "${args.clientName}". Please check the client name and try again.`,
            },
          };
        }
      }
      if (args.projectId) {
        filtered = filtered.filter((e: any) => e.projectId === args.projectId);
      }
      if (args.status) {
        filtered = filtered.filter((e: any) => e.status === args.status);
      }

      // If client was specified but no estimates found, provide helpful message
      if (clientFound && filtered.length === 0) {
        return {
          result: {
            count: 0,
            estimates: [],
            clientName: clientFound.name,
            message: `${clientFound.name} doesn't have any estimates yet. Would you like me to create one?`,
          },
        };
      }

      return {
        result: {
          count: filtered.length,
          estimates: filtered.map((e: any) => ({
            id: e.id,
            name: e.name,
            total: e.total,
            status: e.status,
            createdDate: e.createdDate,
            clientId: e.clientId,
          })),
          clientName: clientFound?.name,
        },
      };
    }

    case 'add_client': {
      // Validate required fields
      if (!args.name) {
        return {
          result: { error: 'Client name is required. Please ask for the client\'s name.' },
        };
      }
      if (!args.email) {
        return {
          result: { error: 'Client email is required. Please ask for the client\'s email address.' },
        };
      }
      if (!args.phone) {
        return {
          result: { error: 'Client phone is required. Please ask for the client\'s phone number.' },
        };
      }
      if (!args.source) {
        return {
          result: { error: 'Please ask how the client found us (Google, Referral, Ad, or Phone Call).' },
        };
      }

      // Check if client already exists
      const existingClient = clients.find((c: any) =>
        c.email?.toLowerCase() === args.email.toLowerCase() ||
        c.phone === args.phone
      );

      if (existingClient) {
        return {
          result: {
            error: `A client with this ${existingClient.email?.toLowerCase() === args.email.toLowerCase() ? 'email' : 'phone number'} already exists: ${existingClient.name}`
          },
        };
      }

      return {
        result: {
          success: true,
          message: `Client "${args.name}" will be added to the CRM.`,
          clientData: {
            name: args.name,
            email: args.email,
            phone: args.phone,
            address: args.address || null,
            source: args.source,
          },
        },
        actionRequired: 'add_client',
        actionData: {
          name: args.name,
          email: args.email,
          phone: args.phone,
          address: args.address || null,
          source: args.source,
          status: 'Lead',
        },
      };
    }

    case 'set_followup': {
      const clientResult = findClientByName(clients, args.clientName);

      if (clientResult.error) {
        return { result: { error: clientResult.error } };
      }

      if (clientResult.multiple) {
        return { result: clientResult };
      }

      const client = clientResult.client;
      return {
        result: {
          success: true,
          message: `Follow-up set for ${client.name} on ${args.followUpDate}`,
          clientId: client.id,
          clientName: client.name,
          date: args.followUpDate,
        },
        actionRequired: 'set_followup',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          date: args.followUpDate,
          notes: args.notes,
        },
      };
    }

    case 'send_inspection_link': {
      const clientResult = findClientByName(clients, args.clientName);

      if (clientResult.error) {
        return { result: { error: clientResult.error } };
      }

      if (clientResult.multiple) {
        return { result: clientResult };
      }

      const client = clientResult.client;
      return {
        result: {
          success: true,
          message: `Inspection link will be sent to ${client.name}`,
          clientId: client.id,
          clientEmail: client.email,
        },
        actionRequired: 'send_inspection_link',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email,
        },
      };
    }

    case 'request_payment': {
      const clientResult = findClientByName(clients, args.clientName);

      if (clientResult.error) {
        return { result: { error: clientResult.error } };
      }

      if (clientResult.multiple) {
        return { result: clientResult };
      }

      const client = clientResult.client;

      // If no estimate ID provided, list available estimates
      if (!args.estimateId) {
        const clientEstimates = estimates.filter(
          (e: any) => e.status === 'approved' || e.status === 'sent'
        );
        if (clientEstimates.length === 0) {
          return {
            result: {
              error: 'No approved or sent estimates found for payment request',
            },
          };
        }
        return {
          result: {
            needsSelection: true,
            message: 'Please select which estimate to request payment for:',
            estimates: clientEstimates.map((e: any) => ({
              id: e.id,
              name: e.name,
              total: e.total,
              status: e.status,
            })),
          },
        };
      }

      const estimate = estimates.find((e: any) => e.id === args.estimateId);
      if (!estimate) {
        return {
          result: { error: `Estimate not found` },
        };
      }

      return {
        result: {
          success: true,
          message: `Payment request will be sent to ${client.name} for ${estimate.name} ($${estimate.total})`,
        },
        actionRequired: 'request_payment',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email,
          estimateId: estimate.id,
          estimateName: estimate.name,
          amount: estimate.total,
        },
      };
    }

    case 'generate_report': {
      let reportData: any = {};

      switch (args.reportType) {
        case 'expenses': {
          let filtered = expenses;
          if (args.withReceipts) {
            filtered = filtered.filter((e: any) => e.receiptUrl);
          }
          if (args.projectId) {
            filtered = filtered.filter((e: any) => e.projectId === args.projectId);
          }

          // Group by category
          const byCategory: Record<string, number> = {};
          filtered.forEach((e: any) => {
            const cat = e.type || 'Other';
            byCategory[cat] = (byCategory[cat] || 0) + e.amount;
          });

          reportData = {
            type: 'expenses',
            totalExpenses: filtered.reduce((sum: number, e: any) => sum + e.amount, 0),
            count: filtered.length,
            withReceipts: args.withReceipts,
            byCategory,
            expenses: filtered,
          };
          break;
        }

        case 'projects': {
          const activeProjects = projects.filter((p: any) => p.status === 'active');
          const completedProjects = projects.filter((p: any) => p.status === 'completed');
          const totalBudget = projects.reduce((sum: number, p: any) => sum + (p.budget || 0), 0);
          const totalExpenses = projects.reduce((sum: number, p: any) => sum + (p.expenses || 0), 0);

          reportData = {
            type: 'projects',
            totalProjects: projects.length,
            activeProjects: activeProjects.length,
            completedProjects: completedProjects.length,
            totalBudget,
            totalExpenses,
            profitMargin: totalBudget > 0 ? ((totalBudget - totalExpenses) / totalBudget) * 100 : 0,
            projects,
          };
          break;
        }

        case 'time-tracking': {
          const totalHours = clockEntries.reduce((sum: number, c: any) => {
            if (c.clockIn && c.clockOut) {
              const hours = (new Date(c.clockOut).getTime() - new Date(c.clockIn).getTime()) / 3600000;
              return sum + hours;
            }
            return sum;
          }, 0);

          reportData = {
            type: 'time-tracking',
            totalEntries: clockEntries.length,
            totalHours: Math.round(totalHours * 100) / 100,
            clockEntries,
          };
          break;
        }

        case 'financial': {
          const totalBudget = projects.reduce((sum: number, p: any) => sum + (p.budget || 0), 0);
          const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
          const totalPayments = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

          reportData = {
            type: 'financial',
            totalBudget,
            totalExpenses,
            totalPayments,
            profit: totalPayments - totalExpenses,
            projects: projects.length,
          };
          break;
        }

        case 'clients': {
          const leads = clients.filter((c: any) => c.status === 'Lead');
          const activeClients = clients.filter((c: any) => c.status === 'Project');
          const completed = clients.filter((c: any) => c.status === 'Completed');

          reportData = {
            type: 'clients',
            totalClients: clients.length,
            leads: leads.length,
            activeClients: activeClients.length,
            completedClients: completed.length,
            clients,
          };
          break;
        }
      }

      return {
        result: reportData,
        actionRequired: 'save_report',
        actionData: reportData,
      };
    }

    case 'generate_estimate': {
      const clientResult = findClientByName(clients, args.clientName);

      if (clientResult.error) {
        return {
          result: { error: `${clientResult.error}. Please add them to your CRM first.` },
        };
      }

      if (clientResult.multiple) {
        return { result: clientResult };
      }

      const client = clientResult.client;

      // Check if price list has matching items for this project type
      const { priceList = [] } = appData;
      const projectTypeLower = (args.projectType || '').toLowerCase();

      // Map project types to relevant categories
      const categoryMap: { [key: string]: string[] } = {
        'bathroom': ['Bathroom', 'Plumbing', 'Tile'],
        'kitchen': ['Kitchen', 'Appliances', 'Countertops', 'Cabinets'],
        'painting': ['Paint', 'Drywall'],
        'flooring': ['Flooring', 'Tile'],
        'roofing': ['Roofing', 'Roof'],
        'remodel': ['Pre-Construction', 'Demolition', 'Drywall', 'Paint'],
        'renovation': ['Pre-Construction', 'Demolition', 'Drywall', 'Paint'],
        'pool': ['Pool', 'Concrete', 'Excavation'],
        'solar': ['Solar', 'Electrical'],
        'hvac': ['HVAC', 'Mechanical'],
        'landscaping': ['Landscaping', 'Exterior'],
      };

      // Find matching categories
      let matchingCategories: string[] = [];
      for (const [key, cats] of Object.entries(categoryMap)) {
        if (projectTypeLower.includes(key)) {
          matchingCategories = [...matchingCategories, ...cats];
        }
      }

      // If no specific match, use general categories
      if (matchingCategories.length === 0) {
        matchingCategories = ['Pre-Construction', 'General'];
      }

      // Check if we have items in these categories
      const matchingItems = priceList.filter((item: any) =>
        matchingCategories.some(cat =>
          item.category?.toLowerCase().includes(cat.toLowerCase())
        )
      );

      // If no matching items found, prompt user to create them
      if (matchingItems.length === 0 || (matchingItems.length < 3 && args.budget > 10000)) {
        // Suggest items based on project type
        const suggestedItems = getSuggestedItemsForProjectType(args.projectType);

        return {
          result: {
            noMatchingItems: true,
            projectType: args.projectType,
            clientName: client.name,
            budget: args.budget,
            message: `I don't have any "${args.projectType}" items in your price list. I can create a new category with these suggested items:\n\n${suggestedItems.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}\n\nWould you like to proceed? Please provide the unit (EA, SF, HR, etc.) and price for each item.`,
            suggestedItems,
          },
        };
      }

      return {
        result: {
          success: true,
          message: `Estimate will be generated for ${client.name}`,
          clientName: client.name,
          projectType: args.projectType,
          budget: args.budget,
        },
        actionRequired: 'generate_estimate',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email,
          projectType: args.projectType,
          budget: args.budget,
          description: args.description,
        },
      };
    }

    case 'create_price_list_items': {
      // This action will be handled by the frontend to create items in the database
      return {
        result: {
          success: true,
          message: `Creating ${args.items?.length || 0} items in "${args.category}" category...`,
          category: args.category,
          isNewCategory: args.isNewCategory,
          itemCount: args.items?.length || 0,
        },
        actionRequired: 'create_price_list_items',
        actionData: {
          category: args.category,
          isNewCategory: args.isNewCategory,
          items: args.items,
        },
      };
    }

    case 'send_estimate': {
      // Find client with disambiguation
      const clientResult = findClientByName(clients, args.clientName);

      if (clientResult.error) {
        return { result: { error: clientResult.error } };
      }

      if (clientResult.multiple) {
        return { result: clientResult };
      }

      const client = clientResult.client;

      // Get client's estimates
      const clientEstimates = estimates.filter((e: any) => e.clientId === client.id);

      if (clientEstimates.length === 0) {
        return { result: { error: `${client.name} has no estimates. Would you like me to create one?` } };
      }

      // If specific estimateId provided, send that one
      if (args.estimateId) {
        const estimate = clientEstimates.find((e: any) => e.id === args.estimateId);
        if (!estimate) {
          return { result: { error: 'Estimate not found' } };
        }
        // Only include email in message if client has one
        const emailInfo = client.email ? ` to ${client.email}` : '';
        return {
          result: { message: `Opening email to send "${estimate.name}"${emailInfo}` },
          actionRequired: 'send_estimate',
          actionData: { estimateId: estimate.id, clientId: client.id, clientEmail: client.email || '' },
        };
      }

      // If only 1 estimate, send it
      if (clientEstimates.length === 1) {
        const emailInfo = client.email ? ` to ${client.email}` : '';
        return {
          result: { message: `Opening email to send "${clientEstimates[0].name}"${emailInfo}` },
          actionRequired: 'send_estimate',
          actionData: { estimateId: clientEstimates[0].id, clientId: client.id, clientEmail: client.email || '' },
        };
      }

      // Multiple estimates - list them for user to choose
      return {
        result: {
          message: `${client.name} has ${clientEstimates.length} estimates. Which one would you like to send?`,
          estimates: clientEstimates.map((e: any, i: number) => ({
            number: i + 1,
            id: e.id,
            name: e.name,
            total: e.total,
            status: e.status,
          })),
        },
      };
    }

    case 'get_summary': {
      switch (args.type) {
        case 'overview': {
          const activeProjects = projects.filter((p: any) => p.status === 'active');
          const totalBudget = projects.reduce((sum: number, p: any) => sum + (p.budget || 0), 0);
          const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
          const leads = clients.filter((c: any) => c.status === 'Lead');

          return {
            result: {
              companyName: company?.name || 'Your Company',
              activeProjects: activeProjects.length,
              totalProjects: projects.length,
              totalClients: clients.length,
              newLeads: leads.length,
              totalBudget,
              totalExpenses,
              pendingEstimates: estimates.filter((e: any) => e.status === 'sent').length,
            },
          };
        }

        case 'financial': {
          const totalBudget = projects.reduce((sum: number, p: any) => sum + (p.budget || 0), 0);
          const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
          const totalPayments = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

          return {
            result: {
              totalBudget,
              totalExpenses,
              totalPayments,
              profit: totalPayments - totalExpenses,
              profitMargin: totalBudget > 0 ? ((totalBudget - totalExpenses) / totalBudget) * 100 : 0,
            },
          };
        }

        case 'projects': {
          return {
            result: {
              total: projects.length,
              active: projects.filter((p: any) => p.status === 'active').length,
              completed: projects.filter((p: any) => p.status === 'completed').length,
              onHold: projects.filter((p: any) => p.status === 'on-hold').length,
              projects: projects.map((p: any) => ({
                name: p.name,
                status: p.status,
                budget: p.budget,
                progress: p.progress,
              })),
            },
          };
        }

        case 'clients': {
          return {
            result: {
              total: clients.length,
              leads: clients.filter((c: any) => c.status === 'Lead').length,
              active: clients.filter((c: any) => c.status === 'Project').length,
              completed: clients.filter((c: any) => c.status === 'Completed').length,
            },
          };
        }

        default:
          return { result: { error: 'Unknown summary type' } };
      }
    }

    // NEW TOOL EXECUTIONS FOR COMPLETE BUSINESS INTELLIGENCE
    case 'query_price_list': {
      const { priceList = [] } = appData;
      let filtered = priceList;

      if (args.searchTerm) {
        const search = args.searchTerm.toLowerCase();
        filtered = filtered.filter((item: any) =>
          item.name?.toLowerCase().includes(search) ||
          item.description?.toLowerCase().includes(search)
        );
      }
      if (args.category) {
        filtered = filtered.filter((item: any) =>
          item.category?.toLowerCase().includes(args.category.toLowerCase())
        );
      }

      return {
        result: {
          count: filtered.length,
          items: filtered.slice(0, 20).map((item: any) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            description: item.description,
            unit: item.unit,
            unitPrice: item.unitPrice,
            laborCost: item.laborCost,
            materialCost: item.materialCost,
          })),
          hasMore: filtered.length > 20,
        },
      };
    }

    case 'query_clock_entries': {
      const { clockEntries = [], users = [] } = appData;
      let filtered = clockEntries;
      const today = new Date().toISOString().split('T')[0];

      // Handle "today" filter
      const filterDate = args.date === 'today' ? today : args.date;

      if (filterDate) {
        filtered = filtered.filter((entry: any) => {
          const entryDate = entry.clockIn?.split('T')[0];
          return entryDate === filterDate;
        });
      }
      if (args.employeeId) {
        filtered = filtered.filter((entry: any) => entry.employeeId === args.employeeId);
      }
      if (args.employeeName) {
        const employee = users.find((u: any) =>
          u.name?.toLowerCase().includes(args.employeeName.toLowerCase())
        );
        if (employee) {
          filtered = filtered.filter((entry: any) => entry.employeeId === employee.id);
        }
      }
      if (args.projectId) {
        filtered = filtered.filter((entry: any) => entry.projectId === args.projectId);
      }

      // Calculate total hours
      const totalHours = filtered.reduce((sum: number, entry: any) => {
        if (entry.clockIn && entry.clockOut) {
          const hours = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / 3600000;
          return sum + hours;
        }
        return sum;
      }, 0);

      // Get unique employees who clocked in
      const employeeIds = [...new Set(filtered.map((e: any) => e.employeeId))];
      const employeesWhoClocked = employeeIds.map(id => {
        const user = users.find((u: any) => u.id === id);
        return user?.name || id;
      });

      return {
        result: {
          count: filtered.length,
          totalHours: Math.round(totalHours * 100) / 100,
          employeesWhoClocked,
          entries: filtered.map((entry: any) => {
            const user = users.find((u: any) => u.id === entry.employeeId);
            return {
              id: entry.id,
              employeeName: user?.name || entry.employeeId,
              projectId: entry.projectId,
              clockIn: entry.clockIn,
              clockOut: entry.clockOut,
              workPerformed: entry.workPerformed,
            };
          }),
        },
      };
    }

    case 'query_payments': {
      let filtered = payments;
      const today = new Date().toISOString().split('T')[0];

      // Handle "today" filter
      const filterDate = args.date === 'today' ? today : args.date;

      if (filterDate) {
        filtered = filtered.filter((p: any) => p.date?.startsWith(filterDate));
      }
      if (args.startDate && args.endDate) {
        filtered = filtered.filter((p: any) => {
          const date = p.date?.split('T')[0];
          return date >= args.startDate && date <= args.endDate;
        });
      }
      if (args.projectId) {
        filtered = filtered.filter((p: any) => p.projectId === args.projectId);
      }
      if (args.clientName) {
        filtered = filtered.filter((p: any) =>
          p.clientName?.toLowerCase().includes(args.clientName.toLowerCase())
        );
      }

      const totalAmount = filtered.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      return {
        result: {
          count: filtered.length,
          totalAmount,
          payments: filtered.map((p: any) => ({
            id: p.id,
            amount: p.amount,
            date: p.date,
            clientName: p.clientName,
            projectId: p.projectId,
            method: p.method,
          })),
        },
      };
    }

    case 'query_daily_logs': {
      const { dailyLogs = [] } = appData;
      let filtered = dailyLogs;
      const today = new Date().toISOString().split('T')[0];

      const filterDate = args.date === 'today' ? today : args.date;

      if (filterDate) {
        filtered = filtered.filter((log: any) => log.logDate?.startsWith(filterDate));
      }
      if (args.projectId) {
        filtered = filtered.filter((log: any) => log.projectId === args.projectId);
      }
      if (args.projectName) {
        const project = projects.find((p: any) =>
          p.name?.toLowerCase().includes(args.projectName.toLowerCase())
        );
        if (project) {
          filtered = filtered.filter((log: any) => log.projectId === project.id);
        }
      }

      return {
        result: {
          count: filtered.length,
          logs: filtered.map((log: any) => ({
            id: log.id,
            projectId: log.projectId,
            logDate: log.logDate,
            workPerformed: log.workPerformed,
            issues: log.issues,
            generalNotes: log.generalNotes,
            createdBy: log.createdBy,
          })),
        },
      };
    }

    case 'query_tasks': {
      const { tasks = [] } = appData;
      let filtered = tasks;

      if (args.completed !== undefined) {
        filtered = filtered.filter((t: any) => t.completed === args.completed);
      }
      if (args.projectId) {
        filtered = filtered.filter((t: any) => t.projectId === args.projectId);
      }
      if (args.projectName) {
        const project = projects.find((p: any) =>
          p.name?.toLowerCase().includes(args.projectName.toLowerCase())
        );
        if (project) {
          filtered = filtered.filter((t: any) => t.projectId === project.id);
        }
      }

      return {
        result: {
          count: filtered.length,
          pending: filtered.filter((t: any) => !t.completed).length,
          completed: filtered.filter((t: any) => t.completed).length,
          tasks: filtered.map((t: any) => ({
            id: t.id,
            name: t.name,
            projectId: t.projectId,
            date: t.date,
            completed: t.completed,
          })),
        },
      };
    }

    case 'query_photos': {
      const { photos = [] } = appData;
      let filtered = photos;

      if (args.projectId) {
        filtered = filtered.filter((p: any) => p.projectId === args.projectId);
      }
      if (args.projectName) {
        const project = projects.find((p: any) =>
          p.name?.toLowerCase().includes(args.projectName.toLowerCase())
        );
        if (project) {
          filtered = filtered.filter((p: any) => p.projectId === project.id);
        }
      }
      if (args.category) {
        filtered = filtered.filter((p: any) =>
          p.category?.toLowerCase().includes(args.category.toLowerCase())
        );
      }

      // Group by category
      const byCategory: Record<string, number> = {};
      filtered.forEach((p: any) => {
        const cat = p.category || 'Other';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      });

      return {
        result: {
          count: filtered.length,
          byCategory,
          photos: filtered.slice(0, 10).map((p: any) => ({
            id: p.id,
            projectId: p.projectId,
            category: p.category,
            notes: p.notes,
            date: p.date,
          })),
        },
      };
    }

    case 'query_change_orders': {
      const { changeOrders = [] } = appData;
      let filtered = changeOrders;

      if (args.status) {
        filtered = filtered.filter((co: any) => co.status === args.status);
      }
      if (args.projectId) {
        filtered = filtered.filter((co: any) => co.projectId === args.projectId);
      }

      const totalAmount = filtered.reduce((sum: number, co: any) => sum + (co.amount || 0), 0);

      return {
        result: {
          count: filtered.length,
          totalAmount,
          pending: changeOrders.filter((co: any) => co.status === 'pending').length,
          approved: changeOrders.filter((co: any) => co.status === 'approved').length,
          changeOrders: filtered.map((co: any) => ({
            id: co.id,
            description: co.description,
            amount: co.amount,
            status: co.status,
            projectId: co.projectId,
            date: co.date,
          })),
        },
      };
    }

    case 'query_subcontractors': {
      const { subcontractors = [] } = appData;
      let filtered = subcontractors;

      if (args.trade) {
        filtered = filtered.filter((s: any) =>
          s.trade?.toLowerCase().includes(args.trade.toLowerCase())
        );
      }
      if (args.availability) {
        filtered = filtered.filter((s: any) => s.availability === args.availability);
      }
      if (args.approved !== undefined) {
        filtered = filtered.filter((s: any) => s.approved === args.approved);
      }

      return {
        result: {
          count: filtered.length,
          available: subcontractors.filter((s: any) => s.availability === 'available').length,
          subcontractors: filtered.map((s: any) => ({
            id: s.id,
            name: s.name,
            companyName: s.companyName,
            trade: s.trade,
            phone: s.phone,
            email: s.email,
            hourlyRate: s.hourlyRate,
            rating: s.rating,
            availability: s.availability,
            approved: s.approved,
          })),
        },
      };
    }

    case 'query_call_logs': {
      const { callLogs = [] } = appData;
      let filtered = callLogs;
      const today = new Date().toISOString().split('T')[0];

      const filterDate = args.date === 'today' ? today : args.date;

      if (filterDate) {
        filtered = filtered.filter((log: any) => log.callDate?.startsWith(filterDate));
      }
      if (args.isQualified !== undefined) {
        filtered = filtered.filter((log: any) => log.isQualified === args.isQualified);
      }
      if (args.status) {
        filtered = filtered.filter((log: any) => log.status === args.status);
      }

      return {
        result: {
          count: filtered.length,
          qualified: callLogs.filter((l: any) => l.isQualified).length,
          answered: callLogs.filter((l: any) => l.status === 'answered').length,
          missed: callLogs.filter((l: any) => l.status === 'missed').length,
          callLogs: filtered.map((log: any) => ({
            id: log.id,
            callerName: log.callerName,
            callerPhone: log.callerPhone,
            callDate: log.callDate,
            status: log.status,
            isQualified: log.isQualified,
            notes: log.notes,
            addedToCRM: log.addedToCRM,
          })),
        },
      };
    }

    case 'query_team_members': {
      const { users = [] } = appData;
      let filtered = users;

      if (args.role) {
        filtered = filtered.filter((u: any) => u.role === args.role);
      }
      if (args.isActive !== undefined) {
        filtered = filtered.filter((u: any) => u.isActive === args.isActive);
      }

      return {
        result: {
          count: filtered.length,
          byRole: {
            admins: users.filter((u: any) => u.role === 'admin' || u.role === 'super-admin').length,
            salespersons: users.filter((u: any) => u.role === 'salesperson').length,
            fieldEmployees: users.filter((u: any) => u.role === 'field-employee').length,
            employees: users.filter((u: any) => u.role === 'employee').length,
          },
          teamMembers: filtered.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            phone: u.phone,
            hourlyRate: u.hourlyRate,
            isActive: u.isActive,
          })),
        },
      };
    }

    case 'query_proposals': {
      const { proposals = [], subcontractors = [] } = appData;
      let filtered = proposals;

      if (args.status) {
        filtered = filtered.filter((p: any) => p.status === args.status);
      }
      if (args.projectId) {
        filtered = filtered.filter((p: any) => p.projectId === args.projectId);
      }
      if (args.subcontractorId) {
        filtered = filtered.filter((p: any) => p.subcontractorId === args.subcontractorId);
      }

      const totalAmount = filtered.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      return {
        result: {
          count: filtered.length,
          totalAmount,
          submitted: proposals.filter((p: any) => p.status === 'submitted').length,
          accepted: proposals.filter((p: any) => p.status === 'accepted').length,
          proposals: filtered.map((p: any) => {
            const sub = subcontractors.find((s: any) => s.id === p.subcontractorId);
            return {
              id: p.id,
              subcontractorName: sub?.name || p.subcontractorId,
              amount: p.amount,
              timeline: p.timeline,
              status: p.status,
              proposalDate: p.proposalDate,
              projectId: p.projectId,
            };
          }),
        },
      };
    }

    default:
      return { result: { error: `Unknown tool: ${toolName}` } };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, appData } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('[AI Assistant] Processing request with', messages.length, 'messages');
    console.log('[AI Assistant] App data:', {
      projects: appData?.projects?.length || 0,
      clients: appData?.clients?.length || 0,
      expenses: appData?.expenses?.length || 0,
      estimates: appData?.estimates?.length || 0,
    });

    // Build OpenAI messages
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.text || msg.content,
      })),
    ];

    // First API call - let AI decide if it needs tools
    let completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 2000,
    });

    let response = completion.choices[0]?.message;
    let actionRequired: string | undefined;
    let actionData: any;

    // Handle tool calls if any
    if (response?.tool_calls && response.tool_calls.length > 0) {
      console.log('[AI Assistant] Tool calls:', response.tool_calls.map((tc: any) => tc.function?.name));

      // Add assistant message with tool calls
      openaiMessages.push(response);

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        const tc = toolCall as any;
        const args = JSON.parse(tc.function.arguments);
        const toolResult = executeToolCall(tc.function.name, args, appData || {});

        console.log('[AI Assistant] Tool result for', tc.function.name, ':', toolResult.result);

        // Track any actions that need to be performed
        if (toolResult.actionRequired) {
          actionRequired = toolResult.actionRequired;
          actionData = toolResult.actionData;
        }

        // Add tool result to messages
        openaiMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.result),
        });
      }

      // Get final response from AI with tool results
      completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      response = completion.choices[0]?.message;
    }

    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Return response with any pending actions
    return res.status(200).json({
      type: 'text',
      content: response.content,
      actionRequired,
      actionData,
    });
  } catch (error: any) {
    console.error('[AI Assistant] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process request',
    });
  }
}
