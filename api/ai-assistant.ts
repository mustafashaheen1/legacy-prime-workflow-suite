import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Increased to handle large PDFs and images
    },
  },
};

// Define the function calling tools for the AI assistant
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_projects',
      description: 'Query projects by name, status, client name, or get all projects. Use this when user asks about their projects. Projects are linked to clients via estimates - returns clientName and clientId when available.',
      parameters: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'Filter by project name (partial match)',
          },
          clientName: {
            type: 'string',
            description: 'Filter by client name - finds projects linked to the client via estimates',
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
      description: 'Generate and SAVE a report to the database. Reports are saved and visible in the Reports Library. Available types: administrative (Admin & Financial), expenses (Expenses breakdown), time-tracking (Employee hours), daily-logs (Daily work logs), custom (AI-generated custom report). Can filter by project name or client name.',
      parameters: {
        type: 'object',
        properties: {
          reportType: {
            type: 'string',
            enum: ['administrative', 'expenses', 'time-tracking', 'daily-logs', 'custom'],
            description: 'Type of report: administrative (Admin & Financial overview), expenses (expense breakdown by category), time-tracking (employee hours), daily-logs (work logs), custom (AI-generated)',
          },
          projectName: {
            type: 'string',
            description: 'Filter by project name OR client name (e.g., "Home Office" or "Claudia" will both work). Required for most reports.',
          },
          customPrompt: {
            type: 'string',
            description: 'For custom reports, the specific analysis or report the user wants',
          },
          dateRange: {
            type: 'object',
            properties: {
              startDate: { type: 'string' },
              endDate: { type: 'string' },
            },
          },
        },
        required: ['reportType', 'projectName'],
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
    type: 'function' as const,
    function: {
      name: 'generate_takeoff_estimate',
      description: 'Analyze an attached construction document (image or PDF) to generate a detailed takeoff estimate. Extracts materials, quantities, and measurements from blueprints, plans, or material lists. Use when user asks to: "create takeoff estimate", "analyze this blueprint", "generate estimate from this plan", "what materials are needed", or uploads construction documents.',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'Name of the client/customer for this estimate'
          },
          estimateName: {
            type: 'string',
            description: 'Descriptive name for this takeoff estimate (e.g., "Kitchen Remodel Takeoff", "Foundation Material Estimate")'
          },
          documentDescription: {
            type: 'string',
            description: 'Brief description of what the document shows (e.g., "kitchen floor plan", "foundation blueprint", "material list for bathroom remodel")'
          },
          imageIndexes: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of indexes (0-based) of attached images/PDFs to analyze. Use [0] for first attachment, [0,1] for first two, etc. If user says "analyze this" or "from this document", use all attached files.'
          }
        },
        required: ['clientName', 'estimateName', 'documentDescription', 'imageIndexes']
      }
    }
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
  {
    type: 'function',
    function: {
      name: 'approve_estimate',
      description: 'Approve an estimate, changing its status to approved. Use this when the user wants to approve, mark approved, or set an estimate as approved. Can specify estimate by ID or by client name.',
      parameters: {
        type: 'object',
        properties: {
          estimateId: {
            type: 'string',
            description: 'The ID of the estimate to approve. If not provided, will try to find by client name.',
          },
          clientName: {
            type: 'string',
            description: 'The client name to find the estimate for (if estimateId not provided)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'convert_estimate_to_project',
      description: 'Convert an estimate into a project. IMPORTANT: If user confirms they want to approve and convert, call this with autoApprove: true - do NOT call approve_estimate separately.',
      parameters: {
        type: 'object',
        properties: {
          estimateId: {
            type: 'string',
            description: 'The ID of the estimate to convert. If not provided, will try to find by client name.',
          },
          clientName: {
            type: 'string',
            description: 'The client name to find the estimate for (if estimateId not provided)',
          },
          autoApprove: {
            type: 'boolean',
            description: 'CRITICAL: Set to true when user wants to approve AND convert in one step. This handles the approval automatically. Use this when: (1) user says "yes" to approve and convert, (2) user says "approve and convert", (3) estimate needs approval and user confirms.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_receipt',
      description: 'Analyze a receipt image attached to the message. Extracts store name, amount, date, and suggests a category. Use this when user attaches a receipt image and wants to create an expense or add an expense.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_expense',
      description: 'Add a new expense to a project. Can be used after analyzing a receipt or with manually provided details. Use this when user wants to add an expense, record a purchase, log a cost, or track spending for a project. Can find projects by project name OR by client name (e.g., "Claudia\'s project" will find the project linked to Claudia).',
      parameters: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'The name of the project OR the client name (e.g., "Claudia\'s project", "home office", "Claudia"). Will search by project name first, then by client name via estimate linkage.',
          },
          expenseType: {
            type: 'string',
            enum: ['Subcontractor', 'Labor', 'Material', 'Office', 'Others'],
            description: 'The type of expense',
          },
          category: {
            type: 'string',
            description: 'The expense category (e.g., Plumbing, Electrical, Lumber). Required for Subcontractor type.',
          },
          amount: {
            type: 'number',
            description: 'The expense amount in dollars',
          },
          store: {
            type: 'string',
            description: 'The store or vendor name',
          },
          date: {
            type: 'string',
            description: 'The expense date in ISO format (optional, defaults to today)',
          },
          receiptImageData: {
            type: 'string',
            description: 'Base64 encoded receipt image data from analyze_receipt (optional)',
          },
        },
        required: ['projectName', 'expenseType', 'amount', 'store'],
      },
    },
  },
];

// Price list categories for expense categorization
const priceListCategories = [
  'Pre-Construction',
  'Foundation and Waterproofing',
  'Storm drainage & footing drainage',
  'Lumber and hardware material',
  'Frame Labor only',
  'Roof material & labor',
  'Windows and exterior doors',
  'Siding',
  'Plumbing',
  'Fire sprinklers',
  'Fire Alarm',
  'Mechanical/HVAC',
  'Electrical',
  'Insulation',
  'Drywall',
  'Flooring & Carpet & Tile',
  'Interior Doors',
  'Mill/Trim Work',
  'Painting',
  'Kitchen',
  'Appliances',
  'Bath Accessories',
  'Landscaping',
  'Concrete Flatwork',
  'Permits and Fees',
  'Cleaning',
  'Other',
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

### Rule 10: Converting Estimates to Projects (CRITICAL)
When user wants to convert an estimate to a project:

**If estimate is not yet approved:**
1. The convert_estimate_to_project tool will tell you the estimate needs approval
2. Ask the user: "This estimate needs to be approved first. Would you like me to approve it and convert to a project?"
3. If user says "Yes", call convert_estimate_to_project with autoApprove: true
4. Do NOT call approve_estimate separately - use autoApprove: true instead

**Example Flow:**
User: "Convert this estimate to a project"
AI: [calls convert_estimate_to_project] -> gets error "must be approved first"
AI: "This estimate needs to be approved first. Would you like me to approve it and convert to a project?"
User: "Yes"
AI: [calls convert_estimate_to_project with autoApprove: true] -> SUCCESS

**What NOT to do:**
- Do NOT call approve_estimate separately then try to call convert_estimate_to_project
- Do NOT say "I'll approve it first..." without using autoApprove: true
- Do NOT wait for another user message after they say "Yes" - call the tool immediately with autoApprove: true

**Direct request to approve and convert:**
User: "Approve and convert this estimate to a project"
AI: [calls convert_estimate_to_project with autoApprove: true immediately]

### Rule 11: Page Context Awareness
When pageContext is provided in CURRENT PAGE CONTEXT, the user is viewing a specific page:
- "this project" = the project in pageContext (e.g., "Project: Kitchen Remodel" means Kitchen Remodel)
- "add expense here" = add to the project in pageContext
- "this client" = extract client from pageContext if available
- "this estimate" = extract estimate from pageContext if available
- Extract entity names from the pageContext string (e.g., "Project: ABC" means project name is "ABC")
- If user says "add expense to this project" and pageContext shows "Project: Kitchen Remodel", add the expense to "Kitchen Remodel" without asking which project

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

### Rule 12: Expense Creation Flow
When user wants to create an expense:

1. If receipt was already analyzed and you show results like "Store: X, Amount: $Y":
   - The receipt data (including image) is stored client-side automatically
   - When user specifies a project, call add_expense with the analyzed details
   - IMPORTANT: Include store, amount, and category from the analysis in the add_expense call
   - The receipt image will be uploaded automatically from stored data

2. If user provides details manually:
   - Ask for missing required fields (project, type, amount, store)
   - Call add_expense with provided data

3. Required fields for expenses:
   - Project name (to link expense to a project)
   - Expense type (Subcontractor, Labor, Material, Office, Others) - defaults to "Material"
   - Amount
   - Store/vendor name

4. Category is only required for "Subcontractor" type expenses

5. If pageContext shows current project (e.g., "Project: Kitchen Remodel"), use that project automatically

**CRITICAL: After Receipt Analysis**
When you showed "I've analyzed the receipt: Store: X, Amount: $Y, Category: Z" and user says which project:
- You MUST call add_expense with: projectName, store, amount, and category from your previous analysis
- Example: If you showed "Store: SiteOne, Amount: $87.25, Category: ELECTRICAL"
  Then call: add_expense(projectName: "user's project", store: "SiteOne", amount: 87.25, category: "ELECTRICAL", expenseType: "Material")

**Example conversation:**
AI: "I've analyzed the receipt:
     - Store: Home Depot
     - Amount: $247.53
     - Category: Lumber and hardware material
     Which project should I add this expense to?"
User: "Kitchen Remodel"
AI: [Calls add_expense with projectName: "Kitchen Remodel", store: "Home Depot", amount: 247.53, category: "Lumber and hardware material", expenseType: "Material"]
AI: "✓ Expense added to Kitchen Remodel: $247.53 at Home Depot"

### Rule 13: Finding Projects by Client Name (CRITICAL)
Projects can be found by EITHER project name OR client name:

- If user says "add to Claudia's project", pass projectName: "Claudia" to add_expense
- If user says "add to the home office project", pass projectName: "home office" to add_expense
- The tool will first search by project name, then by client name via estimate linkage
- Projects are linked to clients through: Project.estimate_id → Estimate.id → Estimate.client_id → Client

**Example:**
User: "Add this expense to Claudia's project"
AI: [Calls add_expense with projectName: "Claudia"]
→ Tool finds client "Claudia", gets her estimates, finds project linked to those estimates
AI: "✓ Expense added to home office (Claudia's project)"

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
async function executeToolCall(
  toolName: string,
  args: any,
  appData: any,
  openai?: OpenAI,
  messages?: any[],
  attachedFiles?: any[]
): Promise<{ result: any; actionRequired?: string; actionData?: any }> {
  const { projects = [], clients = [], expenses = [], estimates = [], payments = [], clockEntries = [], company } = appData;

  // Log data counts for debugging expense queries
  if (toolName === 'query_expenses' || toolName === 'generate_report') {
    console.log(`[AI Assistant] executeToolCall "${toolName}" - Data counts: ${projects.length} projects, ${clients.length} clients, ${expenses.length} expenses, ${estimates.length} estimates`);
  }

  switch (toolName) {
    case 'query_projects': {
      // First, enrich ALL projects with client information via estimate linkage
      const allEnrichedProjects = projects.map((p: any) => {
        let clientName = null;
        let clientId = null;
        if (p.estimateId) {
          const linkedEstimate = estimates.find((e: any) => e.id === p.estimateId);
          if (linkedEstimate?.clientId) {
            const linkedClient = clients.find((c: any) => c.id === linkedEstimate.clientId);
            if (linkedClient) {
              clientName = linkedClient.name;
              clientId = linkedClient.id;
            }
          }
        }
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          budget: p.budget,
          expenses: p.expenses,
          progress: p.progress,
          estimateId: p.estimateId,
          clientName,
          clientId,
        };
      });

      let filtered = allEnrichedProjects;

      // Filter by project name
      if (args.projectName) {
        filtered = filtered.filter((p: any) =>
          p.name?.toLowerCase().includes(args.projectName.toLowerCase())
        );
      }

      // Filter by client name (finds projects linked to matching clients)
      if (args.clientName) {
        const searchName = args.clientName.toLowerCase();
        filtered = filtered.filter((p: any) =>
          p.clientName?.toLowerCase().includes(searchName)
        );
      }

      // Filter by status
      if (args.status) {
        filtered = filtered.filter((p: any) => p.status === args.status);
      }

      return {
        result: {
          count: filtered.length,
          projects: filtered,
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
      console.log(`[AI Assistant] query_expenses called with args:`, JSON.stringify(args));
      console.log(`[AI Assistant] Total expenses in appData: ${expenses.length}`);
      console.log(`[AI Assistant] Total projects in appData: ${projects.length}`);
      console.log(`[AI Assistant] Sample expense projectIds:`, expenses.slice(0, 5).map((e: any) => ({ id: e.id?.substring(0, 8), projectId: e.projectId })));

      let filtered = expenses;
      let projectFound = null;

      if (args.projectId) {
        filtered = filtered.filter((e: any) => e.projectId === args.projectId);
        console.log(`[AI Assistant] After projectId filter: ${filtered.length} expenses`);
      }
      if (args.projectName) {
        console.log(`[AI Assistant] Searching for project by name: "${args.projectName}"`);

        // First try to find by project name
        projectFound = projects.find((p: any) =>
          p.name?.toLowerCase().includes(args.projectName.toLowerCase())
        );
        console.log(`[AI Assistant] Direct project name match: ${projectFound ? projectFound.name : 'none'}`);

        // If not found by project name, try to find by client name via estimate linkage
        if (!projectFound) {
          const matchingClient = clients.find((c: any) =>
            c.name?.toLowerCase().includes(args.projectName.toLowerCase())
          );
          console.log(`[AI Assistant] Client name match: ${matchingClient ? matchingClient.name : 'none'}`);

          if (matchingClient) {
            const clientEstimates = estimates.filter((e: any) => e.clientId === matchingClient.id);
            console.log(`[AI Assistant] Found ${clientEstimates.length} estimates for client ${matchingClient.name}`);
            const clientEstimateIds = clientEstimates.map((e: any) => e.id);
            console.log(`[AI Assistant] Client estimate IDs:`, clientEstimateIds);

            projectFound = projects.find((p: any) =>
              p.estimateId && clientEstimateIds.includes(p.estimateId)
            );
            if (projectFound) {
              console.log(`[AI Assistant] Found project "${projectFound.name}" (ID: ${projectFound.id}) for client "${matchingClient.name}" via estimate linkage`);
            } else {
              console.log(`[AI Assistant] No project found via estimate linkage. Projects with estimateIds:`, projects.filter((p: any) => p.estimateId).map((p: any) => ({ name: p.name, estimateId: p.estimateId })));
            }
          }
        }

        if (projectFound) {
          console.log(`[AI Assistant] Filtering expenses for projectId: ${projectFound.id}`);
          const beforeFilter = filtered.length;
          filtered = filtered.filter((e: any) => e.projectId === projectFound.id);
          console.log(`[AI Assistant] Filtered from ${beforeFilter} to ${filtered.length} expenses`);
          if (filtered.length === 0) {
            console.log(`[AI Assistant] All expense projectIds:`, expenses.map((e: any) => e.projectId));
          }
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
          projectName: projectFound?.name,
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
      console.log(`[AI Assistant] generate_report called with args:`, JSON.stringify(args));

      // Helper function to find project by name or client name
      const findProjectByNameOrClient = (searchName: string) => {
        // First try to find by project name
        let projectFound = projects.find((p: any) =>
          p.name?.toLowerCase().includes(searchName.toLowerCase())
        );

        // If not found by project name, try to find by client name via estimate linkage
        if (!projectFound) {
          const matchingClient = clients.find((c: any) =>
            c.name?.toLowerCase().includes(searchName.toLowerCase())
          );
          if (matchingClient) {
            const clientEstimates = estimates.filter((e: any) => e.clientId === matchingClient.id);
            const clientEstimateIds = clientEstimates.map((e: any) => e.id);
            projectFound = projects.find((p: any) =>
              p.estimateId && clientEstimateIds.includes(p.estimateId)
            );
            if (projectFound) {
              console.log(`[AI Assistant] Found project "${projectFound.name}" for client "${matchingClient.name}"`);
            }
          }
        }
        return projectFound;
      };

      // Find the project first
      const project = args.projectName ? findProjectByNameOrClient(args.projectName) : null;

      if (!project && args.reportType !== 'custom') {
        return {
          result: {
            error: `Could not find a project for "${args.projectName}". Please specify a valid project name or client name.`,
          },
        };
      }

      let reportData: any = {};

      switch (args.reportType) {
        case 'administrative': {
          // Admin & Financial Report - matches project/[id].tsx logic
          const projectClockEntries = clockEntries.filter((entry: any) => entry.projectId === project.id);
          const projectExpenses = expenses.filter((e: any) => e.projectId === project.id);

          const expensesByCategory: { [category: string]: number } = {};
          projectExpenses.forEach((expense: any) => {
            const category = expense.type || 'Uncategorized';
            expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
          });

          const totalExpenses = projectExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
          const totalLaborHours = projectClockEntries.reduce((sum: number, entry: any) => {
            if (!entry.clockOut) return sum;
            const hours = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0);

          // Get change orders for adjusted budget (if available)
          const { changeOrders = [] } = appData;
          const projectChangeOrders = changeOrders.filter((co: any) => co.projectId === project.id && co.status === 'approved');
          const totalChangeOrdersApproved = projectChangeOrders.reduce((sum: number, co: any) => sum + (co.amount || 0), 0);
          const adjustedBudget = (project.budget || 0) + totalChangeOrdersApproved;

          const projectReportData = {
            projectId: project.id,
            projectName: project.name,
            budget: project.budget || 0,
            expenses: totalExpenses,
            hoursWorked: totalLaborHours,
            clockEntries: projectClockEntries.length,
            status: project.status,
            progress: project.progress || 0,
            startDate: project.startDate,
            endDate: project.endDate,
            expensesByCategory,
          };

          reportData = {
            reportType: 'administrative',
            reportName: `Admin & Financial Report - ${project.name}`,
            projectIds: [project.id],
            projectsCount: 1,
            totalBudget: adjustedBudget,
            totalExpenses,
            totalHours: totalLaborHours,
            projects: [projectReportData],
            expensesByCategory,
            // Summary for AI response
            summary: {
              projectName: project.name,
              budget: adjustedBudget,
              expenses: totalExpenses,
              profit: adjustedBudget - totalExpenses,
              laborHours: Math.round(totalLaborHours * 100) / 100,
              expenseCount: projectExpenses.length,
            },
          };
          break;
        }

        case 'expenses': {
          // Expenses Report - matches project/[id].tsx logic
          const projectExpenses = expenses.filter((e: any) => e.projectId === project.id);

          const expensesByCategory: { [category: string]: number } = {};
          projectExpenses.forEach((expense: any) => {
            const category = expense.type || 'Uncategorized';
            expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
          });

          const totalExpenses = projectExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);

          const projectReportData = {
            projectId: project.id,
            projectName: project.name,
            budget: project.budget || 0,
            expenses: totalExpenses,
            hoursWorked: project.hoursWorked || 0,
            clockEntries: 0,
            status: project.status,
            progress: project.progress || 0,
            startDate: project.startDate,
            endDate: project.endDate,
            expensesByCategory,
          };

          reportData = {
            reportType: 'expenses',
            reportName: `Expenses Report - ${project.name}`,
            projectIds: [project.id],
            projectsCount: 1,
            totalExpenses,
            projects: [projectReportData],
            expensesByCategory,
            // Summary for AI response
            summary: {
              projectName: project.name,
              totalExpenses,
              expenseCount: projectExpenses.length,
              categories: expensesByCategory,
              expenses: projectExpenses.map((e: any) => ({
                type: e.type,
                subcategory: e.subcategory,
                amount: e.amount,
                store: e.store,
                date: e.date,
              })),
            },
          };
          break;
        }

        case 'time-tracking': {
          // Time Tracking Report - matches project/[id].tsx logic
          const projectClockEntries = clockEntries.filter((entry: any) => entry.projectId === project.id);

          const employeeDataMap: { [employeeId: string]: any } = {};

          projectClockEntries.forEach((entry: any) => {
            if (!employeeDataMap[entry.employeeId]) {
              employeeDataMap[entry.employeeId] = {
                employeeId: entry.employeeId,
                employeeName: entry.employeeName || `Employee ${entry.employeeId.slice(0, 8)}`,
                totalHours: 0,
                regularHours: 0,
                overtimeHours: 0,
                totalDays: 0,
                averageHoursPerDay: 0,
                clockEntries: [],
              };
            }

            if (entry.clockOut) {
              const hours = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / (1000 * 60 * 60);
              employeeDataMap[entry.employeeId].totalHours += hours;

              if (hours > 8) {
                employeeDataMap[entry.employeeId].regularHours += 8;
                employeeDataMap[entry.employeeId].overtimeHours += (hours - 8);
              } else {
                employeeDataMap[entry.employeeId].regularHours += hours;
              }

              employeeDataMap[entry.employeeId].clockEntries.push(entry);
            }
          });

          const employeeData = Object.values(employeeDataMap).map((emp: any) => ({
            ...emp,
            totalDays: emp.clockEntries.length,
            averageHoursPerDay: emp.totalHours / (emp.clockEntries.length || 1),
            clockEntries: undefined, // Don't include full entries in report
          }));

          const totalHours = employeeData.reduce((sum: number, emp: any) => sum + emp.totalHours, 0);

          reportData = {
            reportType: 'time-tracking',
            reportName: `Time Tracking Report - ${project.name}`,
            projectIds: [project.id],
            projectsCount: 1,
            totalHours,
            employeeData,
            employeeIds: employeeData.map((emp: any) => emp.employeeId),
            // Summary for AI response
            summary: {
              projectName: project.name,
              totalHours: Math.round(totalHours * 100) / 100,
              employeeCount: employeeData.length,
              employees: employeeData.map((emp: any) => ({
                name: emp.employeeName,
                totalHours: Math.round(emp.totalHours * 100) / 100,
                regularHours: Math.round(emp.regularHours * 100) / 100,
                overtimeHours: Math.round(emp.overtimeHours * 100) / 100,
                daysWorked: emp.totalDays,
              })),
            },
          };
          break;
        }

        case 'daily-logs': {
          // Daily Logs Report - matches project/[id].tsx logic
          const { dailyLogs = [] } = appData;
          const projectLogs = dailyLogs.filter((log: any) => log.projectId === project.id);

          if (projectLogs.length === 0) {
            return {
              result: {
                error: `No daily logs found for project "${project.name}". Daily logs need to be created first.`,
              },
            };
          }

          reportData = {
            reportType: 'custom', // Daily logs are saved as 'custom' type
            reportName: `Daily Logs - ${project.name}`,
            projectIds: [project.id],
            projectsCount: 1,
            notes: JSON.stringify({
              dailyLogs: [{
                projectId: project.id,
                projectName: project.name,
                logs: projectLogs,
              }],
            }),
            // Summary for AI response
            summary: {
              projectName: project.name,
              logCount: projectLogs.length,
              logs: projectLogs.map((log: any) => ({
                date: log.date,
                workPerformed: log.workPerformed,
                issues: log.issues,
                notes: log.notes,
              })),
            },
          };
          break;
        }

        case 'custom': {
          // Custom AI Report - let the AI generate analysis
          const projectClockEntries = project ? clockEntries.filter((entry: any) => entry.projectId === project.id) : clockEntries;
          const projectExpenses = project ? expenses.filter((e: any) => e.projectId === project.id) : expenses;
          const { dailyLogs = [] } = appData;
          const projectLogs = project ? dailyLogs.filter((log: any) => log.projectId === project.id) : dailyLogs;

          const totalExpenses = projectExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
          const totalHours = projectClockEntries.reduce((sum: number, entry: any) => {
            if (!entry.clockOut) return sum;
            return sum + (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / (1000 * 60 * 60);
          }, 0);

          reportData = {
            reportType: 'custom',
            reportName: `Custom Report - ${project?.name || 'All Projects'}`,
            projectIds: project ? [project.id] : [],
            projectsCount: project ? 1 : projects.length,
            totalExpenses,
            totalHours,
            notes: `Custom report generated by AI Assistant.\nPrompt: ${args.customPrompt || 'General analysis'}`,
            // Summary for AI response
            summary: {
              projectName: project?.name || 'All Projects',
              prompt: args.customPrompt,
              data: {
                expenses: projectExpenses.length,
                totalExpenses,
                clockEntries: projectClockEntries.length,
                totalHours: Math.round(totalHours * 100) / 100,
                dailyLogs: projectLogs.length,
              },
            },
          };
          break;
        }
      }

      return {
        result: {
          message: `Report generated and will be saved: "${reportData.reportName}"`,
          summary: reportData.summary,
        },
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

    case 'generate_takeoff_estimate': {
      console.log('[Tool] generate_takeoff_estimate called:', {
        clientName: args.clientName,
        estimateName: args.estimateName,
        documentDescription: args.documentDescription,
        imageIndexes: args.imageIndexes,
        attachedFilesCount: attachedFiles?.length || 0
      });

      // Validate images are attached
      if (!attachedFiles || attachedFiles.length === 0) {
        return {
          result: {
            error: 'No images or PDFs attached. Please attach a construction document first.'
          }
        };
      }

      // Validate image indexes
      const invalidIndexes = args.imageIndexes.filter((idx: number) =>
        idx < 0 || idx >= attachedFiles.length
      );
      if (invalidIndexes.length > 0) {
        return {
          result: {
            error: `Invalid image indexes: ${invalidIndexes.join(', ')}. Only ${attachedFiles.length} files attached.`
          }
        };
      }

      // Get selected files
      const selectedFiles = args.imageIndexes.map((idx: number) => attachedFiles[idx]);
      console.log('[Tool] Analyzing files:', selectedFiles.map((f: any) => f.name));

      return {
        result: {
          success: true,
          message: `Analyzing ${selectedFiles.length} document(s) for "${args.estimateName}"...`,
          clientName: args.clientName,
          estimateName: args.estimateName,
          documentDescription: args.documentDescription,
          fileCount: selectedFiles.length
        },
        actionRequired: 'generate_takeoff_estimate',
        actionData: {
          clientName: args.clientName,
          estimateName: args.estimateName,
          documentDescription: args.documentDescription,
          selectedFiles: selectedFiles.map((f: any) => ({
            uri: f.uri,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size
          }))
        }
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

    case 'approve_estimate': {
      // Find estimate by ID or by client name
      let estimate: any = null;
      let client: any = null;

      if (args.estimateId) {
        // Direct lookup by estimate ID
        estimate = estimates.find((e: any) => e.id === args.estimateId);
        if (!estimate) {
          return { result: { error: 'Estimate not found with that ID' } };
        }
        client = clients.find((c: any) => c.id === estimate.clientId);
      } else if (args.clientName) {
        // Find by client name
        const clientResult = findClientByName(clients, args.clientName);

        if (clientResult.error) {
          return { result: { error: clientResult.error } };
        }

        if (clientResult.multiple) {
          return { result: clientResult };
        }

        client = clientResult.client;

        // Get client's estimates that are not already approved
        const clientEstimates = estimates.filter((e: any) =>
          e.clientId === client.id && e.status !== 'approved' && e.status !== 'paid'
        );

        if (clientEstimates.length === 0) {
          // Check if they have any estimates at all
          const allClientEstimates = estimates.filter((e: any) => e.clientId === client.id);
          if (allClientEstimates.length === 0) {
            return { result: { error: `${client.name} has no estimates` } };
          }
          return { result: { error: `${client.name} has no estimates that need approval (all are already approved or paid)` } };
        }

        if (clientEstimates.length === 1) {
          estimate = clientEstimates[0];
        } else {
          // Multiple estimates - list them for user to choose
          return {
            result: {
              message: `${client.name} has ${clientEstimates.length} estimates that can be approved. Which one?`,
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
      } else {
        return { result: { error: 'Please specify the estimate ID or client name' } };
      }

      // Check if estimate is already approved
      if (estimate.status === 'approved') {
        return { result: { message: `"${estimate.name}" is already approved` } };
      }

      // Return action to approve the estimate
      return {
        result: {
          success: true,
          message: `Approving "${estimate.name}" for ${client?.name || 'client'}`,
          estimateId: estimate.id,
          estimateName: estimate.name,
          clientName: client?.name,
        },
        actionRequired: 'approve_estimate',
        actionData: {
          estimateId: estimate.id,
          estimateName: estimate.name,
          clientId: client?.id,
          clientName: client?.name,
        },
      };
    }

    case 'convert_estimate_to_project': {
      // Find estimate by ID or by client name
      let estimate: any = null;
      let client: any = null;
      const autoApprove = args.autoApprove === true;

      if (args.estimateId) {
        // Direct lookup by estimate ID
        estimate = estimates.find((e: any) => e.id === args.estimateId);
        if (!estimate) {
          return { result: { error: 'Estimate not found with that ID' } };
        }
        client = clients.find((c: any) => c.id === estimate.clientId);
      } else if (args.clientName) {
        // Find by client name
        const clientResult = findClientByName(clients, args.clientName);

        if (clientResult.error) {
          return { result: { error: clientResult.error } };
        }

        if (clientResult.multiple) {
          return { result: clientResult };
        }

        client = clientResult.client;

        // Get client's estimates - if autoApprove is true, include non-approved estimates
        const clientEstimates = autoApprove
          ? estimates.filter((e: any) => e.clientId === client.id && e.status !== 'paid')
          : estimates.filter((e: any) => e.clientId === client.id && e.status === 'approved');

        if (clientEstimates.length === 0) {
          // Check if they have any estimates at all
          const allClientEstimates = estimates.filter((e: any) => e.clientId === client.id);
          if (allClientEstimates.length === 0) {
            return { result: { error: `${client.name} has no estimates` } };
          }
          if (!autoApprove) {
            // Check if there are unapproved estimates
            const unapprovedEstimates = allClientEstimates.filter((e: any) => e.status !== 'approved');
            if (unapprovedEstimates.length > 0) {
              return { result: { error: `${client.name} has no approved estimates. Please approve an estimate first before converting to a project.` } };
            }
          }
          return { result: { error: `${client.name} has no estimates available to convert` } };
        }

        if (clientEstimates.length === 1) {
          estimate = clientEstimates[0];
        } else {
          // Multiple estimates - list them for user to choose
          const statusText = autoApprove ? '' : 'approved ';
          return {
            result: {
              message: `${client.name} has ${clientEstimates.length} ${statusText}estimates. Which one would you like to convert to a project?`,
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
      } else {
        return { result: { error: 'Please specify the estimate ID or client name' } };
      }

      // Check if estimate needs approval
      const needsApproval = estimate.status !== 'approved';
      if (needsApproval && !autoApprove) {
        return {
          result: {
            needsApproval: true,
            estimateId: estimate.id,
            estimateName: estimate.name,
            clientName: client?.name,
            message: `"${estimate.name}" needs to be approved first (current status: ${estimate.status}). Ask the user if they want to approve and convert, then call this tool again with autoApprove: true.`
          }
        };
      }

      // Return action to convert estimate to project
      const approvalMessage = needsApproval ? `Approving and converting "${estimate.name}"` : `Converting "${estimate.name}"`;
      return {
        result: {
          success: true,
          message: `${approvalMessage} to a project for ${client?.name || 'client'}`,
          estimateId: estimate.id,
          estimateName: estimate.name,
          clientName: client?.name,
          budget: estimate.total,
          needsApproval,
        },
        actionRequired: 'convert_estimate_to_project',
        actionData: {
          estimateId: estimate.id,
          estimateName: estimate.name,
          clientId: client?.id,
          clientName: client?.name,
          budget: estimate.total,
          clientAddress: client?.address,
          needsApproval,
        },
      };
    }

    case 'analyze_receipt': {
      // Get the latest message's image file
      const latestMsg = messages[messages.length - 1];
      const imageFile = latestMsg?.files?.find((f: any) => f.mimeType?.startsWith('image/') || f.uri?.startsWith('data:image'));

      if (!imageFile) {
        return { result: { error: 'No receipt image found. Please attach a receipt image first, then ask me to analyze it.' } };
      }

      console.log('[AI Assistant] Analyzing receipt image...');

      try {
        // Use GPT-4o vision to analyze the receipt
        const analysisResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: imageFile.uri } },
                {
                  type: 'text',
                  text: `Analyze this receipt image and extract the following information. Return ONLY a valid JSON object with these fields:
{
  "store": "store or vendor name",
  "amount": numeric total amount (just the number, no currency symbol),
  "date": "date in ISO format if visible, otherwise null",
  "category": "one of: ${priceListCategories.join(', ')}",
  "items": "brief description of items purchased",
  "confidence": confidence level 0-100
}

Based on the store and items, intelligently categorize this expense:
- Hardware stores (Home Depot, Lowe's) → categorize by what was purchased (lumber, electrical, plumbing, etc.)
- Material suppliers → specific material categories
- Service providers → appropriate service category
- Office/general supplies → Pre-Construction or Other`,
                },
              ],
            },
          ],
          max_tokens: 500,
        });

        const responseContent = analysisResponse.choices[0]?.message?.content || '{}';

        // Parse the JSON from the response
        let analysis: any = {};
        try {
          // Try to extract JSON from the response
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('[AI Assistant] Failed to parse receipt analysis:', parseError);
          return { result: { error: 'Failed to parse receipt data. Please try again or enter details manually.' } };
        }

        console.log('[AI Assistant] Receipt analyzed:', analysis);

        return {
          result: {
            success: true,
            analysis: {
              store: analysis.store || 'Unknown Store',
              amount: analysis.amount || 0,
              date: analysis.date || new Date().toISOString(),
              category: analysis.category || 'Other',
              items: analysis.items || '',
              confidence: analysis.confidence || 70,
            },
            imageData: imageFile.uri, // Pass through for later S3 upload
            message: `Receipt analyzed:\n- Store: ${analysis.store}\n- Amount: $${analysis.amount}\n- Category: ${analysis.category}\n${analysis.items ? `- Items: ${analysis.items}\n` : ''}\nWhich project should I add this expense to?`,
          },
        };
      } catch (error: any) {
        console.error('[AI Assistant] Receipt analysis error:', error);
        return { result: { error: `Failed to analyze receipt: ${error.message}. Please try again or enter details manually.` } };
      }
    }

    case 'add_expense': {
      console.log('[AI Assistant] add_expense called with projectName:', args.projectName);
      console.log('[AI Assistant] Available projects:', projects.map((p: any) => ({ id: p.id, name: p.name, estimateId: p.estimateId })));
      console.log('[AI Assistant] Available clients (first 5):', clients.slice(0, 5).map((c: any) => ({ id: c.id, name: c.name })));
      console.log('[AI Assistant] Available estimates (first 5):', estimates.slice(0, 5).map((e: any) => ({ id: e.id, clientId: e.clientId })));

      // Find project by name OR by client name (via estimate linkage)
      let project = projects.find((p: any) =>
        p.name?.toLowerCase().includes(args.projectName?.toLowerCase() || '')
      );

      // If not found by project name, try to find by client name
      // Projects are linked to clients via estimate_id -> estimates -> client_id
      if (!project && args.projectName) {
        const searchName = args.projectName.toLowerCase();
        console.log('[AI Assistant] Project not found by name, searching by client name:', searchName);

        // Check if the search term matches a client name
        const matchingClient = clients.find((c: any) =>
          c.name?.toLowerCase().includes(searchName)
        );
        console.log('[AI Assistant] Matching client:', matchingClient ? { id: matchingClient.id, name: matchingClient.name } : 'none');

        if (matchingClient) {
          // Find estimates for this client
          const clientEstimates = estimates.filter((e: any) => e.clientId === matchingClient.id);
          console.log('[AI Assistant] Client estimates:', clientEstimates.map((e: any) => ({ id: e.id, clientId: e.clientId })));
          const clientEstimateIds = clientEstimates.map((e: any) => e.id);

          // Find project linked to any of this client's estimates
          project = projects.find((p: any) =>
            p.estimateId && clientEstimateIds.includes(p.estimateId)
          );

          if (project) {
            console.log(`[AI Assistant] Found project "${project.name}" for client "${matchingClient.name}" via estimate linkage`);
          } else {
            console.log('[AI Assistant] No project found with estimateId in:', clientEstimateIds);
            console.log('[AI Assistant] Projects with estimateIds:', projects.filter((p: any) => p.estimateId).map((p: any) => ({ name: p.name, estimateId: p.estimateId })));
          }
        }
      }

      if (!project) {
        // List available projects with their linked clients for clarity
        const activeProjects = projects.filter((p: any) => p.status === 'active');
        if (activeProjects.length === 0) {
          return { result: { error: 'No active projects found. Please create a project first.' } };
        }

        // Get client names for each project via estimate linkage
        const projectsWithClients = activeProjects.map((p: any) => {
          let clientName = '';
          if (p.estimateId) {
            const linkedEstimate = estimates.find((e: any) => e.id === p.estimateId);
            if (linkedEstimate?.clientId) {
              const linkedClient = clients.find((c: any) => c.id === linkedEstimate.clientId);
              clientName = linkedClient?.name || '';
            }
          }
          return { ...p, clientName };
        });

        return {
          result: {
            error: `Project not found: "${args.projectName}"`,
            availableProjects: projectsWithClients.map((p: any) => p.clientName ? `${p.name} (${p.clientName})` : p.name),
            message: `I couldn't find a project called "${args.projectName}". Here are your active projects:\n${projectsWithClients.map((p: any, i: number) => `${i + 1}. ${p.name}${p.clientName ? ` (${p.clientName}'s project)` : ''}`).join('\n')}\n\nWhich project should I add the expense to?`,
          },
        };
      }

      // Validate required fields
      if (!args.amount || args.amount <= 0) {
        return { result: { error: 'Please specify a valid expense amount.' } };
      }

      if (!args.store) {
        return { result: { error: 'Please specify the store or vendor name.' } };
      }

      // Return action to create expense
      const formattedAmount = typeof args.amount === 'number' ? args.amount.toFixed(2) : args.amount;

      return {
        result: {
          success: true,
          message: `Adding ${args.expenseType} expense: $${formattedAmount} at ${args.store} to ${project.name}`,
        },
        actionRequired: 'add_expense',
        actionData: {
          projectId: project.id,
          projectName: project.name,
          type: args.expenseType || 'Material',
          subcategory: args.category || args.expenseType || 'Material',
          amount: args.amount,
          store: args.store,
          date: args.date || new Date().toISOString(),
          receiptImageData: args.receiptImageData || null,
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
    const { messages, appData, pageContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('[AI Assistant] Processing request with', messages.length, 'messages');
    console.log('[AI Assistant] Page context:', pageContext || 'none');
    console.log('[AI Assistant] App data:', {
      projects: appData?.projects?.length || 0,
      clients: appData?.clients?.length || 0,
      expenses: appData?.expenses?.length || 0,
      estimates: appData?.estimates?.length || 0,
    });

    // Extract attached files from messages
    const attachedFiles: any[] = [];
    for (const msg of messages) {
      if (msg.files && Array.isArray(msg.files)) {
        attachedFiles.push(...msg.files);
      }
    }
    console.log('[AI Assistant] Attached files:', attachedFiles.length, attachedFiles.map((f: any) => ({ name: f.name, mimeType: f.mimeType, uri: f.uri?.substring(0, 50) })));

    // Build context-aware system prompt
    let contextAwarePrompt = systemPrompt;

    // Add file attachment context if files are present
    if (attachedFiles.length > 0) {
      contextAwarePrompt += `

## ATTACHED FILES
The user has attached ${attachedFiles.length} file(s) to this conversation:
${attachedFiles.map((f: any, idx: number) => `${idx + 1}. ${f.name || 'Unknown'} (${f.mimeType || 'unknown type'})`).join('\n')}

You can see these files in the conversation. When the user asks you to analyze documents, generate takeoff estimates, or work with attached files, use the appropriate tools with the correct file indexes.`;
    }

    if (pageContext) {
      contextAwarePrompt += `

## CURRENT PAGE CONTEXT
The user is currently viewing: ${pageContext}

When the user says "this project", "this client", "this estimate", etc., they are referring to the item described above. Use this context to resolve ambiguous references like "add expense to this project" or "what's the budget for this project".`;
    }

    // Build OpenAI messages
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: contextAwarePrompt },
    ];

    // Add user/assistant messages with file support
    for (const msg of messages) {
      const messageText = msg.text || msg.content || '';

      if (msg.role === 'user' && msg.files && msg.files.length > 0) {
        // User message with attachments - build content array
        const contentParts: any[] = [
          { type: 'text', text: messageText }
        ];

        // Add file attachments
        for (const file of msg.files) {
          if (file.uri) {
            // For images with data URIs, use image_url type
            if (file.uri.startsWith('data:image')) {
              contentParts.push({
                type: 'image_url',
                image_url: { url: file.uri }
              });
            }
            // For S3 URLs (images or PDFs), include as image_url
            else if (file.uri.startsWith('http')) {
              contentParts.push({
                type: 'image_url',
                image_url: { url: file.uri }
              });
            }
          }
        }

        console.log('[AI Assistant] Adding user message with', contentParts.length, 'content parts');
        openaiMessages.push({
          role: 'user',
          content: contentParts
        });
      } else if (messageText) {
        // Regular text-only message (skip empty messages)
        openaiMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: messageText,
        });
      }
    }

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
        const toolResult = await executeToolCall(tc.function.name, args, appData || {}, openai, messages, attachedFiles);

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
