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

// Helper function to parse natural language dates
function parseNaturalDate(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const lowerDate = dateStr.toLowerCase().trim();

  // Handle common phrases
  if (lowerDate === 'today') {
    return todayStr;
  }
  if (lowerDate === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  if (lowerDate === 'next week') {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  }

  // Handle "next monday", "next friday", etc.
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const nextMatch = lowerDate.match(/next\s+(\w+)/);
  if (nextMatch) {
    const targetDay = dayNames.indexOf(nextMatch[1].toLowerCase());
    if (targetDay !== -1) {
      const result = new Date(today);
      const currentDay = result.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      result.setDate(result.getDate() + daysToAdd);
      return result.toISOString().split('T')[0];
    }
  }

  // Handle "in X days"
  const inDaysMatch = lowerDate.match(/in\s+(\d+)\s+days?/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1]);
    const result = new Date(today);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  }

  // Handle ordinal dates like "10th", "20th" (assumes current month)
  const ordinalMatch = lowerDate.match(/(\d+)(st|nd|rd|th)/);
  if (ordinalMatch) {
    const day = parseInt(ordinalMatch[1]);
    const result = new Date(today.getFullYear(), today.getMonth(), day);
    // If the date has passed this month, use next month
    if (result < today) {
      result.setMonth(result.getMonth() + 1);
    }
    return result.toISOString().split('T')[0];
  }

  // If it's already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try to parse as a date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  // Default to tomorrow if can't parse
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// Helper function to parse natural language times
function parseNaturalTime(timeStr: string): string {
  if (!timeStr) return '09:00'; // Default to 9 AM

  const lowerTime = timeStr.toLowerCase().trim();

  // Handle common phrases
  if (lowerTime === 'morning' || lowerTime === 'in the morning') {
    return '09:00';
  }
  if (lowerTime === 'noon' || lowerTime === 'midday') {
    return '12:00';
  }
  if (lowerTime === 'afternoon' || lowerTime === 'in the afternoon') {
    return '14:00';
  }
  if (lowerTime === 'evening' || lowerTime === 'in the evening') {
    return '18:00';
  }
  if (lowerTime === 'night' || lowerTime === 'tonight') {
    return '20:00';
  }
  if (lowerTime === 'end of day' || lowerTime === 'eod' || lowerTime === 'close of business' || lowerTime === 'cob') {
    return '17:00';
  }

  // Handle "Xam" or "Xpm" format (e.g., "9am", "3pm", "10am")
  const ampmMatch = lowerTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1]);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0;
    const isPM = ampmMatch[3] === 'pm';

    if (isPM && hours !== 12) {
      hours += 12;
    } else if (!isPM && hours === 12) {
      hours = 0;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Handle "X:XX am/pm" format (e.g., "9:30 am", "2:30 pm")
  const ampmWithColonMatch = lowerTime.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (ampmWithColonMatch) {
    let hours = parseInt(ampmWithColonMatch[1]);
    const minutes = parseInt(ampmWithColonMatch[2]);
    const isPM = ampmWithColonMatch[3] === 'pm';

    if (isPM && hours !== 12) {
      hours += 12;
    } else if (!isPM && hours === 12) {
      hours = 0;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Handle 24-hour format "HH:MM" (e.g., "14:30", "09:00")
  const militaryMatch = lowerTime.match(/^(\d{1,2}):(\d{2})$/);
  if (militaryMatch) {
    const hours = parseInt(militaryMatch[1]);
    const minutes = parseInt(militaryMatch[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  // Handle just hour in 24-hour format (e.g., "14" -> "14:00")
  const hourOnlyMatch = lowerTime.match(/^(\d{1,2})$/);
  if (hourOnlyMatch) {
    const hours = parseInt(hourOnlyMatch[1]);
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, '0')}:00`;
    }
  }

  // Default to 9 AM if can't parse
  return '09:00';
}

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
      description: 'CRITICAL: Use this tool IMMEDIATELY when user asks to create/generate a takeoff estimate AND has files attached. DO NOT ask for more information - just call this tool with the client name and all attached file indexes. The system will automatically analyze the attached documents (PDFs or images) to extract materials and quantities. NEVER ask user to "attach files" or "provide documents" - if they requested a takeoff estimate, the files are ALREADY attached.',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'Name of the client/customer for this estimate'
          },
          estimateName: {
            type: 'string',
            description: 'Descriptive name for this takeoff estimate. OPTIONAL - if not provided, will auto-generate from client name and document (e.g., "Takeoff Estimate - [ClientName]")'
          },
          documentDescription: {
            type: 'string',
            description: 'Brief description of what the document shows. OPTIONAL - if not provided, AI will analyze the document to determine the content'
          },
          imageIndexes: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of indexes (0-based) of attached images/PDFs to analyze. DEFAULT to [0] if only one file attached. Use [0,1,2...] for multiple files. When user says "create takeoff estimate" with files attached, use all files: get indexes from attachedFiles.length'
          }
        },
        required: ['clientName']
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
      name: 'create_change_order',
      description: 'Create a new change order for a project. Use when client requests additional work or scope changes.',
      parameters: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'The name of the project',
          },
          description: {
            type: 'string',
            description: 'Description of the additional work',
          },
          amount: {
            type: 'number',
            description: 'Dollar amount for the change order',
          },
          notes: {
            type: 'string',
            description: 'Optional additional notes',
          },
        },
        required: ['projectName', 'description', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_change_order',
      description: 'Approve a pending change order. This will update the project budget.',
      parameters: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'The project name',
          },
          changeOrderId: {
            type: 'string',
            description: 'The ID of the change order to approve',
          },
        },
        required: ['projectName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reject_change_order',
      description: 'Reject a pending change order.',
      parameters: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'The project name',
          },
          changeOrderId: {
            type: 'string',
            description: 'The ID of the change order to reject',
          },
          reason: {
            type: 'string',
            description: 'Optional reason for rejection',
          },
        },
        required: ['projectName'],
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
      name: 'send_subcontractor_invitation',
      description: 'Send an invitation email to a subcontractor with a registration link. Use when user wants to "send an invite to a subcontractor", "invite a new sub", or "send subcontractor registration link".',
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
      name: 'send_estimate_request',
      description: 'Send an estimate request email to a subcontractor for a specific project. Use when user says "send estimate request", "request estimate from [subcontractor]", "ask [subcontractor] for estimate". If user uploads files in the conversation, extract their URLs and pass them in fileUrls parameter.',
      parameters: {
        type: 'object',
        properties: {
          subcontractorName: {
            type: 'string',
            description: 'Name of the subcontractor to send the request to',
          },
          projectName: {
            type: 'string',
            description: 'Name of the project for the estimate request',
          },
          description: {
            type: 'string',
            description: 'Description of work or scope for the estimate',
          },
          notes: {
            type: 'string',
            description: 'Additional notes or requirements (budget, timeline, etc.)',
          },
          fileUrls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'File name',
                },
                url: {
                  type: 'string',
                  description: 'File URL (uploaded S3 link)',
                },
              },
            },
            description: 'Array of file attachments with name and URL from user uploads',
          },
        },
        required: ['subcontractorName', 'projectName', 'description'],
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
  // ============================================
  // PROJECT MANAGEMENT TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'create_project',
      description: 'Create a new project. Use when user wants to start a new project, create a project, or set up a new job.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Project name (required)' },
          budget: { type: 'number', description: 'Project budget in dollars (required)' },
          clientName: { type: 'string', description: 'Client name to link (optional)' },
          address: { type: 'string', description: 'Project address (optional)' },
          startDate: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
        },
        required: ['name', 'budget'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_project',
      description: 'Update project details like budget, status, progress, or dates. Use when user wants to modify a project.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name to update' },
          budget: { type: 'number', description: 'New budget (optional)' },
          status: { type: 'string', enum: ['active', 'completed', 'on-hold', 'archived'], description: 'New status (optional)' },
          progress: { type: 'number', description: 'Progress percentage 0-100 (optional)' },
          endDate: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
        },
        required: ['projectName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'archive_project',
      description: 'Archive or complete a project. Use when user wants to archive, close, or finish a project.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name to archive' },
        },
        required: ['projectName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'convert_estimate_to_project',
      description: 'Convert an approved estimate into an active project. Use when user wants to start a project from an estimate.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Client name whose estimate to convert' },
          estimateName: { type: 'string', description: 'Specific estimate name (optional)' },
        },
        required: ['clientName'],
      },
    },
  },
  // ============================================
  // TIME TRACKING / CLOCK TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'clock_in',
      description: 'Clock in to start working on a project. Use when user wants to start work, clock in, or begin time tracking.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name to clock into' },
          notes: { type: 'string', description: 'Work notes (optional)' },
        },
        required: ['projectName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clock_out',
      description: 'Clock out from current work. Use when user wants to stop working, clock out, or end time tracking.',
      parameters: {
        type: 'object',
        properties: {
          workPerformed: { type: 'string', description: 'Description of work performed (optional)' },
          category: { type: 'string', description: 'Work category (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_timecard',
      description: 'Get timecard summary showing hours worked. Use for timecard, hours worked, or time summary requests.',
      parameters: {
        type: 'object',
        properties: {
          employeeName: { type: 'string', description: 'Employee name (optional, defaults to current user)' },
          startDate: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
          endDate: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_lunch_break',
      description: 'Add a lunch break to the current clock entry. Use when user wants to record a lunch break.',
      parameters: {
        type: 'object',
        properties: {
          duration: { type: 'number', description: 'Lunch break duration in minutes (default 30)' },
        },
        required: [],
      },
    },
  },

  // ============================================
  // PAYMENT TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'add_payment',
      description: 'Record a payment received from a client. Use when user receives payment, records payment, or logs an invoice payment.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Client name who made the payment' },
          amount: { type: 'number', description: 'Payment amount in dollars' },
          method: { type: 'string', enum: ['cash', 'check', 'credit_card', 'bank_transfer', 'other'], description: 'Payment method' },
          projectName: { type: 'string', description: 'Project name to link payment to (optional)' },
          notes: { type: 'string', description: 'Payment notes (optional)' },
        },
        required: ['clientName', 'amount', 'method'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payment_summary',
      description: 'Get payment summary showing total payments received. Use for payment reports, revenue summaries, or payment totals.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Filter by client name (optional)' },
          projectName: { type: 'string', description: 'Filter by project name (optional)' },
          startDate: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
          endDate: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_payment_request',
      description: 'Send a payment request or invoice reminder to a client via email or SMS. Use when user wants to request payment or send invoice reminder.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Client name to send request to' },
          amount: { type: 'number', description: 'Amount requested in dollars' },
          method: { type: 'string', enum: ['email', 'sms', 'both'], description: 'Delivery method (default: email)' },
          dueDate: { type: 'string', description: 'Payment due date YYYY-MM-DD (optional)' },
          message: { type: 'string', description: 'Custom message to include (optional)' },
        },
        required: ['clientName', 'amount'],
      },
    },
  },

  // ============================================
  // DAILY LOG TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'create_daily_log',
      description: 'Create a daily log entry for project work. Use when user wants to log daily activities, record site notes, or document daily progress.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name for the log' },
          date: { type: 'string', description: 'Log date YYYY-MM-DD (defaults to today)' },
          weather: { type: 'string', description: 'Weather conditions (optional)' },
          temperature: { type: 'string', description: 'Temperature (optional)' },
          workPerformed: { type: 'string', description: 'Description of work performed' },
          crew: { type: 'string', description: 'Crew members present (optional)' },
          equipment: { type: 'string', description: 'Equipment used (optional)' },
          materials: { type: 'string', description: 'Materials delivered/used (optional)' },
          visitors: { type: 'string', description: 'Site visitors (optional)' },
          issues: { type: 'string', description: 'Issues or concerns (optional)' },
          notes: { type: 'string', description: 'Additional notes (optional)' },
        },
        required: ['projectName', 'workPerformed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_daily_log',
      description: 'Update an existing daily log entry. Use when user wants to add to or modify a daily log.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name for the log' },
          date: { type: 'string', description: 'Log date YYYY-MM-DD (defaults to today)' },
          workPerformed: { type: 'string', description: 'Updated work description (optional)' },
          issues: { type: 'string', description: 'Updated issues (optional)' },
          notes: { type: 'string', description: 'Additional notes to append (optional)' },
        },
        required: ['projectName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_daily_log_photo',
      description: 'Add a photo to today\'s daily log. Use when user wants to attach photos to the daily log or document site conditions visually.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name for the log' },
          photoDescription: { type: 'string', description: 'Description of what the photo shows' },
        },
        required: ['projectName', 'photoDescription'],
      },
    },
  },

  // ============================================
  // TASK MANAGEMENT TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task or to-do item. Use when user wants to add a task, create a to-do, or assign work.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title/description' },
          projectName: { type: 'string', description: 'Project name to link task to (optional)' },
          assignedTo: { type: 'string', description: 'Person assigned to task (optional)' },
          dueDate: { type: 'string', description: 'Due date YYYY-MM-DD (optional)' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority (optional)' },
          notes: { type: 'string', description: 'Additional task notes (optional)' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark a task as completed. Use when user finishes a task, completes a to-do, or marks something as done.',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string', description: 'Task title or keywords to find the task' },
        },
        required: ['taskTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task. Use when user wants to remove or delete a task.',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string', description: 'Task title or keywords to find the task' },
        },
        required: ['taskTitle'],
      },
    },
  },

  // ============================================
  // COMMUNICATION TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'send_sms',
      description: 'Send an SMS text message to a client or contact. Use when user wants to text, message, or SMS someone.',
      parameters: {
        type: 'object',
        properties: {
          recipientName: { type: 'string', description: 'Client or contact name to send SMS to' },
          message: { type: 'string', description: 'SMS message content' },
        },
        required: ['recipientName', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email to a client or contact. Use when user wants to email someone or send a message via email.',
      parameters: {
        type: 'object',
        properties: {
          recipientName: { type: 'string', description: 'Client or contact name to send email to' },
          subject: { type: 'string', description: 'Email subject line' },
          message: { type: 'string', description: 'Email message body' },
          attachProject: { type: 'string', description: 'Project name to attach info/photos from (optional)' },
        },
        required: ['recipientName', 'subject', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_bulk_sms',
      description: 'Send SMS to multiple clients at once. Use when user wants to text multiple people, send mass text, or broadcast SMS.',
      parameters: {
        type: 'object',
        properties: {
          recipients: { type: 'string', description: 'Comma-separated list of client names, or "all clients"' },
          message: { type: 'string', description: 'SMS message content' },
        },
        required: ['recipients', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'call_client',
      description: 'Initiate a phone call to a client. Use when user wants to call or phone a client.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Client name to call' },
          purpose: { type: 'string', description: 'Purpose/reason for the call (optional)' },
        },
        required: ['clientName'],
      },
    },
  },

  // ============================================
  // PHOTO MANAGEMENT TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'attach_photo_to_project',
      description: 'Attach or upload a photo to a project. Use when user wants to add photos, upload images, or attach pictures to a project.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name to attach photo to' },
          description: { type: 'string', description: 'Photo description or caption (optional)' },
          category: { type: 'string', description: 'Photo category like "progress", "issues", "completed" (optional)' },
        },
        required: ['projectName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'view_project_photos',
      description: 'View or list photos for a project. Use when user wants to see photos, view images, or browse project pictures.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name to view photos from' },
          category: { type: 'string', description: 'Filter by category (optional)' },
        },
        required: ['projectName'],
      },
    },
  },

  // ============================================
  // CLIENT MANAGEMENT TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'update_client_info',
      description: 'Update client contact information like phone, email, or address. Use when user wants to change or update client details.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Client name to update' },
          phone: { type: 'string', description: 'New phone number (optional)' },
          email: { type: 'string', description: 'New email address (optional)' },
          address: { type: 'string', description: 'New address (optional)' },
        },
        required: ['clientName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_client',
      description: 'Delete a client from the system. Use when user wants to remove or delete a client.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Client name to delete' },
        },
        required: ['clientName'],
      },
    },
  },

  // ============================================
  // NAVIGATION TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'navigate_to',
      description: 'Navigate to a specific screen or page in the app. Use when user wants to go to, open, or view a specific section.',
      parameters: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            enum: ['dashboard', 'projects', 'clients', 'expenses', 'estimates', 'timecard', 'daily-logs', 'tasks', 'photos', 'schedule', 'reports', 'settings'],
            description: 'The screen/page to navigate to'
          },
          itemName: { type: 'string', description: 'Specific item name (e.g., project name, client name) to open (optional)' },
        },
        required: ['destination'],
      },
    },
  },

  // ============================================
  // SUBCONTRACTOR TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'add_subcontractor',
      description: 'Add a new subcontractor to the system. Use when user wants to add, create, or register a subcontractor.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Subcontractor name or company name' },
          trade: { type: 'string', description: 'Trade/specialty (e.g., "Plumbing", "Electrical")' },
          phone: { type: 'string', description: 'Phone number (optional)' },
          email: { type: 'string', description: 'Email address (optional)' },
          rate: { type: 'number', description: 'Hourly or daily rate (optional)' },
        },
        required: ['name', 'trade'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assign_subcontractor',
      description: 'Assign a subcontractor to a project. Use when user wants to assign, link, or add a subcontractor to project work.',
      parameters: {
        type: 'object',
        properties: {
          subcontractorName: { type: 'string', description: 'Subcontractor name to assign' },
          projectName: { type: 'string', description: 'Project name to assign to' },
          startDate: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
          notes: { type: 'string', description: 'Assignment notes (optional)' },
        },
        required: ['subcontractorName', 'projectName'],
      },
    },
  },

  // ============================================
  // EXPENSE MANAGEMENT TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'update_expense',
      description: 'Update expense details like amount, category, or description. Use when user wants to modify or change an expense.',
      parameters: {
        type: 'object',
        properties: {
          expenseDescription: { type: 'string', description: 'Keywords to find the expense' },
          amount: { type: 'number', description: 'New amount (optional)' },
          category: { type: 'string', description: 'New category (optional)' },
          description: { type: 'string', description: 'New description (optional)' },
          date: { type: 'string', description: 'New date YYYY-MM-DD (optional)' },
        },
        required: ['expenseDescription'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_expense',
      description: 'Delete an expense. Use when user wants to remove or delete an expense entry.',
      parameters: {
        type: 'object',
        properties: {
          expenseDescription: { type: 'string', description: 'Keywords to find the expense to delete' },
        },
        required: ['expenseDescription'],
      },
    },
  },

  // ============================================
  // ESTIMATE MANAGEMENT TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'update_estimate',
      description: 'Update estimate details. Use when user wants to modify or change an estimate.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Client name whose estimate to update' },
          status: { type: 'string', enum: ['draft', 'sent', 'approved', 'rejected'], description: 'New status (optional)' },
          notes: { type: 'string', description: 'New notes (optional)' },
        },
        required: ['clientName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_estimate',
      description: 'Delete an estimate. Use when user wants to remove or delete an estimate.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Client name whose estimate to delete' },
        },
        required: ['clientName'],
      },
    },
  },

  // ============================================
  // PHOTO MANAGEMENT TOOLS (EXTENDED)
  // ============================================
  {
    type: 'function',
    function: {
      name: 'delete_photo',
      description: 'Delete a photo. Use when user wants to remove or delete a photo.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name the photo belongs to' },
          photoDescription: { type: 'string', description: 'Keywords to find the photo' },
        },
        required: ['projectName', 'photoDescription'],
      },
    },
  },

  // ============================================
  // SCHEDULE/CALENDAR TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'add_appointment',
      description: 'Add a calendar appointment or schedule event. Use when user wants to schedule, add to calendar, or book an appointment.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Appointment title' },
          date: { type: 'string', description: 'Date YYYY-MM-DD' },
          time: { type: 'string', description: 'Time HH:MM (optional)' },
          location: { type: 'string', description: 'Location (optional)' },
          notes: { type: 'string', description: 'Notes (optional)' },
          projectName: { type: 'string', description: 'Related project (optional)' },
        },
        required: ['title', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'view_schedule',
      description: 'View schedule for a specific date or date range. Use when user wants to see schedule, check calendar, or view appointments.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date YYYY-MM-DD (optional, defaults to today)' },
          endDate: { type: 'string', description: 'End date YYYY-MM-DD (optional, defaults to startDate)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_appointment',
      description: 'Delete an appointment from the schedule. Use when user wants to cancel or remove an appointment.',
      parameters: {
        type: 'object',
        properties: {
          appointmentTitle: { type: 'string', description: 'Keywords to find the appointment' },
        },
        required: ['appointmentTitle'],
      },
    },
  },

  // ============================================
  // TEAM MANAGEMENT TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'add_team_member',
      description: 'Add a new team member or employee. Use when user wants to add staff, hire employee, or register team member.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Team member name' },
          role: { type: 'string', description: 'Job role/position' },
          phone: { type: 'string', description: 'Phone number (optional)' },
          email: { type: 'string', description: 'Email address (optional)' },
          hourlyRate: { type: 'number', description: 'Hourly rate (optional)' },
        },
        required: ['name', 'role'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assign_team_to_project',
      description: 'Assign team members to a project. Use when user wants to staff a project or assign workers.',
      parameters: {
        type: 'object',
        properties: {
          teamMemberName: { type: 'string', description: 'Team member name to assign' },
          projectName: { type: 'string', description: 'Project name to assign to' },
          startDate: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
        },
        required: ['teamMemberName', 'projectName'],
      },
    },
  },

  // ============================================
  // NOTIFICATION TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'send_notification',
      description: 'Send an in-app notification to user or team. Use when user wants to send alert, notify, or send message.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Notification title' },
          message: { type: 'string', description: 'Notification message' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'], description: 'Notification type (optional)' },
        },
        required: ['title', 'message'],
      },
    },
  },
  // ============================================
  // DAILY TASKS TOOLS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'add_daily_task',
      description: 'Create a new personal daily task with optional time and reminder. Use when user wants to add a task, reminder, or to-do item.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title/description' },
          dueDate: { type: 'string', description: 'Due date - accepts "today", "tomorrow", "next monday", "next week", or YYYY-MM-DD format' },
          dueTime: { type: 'string', description: 'Due time - accepts "9am", "2:30pm", "14:00", "morning", "afternoon", "evening", or HH:MM format. Default is 09:00 if not specified.' },
          reminder: { type: 'boolean', description: 'Whether to set a reminder notification (default: false). When true, user will receive a notification at the due time.' },
          notes: { type: 'string', description: 'Optional notes about the task' },
        },
        required: ['title', 'dueDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_daily_tasks',
      description: 'Query daily tasks with intelligent filtering. Use for "what are my tasks", "tasks for today", "tasks this week", "tasks from date to date".',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['today', 'tomorrow', 'this_week', 'next_week', 'all', 'overdue', 'completed', 'pending'],
            description: 'Predefined filter for common queries',
          },
          startDate: { type: 'string', description: 'Start date for date range query (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date for date range query (YYYY-MM-DD)' },
          completed: { type: 'boolean', description: 'Filter by completion status' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_daily_task',
      description: 'Update a daily task - mark complete, change reminder, update title, date or time. Use for "complete task", "mark done", "turn off reminder", "change time to 3pm".',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string', description: 'Keywords to find the task' },
          completed: { type: 'boolean', description: 'Mark as completed/incomplete' },
          reminder: { type: 'boolean', description: 'Turn reminder on/off' },
          newTitle: { type: 'string', description: 'New title for the task' },
          newDueDate: { type: 'string', description: 'New due date (accepts natural language)' },
          newDueTime: { type: 'string', description: 'New due time (accepts "9am", "2:30pm", "14:00", etc.)' },
        },
        required: ['taskTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_daily_tasks',
      description: 'Delete daily tasks by filter or specific task. Use for "delete task", "remove all tomorrow tasks", "clear completed tasks".',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string', description: 'Keywords to find specific task to delete' },
          bulkFilter: {
            type: 'string',
            enum: ['today', 'tomorrow', 'this_week', 'completed', 'all', 'overdue'],
            description: 'Delete all tasks matching this filter'
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_update_daily_task_reminders',
      description: 'Turn reminders on or off for multiple tasks. Use for "turn off reminders for tomorrow", "enable reminders for this week".',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['today', 'tomorrow', 'this_week', 'next_week', 'all'],
            description: 'Which tasks to update'
          },
          reminderEnabled: { type: 'boolean', description: 'true to turn on, false to turn off reminders' },
        },
        required: ['filter', 'reminderEnabled'],
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
- Daily Tasks: Personal to-do list with time-based reminders

## DAILY TASKS WITH TIME
When adding daily tasks, you can specify both date AND time. Examples:
- "Add task to call John tomorrow at 3pm" → uses dueDate="tomorrow", dueTime="3pm"
- "Remind me to submit report at 2:30pm on Friday" → uses dueDate="next friday", dueTime="2:30pm", reminder=true
- "Create task for morning meeting at 9am" → uses dueTime="9am"
- "Add task to review contracts end of day" → uses dueTime="end of day" (17:00)

Time formats accepted:
- 12-hour: "9am", "2:30pm", "11:45am"
- 24-hour: "14:00", "09:30", "17:00"
- Natural: "morning" (09:00), "afternoon" (14:00), "evening" (18:00), "noon" (12:00), "end of day" (17:00), "eod", "cob"
- Default: If no time specified, defaults to 9:00 AM

When reminder=true, user receives a notification at the due time (or 30 minutes before).

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
      // Provide defaults for optional parameters
      const estimateName = args.estimateName || `Takeoff Estimate - ${args.clientName}`;
      const documentDescription = args.documentDescription || 'Construction document';
      const imageIndexes = args.imageIndexes || (attachedFiles && attachedFiles.length > 0 ? Array.from({length: attachedFiles.length}, (_, i) => i) : []);

      console.log('[Tool] generate_takeoff_estimate called:', {
        clientName: args.clientName,
        estimateName,
        documentDescription,
        imageIndexes,
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
      const invalidIndexes = imageIndexes.filter((idx: number) =>
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
      const selectedFiles = imageIndexes.map((idx: number) => attachedFiles[idx]);
      console.log('[Tool] Analyzing files:', selectedFiles.map((f: any) => f.name));

      return {
        result: {
          success: true,
          message: `Analyzing ${selectedFiles.length} document(s) for "${estimateName}"...`,
          clientName: args.clientName,
          estimateName,
          documentDescription,
          fileCount: selectedFiles.length
        },
        actionRequired: 'generate_takeoff_estimate',
        actionData: {
          clientName: args.clientName,
          estimateName,
          documentDescription,
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

    case 'create_change_order': {
      const project = projects.find((p: any) =>
        p.name.toLowerCase() === args.projectName.toLowerCase()
      );

      if (!project) {
        return {
          result: { error: `Project "${args.projectName}" not found` },
        };
      }

      return {
        result: {
          actionRequired: 'create_change_order',
          projectId: project.id,
          projectName: project.name,
          description: args.description,
          amount: args.amount,
          notes: args.notes,
        },
      };
    }

    case 'approve_change_order': {
      const project = projects.find((p: any) =>
        p.name.toLowerCase() === args.projectName.toLowerCase()
      );

      if (!project) {
        return {
          result: { error: `Project "${args.projectName}" not found` },
        };
      }

      const { changeOrders = [] } = appData;
      const pendingChangeOrders = changeOrders.filter(
        (co: any) => co.projectId === project.id && co.status === 'pending'
      );

      if (pendingChangeOrders.length === 0) {
        return {
          result: {
            error: `No pending change orders found for ${project.name}`,
          },
        };
      }

      const changeOrder = args.changeOrderId
        ? pendingChangeOrders.find((co: any) => co.id === args.changeOrderId)
        : pendingChangeOrders[0];

      if (!changeOrder) {
        return {
          result: { error: 'Change order not found' },
        };
      }

      return {
        result: {
          actionRequired: 'approve_change_order',
          changeOrderId: changeOrder.id,
          projectId: project.id,
          description: changeOrder.description,
          amount: changeOrder.amount,
        },
      };
    }

    case 'reject_change_order': {
      const project = projects.find((p: any) =>
        p.name.toLowerCase() === args.projectName.toLowerCase()
      );

      if (!project) {
        return {
          result: { error: `Project "${args.projectName}" not found` },
        };
      }

      const { changeOrders = [] } = appData;
      const pendingChangeOrders = changeOrders.filter(
        (co: any) => co.projectId === project.id && co.status === 'pending'
      );

      if (pendingChangeOrders.length === 0) {
        return {
          result: {
            error: `No pending change orders found for ${project.name}`,
          },
        };
      }

      const changeOrder = args.changeOrderId
        ? pendingChangeOrders.find((co: any) => co.id === args.changeOrderId)
        : pendingChangeOrders[0];

      if (!changeOrder) {
        return {
          result: { error: 'Change order not found' },
        };
      }

      return {
        result: {
          actionRequired: 'reject_change_order',
          changeOrderId: changeOrder.id,
          projectId: project.id,
          description: changeOrder.description,
          reason: args.reason,
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

    case 'send_subcontractor_invitation': {
      // This function returns a special action that tells the frontend to open the email client
      return {
        result: {
          message: 'Opening your email client to send subcontractor invitation...',
        },
        actionRequired: 'open_email_client',
        actionData: {},
      };
    }

    case 'send_estimate_request': {
      const { subcontractorName, projectName, description, notes, fileUrls: providedFileUrls } = args;
      const { subcontractors = [], projects = [], company, user } = appData;

      // Use provided fileUrls or extract from attachedFiles if available
      let fileUrls = providedFileUrls;
      if (!fileUrls && attachedFiles && attachedFiles.length > 0) {
        fileUrls = attachedFiles
          .filter((file: any) => !file.uploading) // Skip files still uploading
          .map((file: any) => ({
            name: file.name || file.fileName || 'attachment',
            url: file.s3Url || file.url || file.uri, // Prioritize s3Url
          }))
          .filter((f: any) => f.url && f.url.startsWith('http')); // Only include valid HTTP(S) URLs
      }

      // Find the subcontractor by name
      const subcontractor = subcontractors.find((s: any) =>
        s.name.toLowerCase().includes(subcontractorName.toLowerCase())
      );

      if (!subcontractor) {
        return {
          result: {
            success: false,
            message: `Could not find subcontractor "${subcontractorName}". Available subcontractors: ${subcontractors.map((s: any) => s.name).join(', ')}`,
          },
        };
      }

      if (!subcontractor.email) {
        return {
          result: {
            success: false,
            message: `Subcontractor "${subcontractor.name}" does not have an email address on file.`,
          },
        };
      }

      // Find the project by name
      const project = projects.find((p: any) =>
        p.name.toLowerCase().includes(projectName.toLowerCase())
      );

      if (!project) {
        return {
          result: {
            success: false,
            message: `Could not find project "${projectName}". Available projects: ${projects.map((p: any) => p.name).join(', ')}`,
          },
        };
      }

      // Send the estimate request email via API
      try {
        const emailData = {
          to: subcontractor.email,
          toName: subcontractor.name,
          projectName: project.name,
          companyName: company?.name || user?.name || 'Legacy Prime Construction',
          description: description,
          notes: notes || (project.budget ? `Budget: $${project.budget.toLocaleString()}` : undefined),
          files: fileUrls && fileUrls.length > 0 ? fileUrls : undefined,
        };

        // Call the email API (we'll use the deployed endpoint)
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

        const response = await fetch(`${API_URL}/api/send-estimate-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailData),
        });

        const result = await response.json();

        if (result.success) {
          const fileCount = fileUrls && fileUrls.length > 0 ? fileUrls.length : 0;
          const fileMessage = fileCount > 0 ? ` with ${fileCount} file attachment(s)` : '';

          return {
            result: {
              success: true,
              message: `✅ Estimate request sent successfully to ${subcontractor.name} (${subcontractor.email}) for project "${project.name}"${fileMessage}!`,
              details: {
                subcontractor: subcontractor.name,
                email: subcontractor.email,
                project: project.name,
                description: description,
                filesAttached: fileCount,
              },
            },
          };
        } else {
          return {
            result: {
              success: false,
              message: `Failed to send email: ${result.error}`,
            },
          };
        }
      } catch (error: any) {
        return {
          result: {
            success: false,
            message: `Error sending estimate request: ${error.message || 'Unknown error'}`,
          },
        };
      }
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

    // ============================================
    // PROJECT MANAGEMENT EXECUTION
    // ============================================
    case 'create_project': {
      if (!args.name || !args.budget) {
        return { result: { error: 'Project name and budget are required.' } };
      }
      if (args.budget <= 0) {
        return { result: { error: 'Budget must be greater than 0.' } };
      }

      // Check for existing project with same name
      const existingProject = projects.find((p: any) =>
        p.name.toLowerCase() === args.name.toLowerCase()
      );
      if (existingProject) {
        return { result: { error: `A project named "${args.name}" already exists.` } };
      }

      // Find client if provided
      let clientId = null;
      let estimateId = null;
      if (args.clientName) {
        const client = clients.find((c: any) =>
          c.name.toLowerCase().includes(args.clientName.toLowerCase())
        );
        if (client) {
          clientId = client.id;
          // Find most recent estimate for this client
          const clientEstimate = estimates.find((e: any) => e.clientId === client.id);
          if (clientEstimate) {
            estimateId = clientEstimate.id;
          }
        }
      }

      return {
        result: {
          success: true,
          message: `Creating project "${args.name}" with budget $${args.budget.toLocaleString()}`
        },
        actionRequired: 'create_project',
        actionData: {
          name: args.name,
          budget: args.budget,
          address: args.address || '',
          startDate: args.startDate || new Date().toISOString(),
          status: 'active',
          clientId,
          estimateId,
        },
      };
    }

    case 'update_project': {
      // Helper function to find project by name or client name
      const findProjectByNameOrClient = (searchName: string) => {
        // First try to find by project name
        let projectFound = projects.find((p: any) =>
          p.name?.toLowerCase().includes(searchName.toLowerCase())
        );

        // If not found by project name, try to find by client name via estimate linkage
        if (!projectFound && searchName) {
          const searchNameLower = searchName.toLowerCase();
          const matchingClient = clients.find((c: any) =>
            c.name?.toLowerCase().includes(searchNameLower)
          );

          if (matchingClient) {
            const clientEstimates = estimates.filter((e: any) => e.clientId === matchingClient.id);
            const clientEstimateIds = clientEstimates.map((e: any) => e.id);
            projectFound = projects.find((p: any) =>
              p.estimateId && clientEstimateIds.includes(p.estimateId)
            );
          }
        }

        return projectFound;
      };

      const project = findProjectByNameOrClient(args.projectName);
      if (!project) {
        return {
          result: {
            error: `Project "${args.projectName}" not found.`,
            availableProjects: projects.filter((p: any) => p.status === 'active').map((p: any) => p.name),
          }
        };
      }

      const updates: any = {};
      if (args.budget !== undefined) updates.budget = args.budget;
      if (args.status) updates.status = args.status;
      if (args.progress !== undefined) updates.progress = Math.min(100, Math.max(0, args.progress));
      if (args.endDate) updates.endDate = args.endDate;

      if (Object.keys(updates).length === 0) {
        return { result: { error: 'No updates provided. Specify budget, status, progress, or endDate.' } };
      }

      return {
        result: {
          success: true,
          message: `Updating project "${project.name}"`
        },
        actionRequired: 'update_project',
        actionData: {
          projectId: project.id,
          projectName: project.name,
          updates,
        },
      };
    }

    case 'archive_project': {
      const findProjectByNameOrClient = (searchName: string) => {
        let projectFound = projects.find((p: any) =>
          p.name?.toLowerCase().includes(searchName.toLowerCase())
        );

        if (!projectFound && searchName) {
          const searchNameLower = searchName.toLowerCase();
          const matchingClient = clients.find((c: any) =>
            c.name?.toLowerCase().includes(searchNameLower)
          );

          if (matchingClient) {
            const clientEstimates = estimates.filter((e: any) => e.clientId === matchingClient.id);
            const clientEstimateIds = clientEstimates.map((e: any) => e.id);
            projectFound = projects.find((p: any) =>
              p.estimateId && clientEstimateIds.includes(p.estimateId)
            );
          }
        }

        return projectFound;
      };

      const project = findProjectByNameOrClient(args.projectName);
      if (!project) {
        return { result: { error: `Project "${args.projectName}" not found.` } };
      }

      return {
        result: {
          success: true,
          message: `Archiving project "${project.name}"`
        },
        actionRequired: 'update_project',
        actionData: {
          projectId: project.id,
          projectName: project.name,
          updates: {
            status: 'archived',
            endDate: new Date().toISOString(),
          },
        },
      };
    }

    case 'convert_estimate_to_project': {
      const clientResult = findClientByName(clients, args.clientName);
      if (clientResult.error) {
        return { result: { error: clientResult.error } };
      }

      const client = clientResult.client;

      // Find estimate for this client
      let estimate = estimates.find((e: any) =>
        e.clientId === client.id && e.status === 'approved'
      );

      // If no approved estimate, try any estimate
      if (!estimate) {
        estimate = estimates.find((e: any) => e.clientId === client.id);
      }

      if (!estimate) {
        return { result: { error: `No estimate found for client "${client.name}". Create an estimate first.` } };
      }

      // Check if project already exists for this estimate
      const existingProject = projects.find((p: any) => p.estimateId === estimate.id);
      if (existingProject) {
        return { result: { error: `Project "${existingProject.name}" already exists for this estimate.` } };
      }

      return {
        result: {
          success: true,
          message: `Converting estimate to project for ${client.name}`
        },
        actionRequired: 'create_project',
        actionData: {
          name: estimate.name || `${client.name} Project`,
          budget: estimate.total || 0,
          status: 'active',
          clientId: client.id,
          estimateId: estimate.id,
          startDate: new Date().toISOString(),
        },
      };
    }

    // ============================================
    // CLOCK / TIME TRACKING EXECUTION
    // ============================================
    case 'clock_in': {
      const findProjectByNameOrClient = (searchName: string) => {
        let projectFound = projects.find((p: any) =>
          p.name?.toLowerCase().includes(searchName.toLowerCase())
        );

        if (!projectFound && searchName) {
          const searchNameLower = searchName.toLowerCase();
          const matchingClient = clients.find((c: any) =>
            c.name?.toLowerCase().includes(searchNameLower)
          );

          if (matchingClient) {
            const clientEstimates = estimates.filter((e: any) => e.clientId === matchingClient.id);
            const clientEstimateIds = clientEstimates.map((e: any) => e.id);
            projectFound = projects.find((p: any) =>
              p.estimateId && clientEstimateIds.includes(p.estimateId)
            );
          }
        }

        return projectFound;
      };

      const project = findProjectByNameOrClient(args.projectName);
      if (!project) {
        return {
          result: {
            error: `Project "${args.projectName}" not found.`,
            availableProjects: projects.filter((p: any) => p.status === 'active').map((p: any) => p.name),
          }
        };
      }

      // Check if already clocked in (any project)
      const { clockEntries = [] } = appData;
      const activeEntry = clockEntries.find((e: any) => !e.clockOut);
      if (activeEntry) {
        const activeProject = projects.find((p: any) => p.id === activeEntry.projectId);
        return {
          result: {
            error: `You're already clocked in to "${activeProject?.name || 'a project'}". Clock out first.`
          }
        };
      }

      return {
        result: {
          success: true,
          message: `Clocking in to "${project.name}"`
        },
        actionRequired: 'clock_in',
        actionData: {
          projectId: project.id,
          projectName: project.name,
          clockIn: new Date().toISOString(),
          location: { latitude: 0, longitude: 0 },
          workPerformed: args.notes || null,
        },
      };
    }

    case 'clock_out': {
      const { clockEntries = [] } = appData;
      const activeEntry = clockEntries.find((e: any) => !e.clockOut);

      if (!activeEntry) {
        return { result: { error: "You're not currently clocked in." } };
      }

      const project = projects.find((p: any) => p.id === activeEntry.projectId);

      return {
        result: {
          success: true,
          message: `Clocking out from "${project?.name || 'project'}"`
        },
        actionRequired: 'clock_out',
        actionData: {
          entryId: activeEntry.id,
          clockOut: new Date().toISOString(),
          workPerformed: args.workPerformed || activeEntry.workPerformed,
          category: args.category || null,
        },
      };
    }

    case 'get_timecard': {
      const { clockEntries = [] } = appData;

      // Calculate date range (default to current week)
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startDate = args.startDate ? new Date(args.startDate) : startOfWeek;
      const endDate = args.endDate ? new Date(args.endDate) : now;

      // Filter entries
      const filtered = clockEntries.filter((e: any) => {
        const clockIn = new Date(e.clockIn);
        return clockIn >= startDate && clockIn <= endDate && e.clockOut;
      });

      // Calculate totals
      let totalHours = 0;
      const byProject: { [key: string]: number } = {};

      filtered.forEach((e: any) => {
        const hours = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);
        totalHours += hours;

        const project = projects.find((p: any) => p.id === e.projectId);
        const projectName = project?.name || 'Unknown';
        byProject[projectName] = (byProject[projectName] || 0) + hours;
      });

      return {
        result: {
          period: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
          totalHours: Math.round(totalHours * 100) / 100,
          entries: filtered.length,
          byProject: Object.entries(byProject).map(([name, hours]) => ({
            project: name,
            hours: Math.round((hours as number) * 100) / 100,
          })),
          message: `Timecard for ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n\nTotal Hours: ${Math.round(totalHours * 100) / 100}\nEntries: ${filtered.length}\n\nBy Project:\n${Object.entries(byProject).map(([name, hours]) => `- ${name}: ${Math.round((hours as number) * 100) / 100} hours`).join('\n')}`,
        },
      };
    }

    case 'add_lunch_break': {
      const { clockEntries = [] } = appData;
      const activeEntry = clockEntries.find((e: any) => !e.clockOut);

      if (!activeEntry) {
        return { result: { error: "You're not currently clocked in." } };
      }

      const duration = args.duration || 30;
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - duration * 60 * 1000);

      const existingBreaks = activeEntry.lunchBreaks || [];

      return {
        result: {
          success: true,
          message: `Adding ${duration} minute lunch break`
        },
        actionRequired: 'update_clock_entry',
        actionData: {
          entryId: activeEntry.id,
          lunchBreaks: [...existingBreaks, {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString()
          }],
        },
      };
    }

    // ============================================
    // PAYMENT TOOLS
    // ============================================
    case 'add_payment': {
      const { clients = [], projects = [] } = appData;

      // Find client
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );

      if (!client) {
        const clientNames = clients.map((c: any) => c.name).join(', ');
        return { result: { error: `Client "${args.clientName}" not found. Available clients: ${clientNames || 'none'}` } };
      }

      // Find project if specified
      let projectId = null;
      if (args.projectName) {
        const project = findProjectByNameOrClient(projects, clients, args.projectName);
        if (project) {
          projectId = project.id;
        }
      }

      return {
        result: {
          success: true,
          message: `Recording $${args.amount} payment from ${client.name} via ${args.method}`
        },
        actionRequired: 'add_payment',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          projectId,
          projectName: args.projectName,
          amount: args.amount,
          method: args.method,
          notes: args.notes || '',
          date: new Date().toISOString(),
        },
      };
    }

    case 'get_payment_summary': {
      const { payments = [], clients = [], projects = [] } = appData;

      // Calculate date range (default to current month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const startDate = args.startDate ? new Date(args.startDate) : startOfMonth;
      const endDate = args.endDate ? new Date(args.endDate) : now;

      // Filter payments
      let filtered = payments.filter((p: any) => {
        const paymentDate = new Date(p.date);
        const dateMatch = paymentDate >= startDate && paymentDate <= endDate;

        if (args.clientName) {
          const client = clients.find((c: any) => c.id === p.clientId);
          return dateMatch && client?.name?.toLowerCase().includes(args.clientName.toLowerCase());
        }

        if (args.projectName) {
          const project = projects.find((pr: any) => pr.id === p.projectId);
          return dateMatch && project?.name?.toLowerCase().includes(args.projectName.toLowerCase());
        }

        return dateMatch;
      });

      // Calculate totals
      const totalAmount = filtered.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const byMethod: { [key: string]: number } = {};
      const byClient: { [key: string]: number } = {};

      filtered.forEach((p: any) => {
        byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;

        const client = clients.find((c: any) => c.id === p.clientId);
        if (client) {
          byClient[client.name] = (byClient[client.name] || 0) + p.amount;
        }
      });

      return {
        result: {
          success: true,
          totalAmount,
          paymentCount: filtered.length,
          byMethod,
          byClient,
          dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        }
      };
    }

    case 'send_payment_request': {
      const { clients = [] } = appData;

      // Find client
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );

      if (!client) {
        const clientNames = clients.map((c: any) => c.name).join(', ');
        return { result: { error: `Client "${args.clientName}" not found. Available clients: ${clientNames || 'none'}` } };
      }

      // Validate contact method
      const method = args.method || 'email';
      if (method === 'email' || method === 'both') {
        if (!client.email) {
          return { result: { error: `Client ${client.name} has no email address on file` } };
        }
      }
      if (method === 'sms' || method === 'both') {
        if (!client.phone) {
          return { result: { error: `Client ${client.name} has no phone number on file` } };
        }
      }

      return {
        result: {
          success: true,
          message: `Sending $${args.amount} payment request to ${client.name} via ${method}`
        },
        actionRequired: 'send_payment_request',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email,
          clientPhone: client.phone,
          amount: args.amount,
          method,
          dueDate: args.dueDate || null,
          message: args.message || '',
        },
      };
    }

    // ============================================
    // DAILY LOG TOOLS
    // ============================================
    case 'create_daily_log': {
      const { projects = [], clients = [] } = appData;

      // Find project
      const project = findProjectByNameOrClient(projects, clients, args.projectName);

      if (!project) {
        const projectNames = projects.map((p: any) => p.name).join(', ');
        return { result: { error: `Project "${args.projectName}" not found. Available projects: ${projectNames || 'none'}` } };
      }

      const logDate = args.date || new Date().toISOString().split('T')[0];

      return {
        result: {
          success: true,
          message: `Creating daily log for ${project.name} on ${logDate}`
        },
        actionRequired: 'create_daily_log',
        actionData: {
          projectId: project.id,
          projectName: project.name,
          date: logDate,
          weather: args.weather || '',
          temperature: args.temperature || '',
          workPerformed: args.workPerformed,
          crew: args.crew || '',
          equipment: args.equipment || '',
          materials: args.materials || '',
          visitors: args.visitors || '',
          issues: args.issues || '',
          notes: args.notes || '',
        },
      };
    }

    case 'update_daily_log': {
      const { projects = [], clients = [], dailyLogs = [] } = appData;

      // Find project
      const project = findProjectByNameOrClient(projects, clients, args.projectName);

      if (!project) {
        const projectNames = projects.map((p: any) => p.name).join(', ');
        return { result: { error: `Project "${args.projectName}" not found. Available projects: ${projectNames || 'none'}` } };
      }

      const logDate = args.date || new Date().toISOString().split('T')[0];

      // Find existing log
      const existingLog = dailyLogs.find((log: any) =>
        log.projectId === project.id && log.date === logDate
      );

      if (!existingLog) {
        return { result: { error: `No daily log found for ${project.name} on ${logDate}. Create one first.` } };
      }

      return {
        result: {
          success: true,
          message: `Updating daily log for ${project.name} on ${logDate}`
        },
        actionRequired: 'update_daily_log',
        actionData: {
          logId: existingLog.id,
          projectName: project.name,
          workPerformed: args.workPerformed || existingLog.workPerformed,
          issues: args.issues || existingLog.issues,
          notes: existingLog.notes ? `${existingLog.notes}\n${args.notes || ''}` : (args.notes || ''),
        },
      };
    }

    case 'add_daily_log_photo': {
      const { projects = [], clients = [], dailyLogs = [] } = appData;

      // Find project
      const project = findProjectByNameOrClient(projects, clients, args.projectName);

      if (!project) {
        const projectNames = projects.map((p: any) => p.name).join(', ');
        return { result: { error: `Project "${args.projectName}" not found. Available projects: ${projectNames || 'none'}` } };
      }

      const logDate = new Date().toISOString().split('T')[0];

      // Find or suggest creating log
      const existingLog = dailyLogs.find((log: any) =>
        log.projectId === project.id && log.date === logDate
      );

      return {
        result: {
          success: true,
          message: `Ready to add photo to ${project.name} daily log. Please upload the photo.`
        },
        actionRequired: 'add_daily_log_photo',
        actionData: {
          projectId: project.id,
          projectName: project.name,
          logId: existingLog?.id,
          date: logDate,
          description: args.photoDescription,
        },
      };
    }

    // ============================================
    // TASK MANAGEMENT TOOLS
    // ============================================
    case 'create_task': {
      const { projects = [], clients = [] } = appData;

      let projectId = null;
      let projectName = null;

      // Find project if specified
      if (args.projectName) {
        const project = findProjectByNameOrClient(projects, clients, args.projectName);
        if (project) {
          projectId = project.id;
          projectName = project.name;
        }
      }

      return {
        result: {
          success: true,
          message: `Creating task: ${args.title}`
        },
        actionRequired: 'create_task',
        actionData: {
          title: args.title,
          projectId,
          projectName,
          assignedTo: args.assignedTo || '',
          dueDate: args.dueDate || '',
          priority: args.priority || 'medium',
          notes: args.notes || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      };
    }

    case 'complete_task': {
      const { tasks = [] } = appData;

      // Find task by title match
      const task = tasks.find((t: any) =>
        t.title?.toLowerCase().includes(args.taskTitle.toLowerCase()) &&
        t.status !== 'completed'
      );

      if (!task) {
        const pendingTasks = tasks
          .filter((t: any) => t.status !== 'completed')
          .map((t: any) => t.title)
          .join(', ');
        return { result: { error: `Task "${args.taskTitle}" not found. Pending tasks: ${pendingTasks || 'none'}` } };
      }

      return {
        result: {
          success: true,
          message: `Marking task as complete: ${task.title}`
        },
        actionRequired: 'complete_task',
        actionData: {
          taskId: task.id,
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
      };
    }

    case 'delete_task': {
      const { tasks = [] } = appData;

      // Find task by title match
      const task = tasks.find((t: any) =>
        t.title?.toLowerCase().includes(args.taskTitle.toLowerCase())
      );

      if (!task) {
        const taskTitles = tasks.map((t: any) => t.title).join(', ');
        return { result: { error: `Task "${args.taskTitle}" not found. Available tasks: ${taskTitles || 'none'}` } };
      }

      return {
        result: {
          success: true,
          message: `Deleting task: ${task.title}`
        },
        actionRequired: 'delete_task',
        actionData: {
          taskId: task.id,
        },
      };
    }

    // ============================================
    // COMMUNICATION TOOLS
    // ============================================
    case 'send_sms': {
      const { clients = [] } = appData;

      // Find client
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.recipientName.toLowerCase())
      );

      if (!client) {
        const clientNames = clients.map((c: any) => c.name).join(', ');
        return { result: { error: `Client "${args.recipientName}" not found. Available clients: ${clientNames || 'none'}` } };
      }

      if (!client.phone) {
        return { result: { error: `Client ${client.name} has no phone number on file` } };
      }

      return {
        result: {
          success: true,
          message: `Sending SMS to ${client.name} at ${client.phone}`
        },
        actionRequired: 'send_sms',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          phone: client.phone,
          message: args.message,
        },
      };
    }

    case 'send_email': {
      const { clients = [], projects = [] } = appData;

      // Find client
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.recipientName.toLowerCase())
      );

      if (!client) {
        const clientNames = clients.map((c: any) => c.name).join(', ');
        return { result: { error: `Client "${args.recipientName}" not found. Available clients: ${clientNames || 'none'}` } };
      }

      if (!client.email) {
        return { result: { error: `Client ${client.name} has no email address on file` } };
      }

      // Find project if specified
      let projectData = null;
      if (args.attachProject) {
        const project = findProjectByNameOrClient(projects, clients, args.attachProject);
        if (project) {
          projectData = {
            projectId: project.id,
            projectName: project.name,
          };
        }
      }

      return {
        result: {
          success: true,
          message: `Sending email to ${client.name} at ${client.email}`
        },
        actionRequired: 'send_email',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          email: client.email,
          subject: args.subject,
          message: args.message,
          projectData,
        },
      };
    }

    case 'send_bulk_sms': {
      const { clients = [] } = appData;

      let recipientClients = [];

      if (args.recipients.toLowerCase() === 'all clients') {
        recipientClients = clients.filter((c: any) => c.phone);
      } else {
        // Parse comma-separated names
        const names = args.recipients.split(',').map((n: string) => n.trim().toLowerCase());
        recipientClients = clients.filter((c: any) =>
          c.phone && names.some((name: string) => c.name?.toLowerCase().includes(name))
        );
      }

      if (recipientClients.length === 0) {
        return { result: { error: `No clients found with phone numbers matching: ${args.recipients}` } };
      }

      return {
        result: {
          success: true,
          message: `Sending SMS to ${recipientClients.length} clients`
        },
        actionRequired: 'send_bulk_sms',
        actionData: {
          recipients: recipientClients.map((c: any) => ({
            clientId: c.id,
            clientName: c.name,
            phone: c.phone,
          })),
          message: args.message,
        },
      };
    }

    case 'call_client': {
      const { clients = [] } = appData;

      // Find client
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );

      if (!client) {
        const clientNames = clients.map((c: any) => c.name).join(', ');
        return { result: { error: `Client "${args.clientName}" not found. Available clients: ${clientNames || 'none'}` } };
      }

      if (!client.phone) {
        return { result: { error: `Client ${client.name} has no phone number on file` } };
      }

      return {
        result: {
          success: true,
          message: `Calling ${client.name} at ${client.phone}`
        },
        actionRequired: 'call_client',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          phone: client.phone,
          purpose: args.purpose || '',
        },
      };
    }

    // ============================================
    // PHOTO MANAGEMENT TOOLS
    // ============================================
    case 'attach_photo_to_project': {
      const { projects = [], clients = [] } = appData;

      // Find project
      const project = findProjectByNameOrClient(projects, clients, args.projectName);

      if (!project) {
        const projectNames = projects.map((p: any) => p.name).join(', ');
        return { result: { error: `Project "${args.projectName}" not found. Available projects: ${projectNames || 'none'}` } };
      }

      return {
        result: {
          success: true,
          message: `Ready to attach photo to ${project.name}. Please upload the photo.`
        },
        actionRequired: 'attach_photo',
        actionData: {
          projectId: project.id,
          projectName: project.name,
          description: args.description || '',
          category: args.category || 'general',
        },
      };
    }

    case 'view_project_photos': {
      const { projects = [], clients = [], photos = [] } = appData;

      // Find project
      const project = findProjectByNameOrClient(projects, clients, args.projectName);

      if (!project) {
        const projectNames = projects.map((p: any) => p.name).join(', ');
        return { result: { error: `Project "${args.projectName}" not found. Available projects: ${projectNames || 'none'}` } };
      }

      // Filter photos by project
      let projectPhotos = photos.filter((photo: any) => photo.projectId === project.id);

      if (args.category) {
        projectPhotos = projectPhotos.filter((photo: any) =>
          photo.category?.toLowerCase() === args.category.toLowerCase()
        );
      }

      return {
        result: {
          success: true,
          message: `Found ${projectPhotos.length} photos for ${project.name}`,
          photos: projectPhotos.map((p: any) => ({
            id: p.id,
            description: p.description,
            category: p.category,
            date: p.createdAt || p.date,
            url: p.url || p.uri,
          })),
        }
      };
    }

    // ============================================
    // CLIENT MANAGEMENT TOOLS
    // ============================================
    case 'update_client_info': {
      const { clients = [] } = appData;

      // Find client
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );

      if (!client) {
        const clientNames = clients.map((c: any) => c.name).join(', ');
        return { result: { error: `Client "${args.clientName}" not found. Available clients: ${clientNames || 'none'}` } };
      }

      const updates: any = {};
      if (args.phone) updates.phone = args.phone;
      if (args.email) updates.email = args.email;
      if (args.address) updates.address = args.address;

      if (Object.keys(updates).length === 0) {
        return { result: { error: 'No updates provided. Specify phone, email, or address to update.' } };
      }

      return {
        result: {
          success: true,
          message: `Updating ${client.name}'s information`
        },
        actionRequired: 'update_client_info',
        actionData: {
          clientId: client.id,
          clientName: client.name,
          updates,
        },
      };
    }

    case 'delete_client': {
      const { clients = [] } = appData;

      // Find client
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );

      if (!client) {
        const clientNames = clients.map((c: any) => c.name).join(', ');
        return { result: { error: `Client "${args.clientName}" not found. Available clients: ${clientNames || 'none'}` } };
      }

      return {
        result: {
          success: true,
          message: `Deleting client: ${client.name}`
        },
        actionRequired: 'delete_client',
        actionData: {
          clientId: client.id,
          clientName: client.name,
        },
      };
    }

    // ============================================
    // NAVIGATION TOOLS
    // ============================================
    case 'navigate_to': {
      const { projects = [], clients = [] } = appData;

      let itemData = null;

      // If specific item requested, find it
      if (args.itemName) {
        if (args.destination === 'projects') {
          const project = findProjectByNameOrClient(projects, clients, args.itemName);
          if (project) {
            itemData = { itemId: project.id, itemName: project.name };
          }
        } else if (args.destination === 'clients') {
          const client = clients.find((c: any) =>
            c.name?.toLowerCase().includes(args.itemName.toLowerCase())
          );
          if (client) {
            itemData = { itemId: client.id, itemName: client.name };
          }
        }
      }

      return {
        result: {
          success: true,
          message: `Navigating to ${args.destination}${itemData ? ` - ${itemData.itemName}` : ''}`
        },
        actionRequired: 'navigate_to',
        actionData: {
          destination: args.destination,
          itemData,
        },
      };
    }

    // ============================================
    // SUBCONTRACTOR TOOLS
    // ============================================
    case 'add_subcontractor': {
      return {
        result: {
          success: true,
          message: `Adding subcontractor: ${args.name} (${args.trade})`
        },
        actionRequired: 'add_subcontractor',
        actionData: {
          name: args.name,
          trade: args.trade,
          phone: args.phone || '',
          email: args.email || '',
          rate: args.rate || 0,
          status: 'active',
        },
      };
    }

    case 'assign_subcontractor': {
      const { projects = [], clients = [], subcontractors = [] } = appData;

      // Find subcontractor
      const subcontractor = subcontractors.find((sub: any) =>
        sub.name?.toLowerCase().includes(args.subcontractorName.toLowerCase())
      );

      if (!subcontractor) {
        const subNames = subcontractors.map((s: any) => s.name).join(', ');
        return { result: { error: `Subcontractor "${args.subcontractorName}" not found. Available: ${subNames || 'none'}` } };
      }

      // Find project
      const project = findProjectByNameOrClient(projects, clients, args.projectName);

      if (!project) {
        const projectNames = projects.map((p: any) => p.name).join(', ');
        return { result: { error: `Project "${args.projectName}" not found. Available projects: ${projectNames || 'none'}` } };
      }

      return {
        result: {
          success: true,
          message: `Assigning ${subcontractor.name} to ${project.name}`
        },
        actionRequired: 'assign_subcontractor',
        actionData: {
          subcontractorId: subcontractor.id,
          subcontractorName: subcontractor.name,
          projectId: project.id,
          projectName: project.name,
          startDate: args.startDate || '',
          notes: args.notes || '',
        },
      };
    }

    // ============================================
    // EXPENSE MANAGEMENT TOOLS
    // ============================================
    case 'update_expense': {
      const { expenses = [] } = appData;

      // Find expense
      const expense = expenses.find((e: any) =>
        e.description?.toLowerCase().includes(args.expenseDescription.toLowerCase()) ||
        e.category?.toLowerCase().includes(args.expenseDescription.toLowerCase())
      );

      if (!expense) {
        return { result: { error: `Expense matching "${args.expenseDescription}" not found` } };
      }

      const updates: any = {};
      if (args.amount) updates.amount = args.amount;
      if (args.category) updates.category = args.category;
      if (args.description) updates.description = args.description;
      if (args.date) updates.date = args.date;

      if (Object.keys(updates).length === 0) {
        return { result: { error: 'No updates provided' } };
      }

      return {
        result: {
          success: true,
          message: `Updating expense: ${expense.description}`
        },
        actionRequired: 'update_expense',
        actionData: {
          expenseId: expense.id,
          updates,
        },
      };
    }

    case 'delete_expense': {
      const { expenses = [] } = appData;

      // Find expense
      const expense = expenses.find((e: any) =>
        e.description?.toLowerCase().includes(args.expenseDescription.toLowerCase()) ||
        e.category?.toLowerCase().includes(args.expenseDescription.toLowerCase())
      );

      if (!expense) {
        return { result: { error: `Expense matching "${args.expenseDescription}" not found` } };
      }

      return {
        result: {
          success: true,
          message: `Deleting expense: ${expense.description}`
        },
        actionRequired: 'delete_expense',
        actionData: {
          expenseId: expense.id,
        },
      };
    }

    // ============================================
    // ESTIMATE MANAGEMENT TOOLS
    // ============================================
    case 'update_estimate': {
      const { estimates = [], clients = [] } = appData;

      // Find client
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );

      if (!client) {
        const clientNames = clients.map((c: any) => c.name).join(', ');
        return { result: { error: `Client "${args.clientName}" not found. Available clients: ${clientNames || 'none'}` } };
      }

      // Find estimate for client
      const estimate = estimates.find((est: any) => est.clientId === client.id);

      if (!estimate) {
        return { result: { error: `No estimate found for ${client.name}` } };
      }

      const updates: any = {};
      if (args.status) updates.status = args.status;
      if (args.notes) updates.notes = args.notes;

      if (Object.keys(updates).length === 0) {
        return { result: { error: 'No updates provided' } };
      }

      return {
        result: {
          success: true,
          message: `Updating estimate for ${client.name}`
        },
        actionRequired: 'update_estimate',
        actionData: {
          estimateId: estimate.id,
          updates,
        },
      };
    }

    case 'delete_estimate': {
      const { estimates = [], clients = [] } = appData;

      // Find client
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );

      if (!client) {
        const clientNames = clients.map((c: any) => c.name).join(', ');
        return { result: { error: `Client "${args.clientName}" not found. Available clients: ${clientNames || 'none'}` } };
      }

      // Find estimate for client
      const estimate = estimates.find((est: any) => est.clientId === client.id);

      if (!estimate) {
        return { result: { error: `No estimate found for ${client.name}` } };
      }

      return {
        result: {
          success: true,
          message: `Deleting estimate for ${client.name}`
        },
        actionRequired: 'delete_estimate',
        actionData: {
          estimateId: estimate.id,
        },
      };
    }

    // ============================================
    // PHOTO MANAGEMENT TOOLS (EXTENDED)
    // ============================================
    case 'delete_photo': {
      const { projects = [], clients = [], photos = [] } = appData;

      // Find project
      const project = findProjectByNameOrClient(projects, clients, args.projectName);

      if (!project) {
        const projectNames = projects.map((p: any) => p.name).join(', ');
        return { result: { error: `Project "${args.projectName}" not found. Available projects: ${projectNames || 'none'}` } };
      }

      // Find photo
      const photo = photos.find((p: any) =>
        p.projectId === project.id &&
        (p.description?.toLowerCase().includes(args.photoDescription.toLowerCase()) ||
         p.category?.toLowerCase().includes(args.photoDescription.toLowerCase()))
      );

      if (!photo) {
        return { result: { error: `Photo matching "${args.photoDescription}" not found for ${project.name}` } };
      }

      return {
        result: {
          success: true,
          message: `Deleting photo from ${project.name}`
        },
        actionRequired: 'delete_photo',
        actionData: {
          photoId: photo.id,
        },
      };
    }

    // ============================================
    // SCHEDULE/CALENDAR TOOLS
    // ============================================
    case 'add_appointment': {
      const { projects = [], clients = [] } = appData;

      let projectId = null;
      if (args.projectName) {
        const project = findProjectByNameOrClient(projects, clients, args.projectName);
        if (project) projectId = project.id;
      }

      return {
        result: {
          success: true,
          message: `Adding appointment: ${args.title} on ${args.date}`
        },
        actionRequired: 'add_appointment',
        actionData: {
          title: args.title,
          date: args.date,
          time: args.time || '',
          location: args.location || '',
          notes: args.notes || '',
          projectId,
        },
      };
    }

    case 'view_schedule': {
      const { appointments = [] } = appData;

      const today = new Date().toISOString().split('T')[0];
      const startDate = args.startDate || today;
      const endDate = args.endDate || startDate;

      const filtered = appointments.filter((apt: any) => {
        const aptDate = apt.date;
        return aptDate >= startDate && aptDate <= endDate;
      });

      return {
        result: {
          success: true,
          message: `Found ${filtered.length} appointments`,
          appointments: filtered.map((a: any) => ({
            title: a.title,
            date: a.date,
            time: a.time,
            location: a.location,
          })),
        }
      };
    }

    case 'delete_appointment': {
      const { appointments = [] } = appData;

      const appointment = appointments.find((a: any) =>
        a.title?.toLowerCase().includes(args.appointmentTitle.toLowerCase())
      );

      if (!appointment) {
        return { result: { error: `Appointment matching "${args.appointmentTitle}" not found` } };
      }

      return {
        result: {
          success: true,
          message: `Deleting appointment: ${appointment.title}`
        },
        actionRequired: 'delete_appointment',
        actionData: {
          appointmentId: appointment.id,
        },
      };
    }

    // ============================================
    // TEAM MANAGEMENT TOOLS
    // ============================================
    case 'add_team_member': {
      return {
        result: {
          success: true,
          message: `Adding team member: ${args.name} (${args.role})`
        },
        actionRequired: 'add_team_member',
        actionData: {
          name: args.name,
          role: args.role,
          phone: args.phone || '',
          email: args.email || '',
          hourlyRate: args.hourlyRate || 0,
          status: 'active',
        },
      };
    }

    case 'assign_team_to_project': {
      const { projects = [], clients = [], teamMembers = [] } = appData;

      // Find team member
      const member = teamMembers.find((tm: any) =>
        tm.name?.toLowerCase().includes(args.teamMemberName.toLowerCase())
      );

      if (!member) {
        const memberNames = teamMembers.map((tm: any) => tm.name).join(', ');
        return { result: { error: `Team member "${args.teamMemberName}" not found. Available: ${memberNames || 'none'}` } };
      }

      // Find project
      const project = findProjectByNameOrClient(projects, clients, args.projectName);

      if (!project) {
        const projectNames = projects.map((p: any) => p.name).join(', ');
        return { result: { error: `Project "${args.projectName}" not found. Available projects: ${projectNames || 'none'}` } };
      }

      return {
        result: {
          success: true,
          message: `Assigning ${member.name} to ${project.name}`
        },
        actionRequired: 'assign_team_to_project',
        actionData: {
          teamMemberId: member.id,
          teamMemberName: member.name,
          projectId: project.id,
          projectName: project.name,
          startDate: args.startDate || '',
        },
      };
    }

    // ============================================
    // NOTIFICATION TOOLS
    // ============================================
    case 'send_notification': {
      return {
        result: {
          success: true,
          message: `Sending notification: ${args.title}`
        },
        actionRequired: 'send_notification',
        actionData: {
          title: args.title,
          message: args.message,
          type: args.type || 'info',
        },
      };
    }

    // ============================================
    // DAILY TASKS HANDLERS
    // ============================================
    case 'add_daily_task': {
      const dueDate = parseNaturalDate(args.dueDate);
      const dueTime = parseNaturalTime(args.dueTime);
      const dueDateTime = `${dueDate}T${dueTime}:00`;

      // Format time for display
      const [hours, minutes] = dueTime.split(':').map(Number);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      const timeDisplay = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;

      const reminderNote = args.reminder ? ' with reminder' : '';

      return {
        result: {
          success: true,
          message: `Task "${args.title}" scheduled for ${dueDate} at ${timeDisplay}${reminderNote}`,
        },
        actionRequired: 'add_daily_task',
        actionData: {
          title: args.title,
          dueDate,
          dueTime,
          dueDateTime,
          reminder: args.reminder || false,
          notes: args.notes || '',
        },
      };
    }

    case 'query_daily_tasks': {
      const { dailyTasks = [] } = appData;
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
      const weekEndStr = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];
      const nextWeekEndStr = new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0];

      let filtered = [...dailyTasks];

      // Apply filter
      if (args.filter) {
        switch (args.filter) {
          case 'today':
            filtered = filtered.filter((t: any) => t.dueDate === todayStr);
            break;
          case 'tomorrow':
            filtered = filtered.filter((t: any) => t.dueDate === tomorrowStr);
            break;
          case 'this_week':
            filtered = filtered.filter((t: any) => t.dueDate >= todayStr && t.dueDate <= weekEndStr);
            break;
          case 'next_week':
            filtered = filtered.filter((t: any) => t.dueDate > weekEndStr && t.dueDate <= nextWeekEndStr);
            break;
          case 'overdue':
            filtered = filtered.filter((t: any) => t.dueDate < todayStr && !t.completed);
            break;
          case 'completed':
            filtered = filtered.filter((t: any) => t.completed);
            break;
          case 'pending':
            filtered = filtered.filter((t: any) => !t.completed);
            break;
          case 'all':
          default:
            // No filter
            break;
        }
      }

      // Apply date range filter
      if (args.startDate) {
        const startDate = parseNaturalDate(args.startDate);
        filtered = filtered.filter((t: any) => t.dueDate >= startDate);
      }
      if (args.endDate) {
        const endDate = parseNaturalDate(args.endDate);
        filtered = filtered.filter((t: any) => t.dueDate <= endDate);
      }

      // Apply completion filter
      if (args.completed !== undefined) {
        filtered = filtered.filter((t: any) => t.completed === args.completed);
      }

      // Sort by due date
      filtered.sort((a: any, b: any) => a.dueDate.localeCompare(b.dueDate));

      const pendingCount = filtered.filter((t: any) => !t.completed).length;
      const completedCount = filtered.filter((t: any) => t.completed).length;

      return {
        result: {
          count: filtered.length,
          pendingCount,
          completedCount,
          tasks: filtered.map((t: any) => {
            // Format time for display if available
            let timeDisplay = '';
            if (t.dueTime) {
              const [hours, minutes] = t.dueTime.split(':').map(Number);
              const ampm = hours >= 12 ? 'PM' : 'AM';
              const hour12 = hours % 12 || 12;
              timeDisplay = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
            }

            return {
              id: t.id,
              title: t.title,
              dueDate: t.dueDate,
              dueTime: t.dueTime,
              timeDisplay,
              reminder: t.reminder,
              reminderSent: t.reminderSent,
              completed: t.completed,
              notes: t.notes,
            };
          }),
        },
      };
    }

    case 'update_daily_task': {
      const { dailyTasks = [] } = appData;

      // Find task by title match
      const task = dailyTasks.find((t: any) =>
        t.title?.toLowerCase().includes(args.taskTitle.toLowerCase())
      );

      if (!task) {
        const taskTitles = dailyTasks.map((t: any) => t.title).slice(0, 5).join(', ');
        return {
          result: {
            error: `Task "${args.taskTitle}" not found.`,
            availableTasks: taskTitles || 'No tasks found'
          },
        };
      }

      const updates: any = {};
      if (args.completed !== undefined) updates.completed = args.completed;
      if (args.reminder !== undefined) updates.reminder = args.reminder;
      if (args.newTitle) updates.title = args.newTitle;

      // Handle date update
      if (args.newDueDate) {
        updates.dueDate = parseNaturalDate(args.newDueDate);
      }

      // Handle time update
      if (args.newDueTime) {
        updates.dueTime = parseNaturalTime(args.newDueTime);
      }

      // Build dueDateTime if either date or time changed
      if (updates.dueDate || updates.dueTime) {
        const finalDate = updates.dueDate || task.dueDate;
        const finalTime = updates.dueTime || task.dueTime || '09:00';
        updates.dueDateTime = `${finalDate}T${finalTime}:00`;
      }

      // Build update message
      let updateMessage = `Task "${task.title}" will be updated`;
      const changes: string[] = [];
      if (args.completed !== undefined) changes.push(args.completed ? 'marked complete' : 'marked incomplete');
      if (args.reminder !== undefined) changes.push(args.reminder ? 'reminder enabled' : 'reminder disabled');
      if (args.newDueDate) changes.push(`date changed to ${updates.dueDate}`);
      if (args.newDueTime) {
        const [h, m] = updates.dueTime.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        changes.push(`time changed to ${h12}:${m.toString().padStart(2, '0')} ${ampm}`);
      }
      if (changes.length > 0) {
        updateMessage = `Task "${task.title}": ${changes.join(', ')}`;
      }

      return {
        result: {
          success: true,
          message: updateMessage,
        },
        actionRequired: 'update_daily_task',
        actionData: {
          taskId: task.id,
          updates,
        },
      };
    }

    case 'delete_daily_tasks': {
      const { dailyTasks = [] } = appData;
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
      const weekEndStr = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

      let tasksToDelete: string[] = [];
      let message = '';

      if (args.bulkFilter) {
        switch (args.bulkFilter) {
          case 'today':
            tasksToDelete = dailyTasks.filter((t: any) => t.dueDate === todayStr).map((t: any) => t.id);
            message = `Deleting ${tasksToDelete.length} task(s) for today`;
            break;
          case 'tomorrow':
            tasksToDelete = dailyTasks.filter((t: any) => t.dueDate === tomorrowStr).map((t: any) => t.id);
            message = `Deleting ${tasksToDelete.length} task(s) for tomorrow`;
            break;
          case 'this_week':
            tasksToDelete = dailyTasks.filter((t: any) => t.dueDate >= todayStr && t.dueDate <= weekEndStr).map((t: any) => t.id);
            message = `Deleting ${tasksToDelete.length} task(s) for this week`;
            break;
          case 'completed':
            tasksToDelete = dailyTasks.filter((t: any) => t.completed).map((t: any) => t.id);
            message = `Deleting ${tasksToDelete.length} completed task(s)`;
            break;
          case 'overdue':
            tasksToDelete = dailyTasks.filter((t: any) => t.dueDate < todayStr && !t.completed).map((t: any) => t.id);
            message = `Deleting ${tasksToDelete.length} overdue task(s)`;
            break;
          case 'all':
            tasksToDelete = dailyTasks.map((t: any) => t.id);
            message = `Deleting all ${tasksToDelete.length} task(s)`;
            break;
        }
      } else if (args.taskTitle) {
        const task = dailyTasks.find((t: any) =>
          t.title?.toLowerCase().includes(args.taskTitle.toLowerCase())
        );
        if (task) {
          tasksToDelete = [task.id];
          message = `Deleting task: "${task.title}"`;
        } else {
          return {
            result: { error: `Task "${args.taskTitle}" not found` },
          };
        }
      } else {
        return {
          result: { error: 'Please specify a task title or filter (today, tomorrow, completed, etc.)' },
        };
      }

      if (tasksToDelete.length === 0) {
        return {
          result: { message: 'No tasks found matching the criteria' },
        };
      }

      return {
        result: {
          success: true,
          message,
          count: tasksToDelete.length,
        },
        actionRequired: 'delete_daily_tasks',
        actionData: {
          taskIds: tasksToDelete,
        },
      };
    }

    case 'bulk_update_daily_task_reminders': {
      const { dailyTasks = [] } = appData;
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
      const weekEndStr = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];
      const nextWeekEndStr = new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0];

      let tasksToUpdate: any[] = [];

      switch (args.filter) {
        case 'today':
          tasksToUpdate = dailyTasks.filter((t: any) => t.dueDate === todayStr);
          break;
        case 'tomorrow':
          tasksToUpdate = dailyTasks.filter((t: any) => t.dueDate === tomorrowStr);
          break;
        case 'this_week':
          tasksToUpdate = dailyTasks.filter((t: any) => t.dueDate >= todayStr && t.dueDate <= weekEndStr);
          break;
        case 'next_week':
          tasksToUpdate = dailyTasks.filter((t: any) => t.dueDate > weekEndStr && t.dueDate <= nextWeekEndStr);
          break;
        case 'all':
          tasksToUpdate = dailyTasks;
          break;
      }

      if (tasksToUpdate.length === 0) {
        return {
          result: { message: 'No tasks found matching the criteria' },
        };
      }

      const action = args.reminderEnabled ? 'enabled' : 'disabled';

      return {
        result: {
          success: true,
          message: `Reminders ${action} for ${tasksToUpdate.length} task(s)`,
          count: tasksToUpdate.length,
        },
        actionRequired: 'bulk_update_reminders',
        actionData: {
          taskIds: tasksToUpdate.map((t: any) => t.id),
          reminder: args.reminderEnabled,
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

## ATTACHED FILES (IMPORTANT!)
The user has attached ${attachedFiles.length} file(s) to this conversation:
${attachedFiles.map((f: any, idx: number) => `File ${idx}: ${f.name || 'Unknown'} (${f.mimeType || 'unknown type'})`).join('\n')}

**CRITICAL INSTRUCTIONS:**
- These files are ALREADY attached - do NOT ask the user to attach files
- When user says "create takeoff estimate" or "analyze this", they mean these attached files
- For takeoff estimates: Call generate_takeoff_estimate with imageIndexes: [${Array.from({length: attachedFiles.length}, (_, i) => i).join(', ')}]
- DO NOT ask for confirmation - the files are attached and ready to analyze
- Example: If user says "create takeoff estimate for John", immediately call generate_takeoff_estimate(clientName: "John", imageIndexes: [${Array.from({length: attachedFiles.length}, (_, i) => i).join(', ')}])`;
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
      try {
        const messageText = msg.text || msg.content || '';

        if (msg.role === 'user' && msg.files && msg.files.length > 0) {
          // User message with attachments - build content array
          const contentParts: any[] = [
            { type: 'text', text: messageText }
          ];

          // Add file attachments (only images, not PDFs)
          for (const file of msg.files) {
            if (file.uri && typeof file.uri === 'string') {
              // Skip PDFs - they're handled via tools, not vision API
              if (file.mimeType === 'application/pdf') {
                console.log('[AI Assistant] Skipping PDF for vision API:', file.name);
                continue;
              }

              // For images with data URIs, use image_url type
              if (file.uri.startsWith('data:image')) {
                contentParts.push({
                  type: 'image_url',
                  image_url: { url: file.uri }
                });
              }
              // For S3 URLs (images only), include as image_url
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
      } catch (msgError: any) {
        console.error('[AI Assistant] Error processing message:', msgError);
        // Skip problematic message and continue
      }
    }

    console.log('[AI Assistant] Built', openaiMessages.length, 'messages for OpenAI');

    // First API call - let AI decide if it needs tools
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: openaiMessages,
        tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 2000,
      });
    } catch (openaiError: any) {
      console.error('[AI Assistant] OpenAI API error:', openaiError);
      console.error('[AI Assistant] Messages sent:', JSON.stringify(openaiMessages, null, 2));
      throw openaiError;
    }

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
