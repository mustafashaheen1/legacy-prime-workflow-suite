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
];

// System prompt for dual-purpose assistant
const systemPrompt = `You are an AI assistant for Legacy Prime Workflow Suite, a construction project management platform.

You have TWO roles:

1. **PRODUCT GUIDE**: Help users understand how to use the platform
   - Answer "how do I..." questions with step-by-step guidance
   - Explain features and navigation
   - After explaining, ALWAYS offer to perform the action if the user provides details

2. **DATA-AWARE ASSISTANT**: Query and act on actual business data
   - Answer questions about their projects, clients, expenses, estimates
   - Perform actions like setting follow-ups, requesting payments, generating estimates
   - Generate reports based on real data

IMPORTANT BEHAVIORS:
- When users ask "how to" questions, explain the process AND offer to do it for them
- When users ask about their data (how many projects, clients, etc.), USE THE TOOLS to query real data
- When performing actions that need choices (like which estimate), ask for clarification first
- Always be helpful and proactive in offering assistance
- Keep responses concise but informative
- Use formatting (bullet points, numbered lists) for better readability

AVAILABLE FEATURES IN THE SYSTEM:
- Dashboard: Overview of all projects, tasks, and metrics
- CRM: Client management and lead tracking
- Estimates: Create and send project estimates
- Projects: Manage active projects, budgets, and progress
- Schedule: Calendar view of tasks and projects
- Expenses: Track project expenses and receipts
- Photos: Upload and organize project photos
- Chat: Team communication
- Reports: Generate financial and administrative reports
- Clock: Employee time tracking

When you need to query or modify data, use the available tools. The tools have access to the user's actual business data.

Always respond in English. Be friendly, concise, and helpful.`;

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
      if (args.clientName) {
        // Find projects associated with the client
        const client = clients.find((c: any) =>
          c.name?.toLowerCase().includes(args.clientName.toLowerCase())
        );
        if (client) {
          // For now, return all estimates since we don't have direct client-estimate linkage
          // In a real implementation, you'd filter by client relationship
        }
      }
      if (args.projectId) {
        filtered = filtered.filter((e: any) => e.projectId === args.projectId);
      }
      if (args.status) {
        filtered = filtered.filter((e: any) => e.status === args.status);
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
            projectId: e.projectId,
          })),
        },
      };
    }

    case 'set_followup': {
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );
      if (!client) {
        return {
          result: { error: `Client "${args.clientName}" not found` },
        };
      }
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
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );
      if (!client) {
        return {
          result: { error: `Client "${args.clientName}" not found` },
        };
      }
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
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );
      if (!client) {
        return {
          result: { error: `Client "${args.clientName}" not found` },
        };
      }

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
      const client = clients.find((c: any) =>
        c.name?.toLowerCase().includes(args.clientName.toLowerCase())
      );
      if (!client) {
        return {
          result: { error: `Client "${args.clientName}" not found. Please add them to your CRM first.` },
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
