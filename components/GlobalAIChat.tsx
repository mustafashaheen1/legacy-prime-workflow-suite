import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { Bot, X, Send, Paperclip, File as FileIcon, Mic, Volume2, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { useApp } from '@/contexts/AppContext';
import { masterPriceList, priceListCategories } from '@/mocks/priceList';
import { usePathname } from 'expo-router';
import { Audio } from 'expo-av';
import { shouldBlockChatbotQuery, getChatbotRestrictionLevel } from '@/lib/permissions';


interface GlobalAIChatProps {
  currentPageContext?: string;
  inline?: boolean;
}

const extensionMimeTypeMap: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;

type AttachedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  type: 'file';
};

type AgentMessageFile = {
  type: 'file';
  mimeType: string;
  name: string;
  data?: string;
  uri?: string;
  size?: number;
};

const getSanitizedMimeType = (initialMimeType: string | undefined, fileName: string): string => {
  if (initialMimeType && initialMimeType !== 'application/octet-stream') {
    return initialMimeType;
  }
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension && extensionMimeTypeMap[extension]) {
    return extensionMimeTypeMap[extension];
  }
  return 'application/octet-stream';
};

export default function GlobalAIChat({ currentPageContext, inline = false }: GlobalAIChatProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [soundInstance, setSoundInstance] = useState<Audio.Sound | null>(null);
  const [voiceMode, setVoiceMode] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pathname = usePathname();
  const isOnChatScreen = pathname === '/chat';
  const isOnAuthScreen = pathname?.includes('/login') || pathname?.includes('/subscription') || pathname?.includes('/signup');
  const { user, projects, clients, expenses, photos, tasks, clockEntries, estimates, addEstimate } = useApp();

  const getContextForCurrentPage = () => {
    let context = `Current page: ${pathname}\n\n`;

    if (pathname === '/dashboard' || pathname === '/' || pathname.includes('dashboard')) {
      context += `Dashboard Summary:\n`;
      context += `- Total projects: ${projects.length}\n`;
      context += `- Total budget: $${projects.reduce((sum, p) => sum + p.budget, 0).toLocaleString()}\n`;
      context += `- Total expenses: $${projects.reduce((sum, p) => sum + p.expenses, 0).toLocaleString()}\n`;
      context += `- Active projects: ${projects.filter(p => p.status === 'active').length}\n`;
    } else if (pathname.includes('crm')) {
      context += `CRM Summary:\n`;
      context += `- Total clients: ${clients.length}\n`;
      context += `- Leads: ${clients.filter(c => c.status === 'Lead').length}\n`;
      context += `- Active projects: ${clients.filter(c => c.status === 'Project').length}\n`;
      context += `- Completed: ${clients.filter(c => c.status === 'Completed').length}\n`;
    } else if (pathname.includes('schedule')) {
      context += `Schedule Summary:\n`;
      context += `- Total tasks: ${tasks.length}\n`;
      context += `- Completed tasks: ${tasks.filter(t => t.completed).length}\n`;
      context += `- Pending tasks: ${tasks.filter(t => !t.completed).length}\n`;
    } else if (pathname.includes('expenses')) {
      context += `Expenses Summary:\n`;
      context += `- Total expenses: ${expenses.length}\n`;
      context += `- Total amount: $${expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}\n`;
    } else if (pathname.includes('photos')) {
      context += `Photos Summary:\n`;
      context += `- Total photos: ${photos.length}\n`;
    } else if (pathname.includes('clock')) {
      context += `Clock Summary:\n`;
      context += `- Total clock entries: ${clockEntries.length}\n`;
    } else if (pathname.includes('estimate')) {
      context += `Estimates Summary:\n`;
      context += `- Total estimates: ${estimates.length}\n`;
      context += `- Draft estimates: ${estimates.filter(e => e.status === 'draft').length}\n`;
      context += `- Sent estimates: ${estimates.filter(e => e.status === 'sent').length}\n`;
    }

    return context;
  };

  const tools = useMemo(() => {
    const toolsObj = {
      getProjectExpenses: createRorkTool({
        description: 'Get expenses for a project or all projects today',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Specific project ID to query, or all if not provided'),
          startDate: z.string().optional().describe('Start date to filter (ISO format)'),
          endDate: z.string().optional().describe('End date to filter (ISO format)'),
        }),
        execute(input) {
          console.log('Getting project expenses:', input);
          
          const today = new Date().toISOString().split('T')[0];
          
          let relevantExpenses = input.projectId 
            ? expenses.filter(e => e.projectId === input.projectId)
            : expenses;
          
          if (input.startDate || input.endDate) {
            const start = input.startDate || '2000-01-01';
            const end = input.endDate || '2099-12-31';
            relevantExpenses = relevantExpenses.filter(e => e.date >= start && e.date <= end);
          }
          
          const totalExpenses = relevantExpenses.reduce((sum, e) => sum + e.amount, 0);
          const todayExpenses = relevantExpenses.filter(e => e.date === today);
          const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
          
          return JSON.stringify({
            success: true,
            totalExpenses,
            expenseCount: relevantExpenses.length,
            todayExpenses: todayTotal,
            todayExpenseCount: todayExpenses.length,
            expenses: relevantExpenses.map(e => ({
              id: e.id,
              projectId: e.projectId,
              type: e.type,
              subcategory: e.subcategory,
              amount: e.amount,
              store: e.store,
              date: e.date,
            })),
          });
        },
      }),
      
      getProjectUpdates: createRorkTool({
        description: 'Get updates and status for projects',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Specific project ID, or all if not provided'),
        }),
        execute(input) {
          console.log('Getting project updates:', input);
          
          const relevantProjects = input.projectId
            ? projects.filter(p => p.id === input.projectId)
            : projects;
          
          const updates = relevantProjects.map(project => {
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            const completedTasks = projectTasks.filter(t => t.completed).length;
            const projectExpenses = expenses.filter(e => e.projectId === project.id);
            const recentExpense = projectExpenses.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0];
            
            return {
              id: project.id,
              name: project.name,
              status: project.status,
              progress: project.progress,
              budget: project.budget,
              expenses: project.expenses,
              remaining: project.budget - project.expenses,
              hoursWorked: project.hoursWorked,
              tasksTotal: projectTasks.length,
              tasksCompleted: completedTasks,
              tasksPending: projectTasks.length - completedTasks,
              lastExpenseDate: recentExpense?.date,
              lastExpenseAmount: recentExpense?.amount,
            };
          });
          
          return JSON.stringify({
            success: true,
            projects: updates,
          });
        },
      }),
      
      getLeads: createRorkTool({
        description: 'Get information about new leads and clients',
        zodSchema: z.object({
          status: z.enum(['Lead', 'Project', 'Completed', 'all']).optional().describe('Filter by status'),
          today: z.boolean().optional().describe('Only show leads from today'),
        }),
        execute(input) {
          console.log('Getting leads:', input);
          
          let relevantClients = input.status && input.status !== 'all'
            ? clients.filter(c => c.status === input.status)
            : clients;
          
          const today = new Date().toISOString().split('T')[0];
          if (input.today) {
            relevantClients = relevantClients.filter(c => c.lastContacted === today);
          }
          
          const leadCount = clients.filter(c => c.status === 'Lead').length;
          const projectCount = clients.filter(c => c.status === 'Project').length;
          const completedCount = clients.filter(c => c.status === 'Completed').length;
          const newToday = clients.filter(c => c.lastContacted === today).length;
          
          return JSON.stringify({
            success: true,
            totalClients: clients.length,
            leadsCount: leadCount,
            projectsCount: projectCount,
            completedCount: completedCount,
            newToday,
            clients: relevantClients.map(c => ({
              id: c.id,
              name: c.name,
              email: c.email,
              phone: c.phone,
              source: c.source,
              status: c.status,
              lastContacted: c.lastContacted,
            })),
          });
        },
      }),
      
      getEmployeeActivity: createRorkTool({
        description: 'Get information about employees working today',
        zodSchema: z.object({
          date: z.string().optional().describe('Date to check (ISO format), defaults to today'),
        }),
        execute(input) {
          console.log('Getting employee activity:', input);
          
          const targetDate = input.date || new Date().toISOString().split('T')[0];
          
          const activeEntries = clockEntries.filter(entry => {
            const clockInDate = entry.clockIn.split('T')[0];
            return clockInDate === targetDate;
          });
          
          const currentlyWorking = activeEntries.filter(entry => !entry.clockOut).length;
          const completedShifts = activeEntries.filter(entry => entry.clockOut).length;
          
          const totalHours = activeEntries
            .filter(entry => entry.clockOut)
            .reduce((sum, entry) => {
              const start = new Date(entry.clockIn).getTime();
              const end = new Date(entry.clockOut!).getTime();
              return sum + (end - start) / (1000 * 60 * 60);
            }, 0);
          
          return JSON.stringify({
            success: true,
            date: targetDate,
            totalEmployees: activeEntries.length,
            currentlyWorking,
            completedShifts,
            totalHoursWorked: totalHours.toFixed(2),
            entries: activeEntries.map(e => ({
              id: e.id,
              employeeId: e.employeeId,
              projectId: e.projectId,
              clockIn: e.clockIn,
              clockOut: e.clockOut,
              isActive: !e.clockOut,
            })),
          });
        },
      }),
      
      getSchedule: createRorkTool({
        description: 'Get schedule and task information',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Specific project ID'),
          dateRange: z.enum(['today', 'week', 'all']).optional().describe('Filter by date range'),
        }),
        execute(input) {
          console.log('Getting schedule:', input);
          
          let relevantTasks = input.projectId
            ? tasks.filter(t => t.projectId === input.projectId)
            : tasks;
          
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          const weekStr = weekFromNow.toISOString().split('T')[0];
          
          if (input.dateRange === 'today') {
            relevantTasks = relevantTasks.filter(t => t.date === todayStr);
          } else if (input.dateRange === 'week') {
            relevantTasks = relevantTasks.filter(t => t.date >= todayStr && t.date <= weekStr);
          }
          
          const completedTasks = relevantTasks.filter(t => t.completed).length;
          const pendingTasks = relevantTasks.filter(t => !t.completed).length;
          const upcomingTasks = relevantTasks
            .filter(t => !t.completed && t.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date));
          
          return JSON.stringify({
            success: true,
            totalTasks: relevantTasks.length,
            completedTasks,
            pendingTasks,
            upcomingTasks: upcomingTasks.map(t => ({
              id: t.id,
              projectId: t.projectId,
              name: t.name,
              date: t.date,
              reminder: t.reminder,
              completed: t.completed,
            })),
          });
        },
      }),
      
      createEstimate: createRorkTool({
        description: 'Create a new estimate for a project with line items',
        zodSchema: z.object({
          projectId: z.string().describe('The ID of the project to create estimate for'),
          estimateName: z.string().describe('Name of the estimate'),
          items: z.array(z.object({
            name: z.string().describe('Item name/description'),
            quantity: z.number().describe('Quantity'),
            unit: z.string().describe('Unit of measurement (EA, SF, LF, etc.)'),
            unitPrice: z.number().describe('Price per unit'),
            notes: z.string().optional().describe('Optional notes for the item'),
          })).describe('Array of line items for the estimate'),
          taxRate: z.number().optional().describe('Tax rate percentage (default 8)'),
          markupPercent: z.number().optional().describe('Markup percentage (default 0)'),
        }),
        execute(input) {
          console.log('Creating estimate:', input);
          const taxRate = input.taxRate ?? 8;
          const markupPercent = input.markupPercent ?? 0;
          
          const estimateItems = input.items.map((item, index) => ({
            id: `item-${Date.now()}-${index}`,
            priceListItemId: 'custom',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            notes: item.notes || '',
            customName: item.name,
            customUnit: item.unit,
            customCategory: 'AI Generated',
          }));
          
          const subtotal = estimateItems.reduce((sum, item) => sum + item.total, 0);
          const markupAmount = subtotal * (markupPercent / 100);
          const subtotalWithMarkup = subtotal + markupAmount;
          const taxAmount = subtotalWithMarkup * (taxRate / 100);
          const total = subtotalWithMarkup + taxAmount;
          
          const newEstimate = {
            id: `estimate-${Date.now()}`,
            projectId: input.projectId,
            name: input.estimateName,
            items: estimateItems,
            subtotal,
            taxRate,
            taxAmount,
            total,
            createdDate: new Date().toISOString(),
            status: 'draft' as const,
          };
          
          addEstimate(newEstimate);
          
          return JSON.stringify({
            success: true,
            estimateId: newEstimate.id,
            estimateName: input.estimateName,
            total: total.toFixed(2),
            itemCount: estimateItems.length,
          });
        },
      }),
      
      reviewBalances: createRorkTool({
        description: 'Review financial balances and budget status for projects',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Specific project ID to review, or all if not provided'),
        }),
        execute(input) {
          console.log('Reviewing balances for:', input.projectId || 'all projects');
          
          const relevantProjects = input.projectId 
            ? projects.filter(p => p.id === input.projectId)
            : projects;
          
          const balanceData = relevantProjects.map(project => {
            const projectEstimates = estimates.filter(e => e.projectId === project.id);
            const totalEstimated = projectEstimates.reduce((sum, e) => sum + e.total, 0);
            const draftEstimates = projectEstimates.filter(e => e.status === 'draft').length;
            const sentEstimates = projectEstimates.filter(e => e.status === 'sent').length;
            const approvedEstimates = projectEstimates.filter(e => e.status === 'approved').length;
            
            const remaining = project.budget - project.expenses;
            const percentSpent = (project.expenses / project.budget) * 100;
            
            return {
              projectId: project.id,
              projectName: project.name,
              budget: project.budget,
              expenses: project.expenses,
              remaining,
              percentSpent: percentSpent.toFixed(1),
              isOverBudget: project.expenses > project.budget,
              totalEstimated,
              estimatesCount: projectEstimates.length,
              draftEstimates,
              sentEstimates,
              approvedEstimates,
            };
          });
          
          return JSON.stringify({
            success: true,
            balances: balanceData,
            totalProjects: relevantProjects.length,
            totalBudget: relevantProjects.reduce((sum, p) => sum + p.budget, 0),
            totalExpenses: relevantProjects.reduce((sum, p) => sum + p.expenses, 0),
            totalEstimated: estimates.reduce((sum, e) => sum + e.total, 0),
          });
        },
      }),
      
      listProjects: createRorkTool({
        description: 'List all available projects with their IDs',
        zodSchema: z.object({}),
        execute() {
          console.log('Listing all projects');
          return JSON.stringify({
            success: true,
            projects: projects.map(p => ({
              id: p.id,
              name: p.name,
              status: p.status,
              budget: p.budget,
              expenses: p.expenses,
            })),
          });
        },
      }),
      
      searchPriceList: createRorkTool({
        description: 'Search the master price list to find construction items with pricing. Use this to create accurate estimates with real pricing data.',
        zodSchema: z.object({
          category: z.string().optional().describe('Filter by category (e.g., "Lumber and hardware material", "Plumbing", "Electricall")'),
          searchTerm: z.string().optional().describe('Search term to find items (searches in name and description)'),
          limit: z.number().optional().describe('Maximum number of results to return (default 50)'),
        }),
        execute(input) {
          console.log('Searching price list:', input);
          
          let results = [...masterPriceList];
          
          if (input.category) {
            results = results.filter(item => 
              item.category.toLowerCase().includes(input.category!.toLowerCase())
            );
          }
          
          if (input.searchTerm) {
            const term = input.searchTerm.toLowerCase();
            results = results.filter(item =>
              item.name.toLowerCase().includes(term) ||
              item.description.toLowerCase().includes(term) ||
              item.category.toLowerCase().includes(term)
            );
          }
          
          const limit = input.limit || 50;
          results = results.slice(0, limit);
          
          return JSON.stringify({
            success: true,
            totalResults: results.length,
            availableCategories: priceListCategories,
            items: results.map(item => ({
              id: item.id,
              category: item.category,
              name: item.name,
              description: item.description,
              unit: item.unit,
              unitPrice: item.unitPrice,
            })),
          });
        },
      }),
      
      getPriceListCategories: createRorkTool({
        description: 'Get all available categories in the price list',
        zodSchema: z.object({}),
        execute() {
          console.log('Getting price list categories');
          return JSON.stringify({
            success: true,
            categories: priceListCategories,
            totalItems: masterPriceList.length,
          });
        },
      }),
      
      analyzeDocumentForEstimate: createRorkTool({
        description: 'Helper tool to indicate when analyzing documents/images to create scope of work or estimates. This signals that document analysis is in progress.',
        zodSchema: z.object({
          documentType: z.string().describe('Type of document being analyzed (e.g., plans, blueprint, photo, PDF)'),
          purpose: z.string().describe('What the analysis is for (e.g., scope of work, estimate, takeoff)'),
        }),
        execute(input) {
          console.log('Analyzing document:', input);
          return JSON.stringify({
            success: true,
            message: `Analyzing ${input.documentType} for ${input.purpose}. Will use price list data for accurate pricing.`,
          });
        },
      }),
      
      addLeadToCRM: createRorkTool({
        description: 'Add a new lead to the CRM system with contact information and notes',
        zodSchema: z.object({
          name: z.string().describe('Lead/customer name'),
          phone: z.string().describe('Phone number'),
          email: z.string().optional().describe('Email address'),
          source: z.enum(['Google', 'Referral', 'Ad', 'Other']).optional().describe('How the lead was acquired'),
          notes: z.string().optional().describe('Important notes about the lead, conversation details, requirements'),
        }),
        execute(input) {
          console.log('[CRM] Adding lead to CRM:', input);
          return JSON.stringify({
            success: true,
            action: 'add_to_crm',
            leadData: {
              name: input.name,
              phone: input.phone || '',
              email: input.email || '',
              source: input.source || 'Other',
              notes: input.notes || '',
            },
          });
        },
      }),
      
      generateFloorLayout: createRorkTool({
        description: 'Generate a basic 2D floor layout/plan with notes and annotations. Use this when user asks for floor plans, 2D layouts, or top-down architectural sketches.',
        zodSchema: z.object({
          description: z.string().describe('Detailed description of the floor layout including rooms, dimensions, layout type (e.g., "3 bedroom house with open concept kitchen and living room, 2 bathrooms, total 1500 sq ft")'),
          notes: z.string().optional().describe('Important notes, specifications, or annotations to include on the plan (e.g., "12x15 master bedroom, 10x12 kitchen with island")'),
          style: z.enum(['basic', 'detailed', 'schematic']).optional().describe('Style of the floor plan (basic, detailed, schematic)'),
        }),
        async execute(input) {
          console.log('[Floor Layout] Generating floor layout:', input);
          
          try {
            const style = input.style || 'basic';
            const prompt = `Create a clean, professional floor plan/layout drawing. ${input.description}. ${input.notes ? `Include these notes and dimensions: ${input.notes}` : ''}. Style: ${style === 'basic' ? 'Simple black and white architectural floor plan with room labels' : style === 'detailed' ? 'Detailed architectural floor plan with dimensions, furniture placement, and annotations' : 'Schematic architectural floor plan with clear room divisions and basic measurements'}. Professional architectural drawing style, top-down view, clean lines, labeled rooms.`;
            
            const response = await fetch('https://toolkit.rork.com/images/generate/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt,
                size: '1024x1024',
              }),
            });
            
            if (!response.ok) {
              throw new Error('Failed to generate floor layout');
            }
            
            const data = await response.json();
            
            return JSON.stringify({
              success: true,
              message: 'Floor layout generated successfully',
              imageData: data.image.base64Data,
              mimeType: data.image.mimeType,
              description: input.description,
              notes: input.notes || 'No additional notes',
            });
          } catch (error) {
            console.error('[Floor Layout] Error generating layout:', error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to generate floor layout',
            });
          }
        },
      }),
      
      analyzeBlueprintTakeoff: createRorkTool({
        description: 'Analyze construction blueprints and plans to generate detailed material takeoff lists with quantities and costs. Use this when user uploads blueprints, plans, or construction drawings and asks for takeoff, material lists, or cost analysis.',
        zodSchema: z.object({
          categories: z.array(z.string()).optional().describe('Specific categories to analyze (e.g., ["Foundation", "Framing", "Electrical"]). If not specified, analyzes all categories.'),
          notes: z.string().optional().describe('Additional analysis instructions or specific areas of focus'),
        }),
        async execute(input) {
          console.log('[Blueprint Analysis] Analyzing blueprint for takeoff:', input);
          return JSON.stringify({
            success: true,
            message: 'Blueprint analysis completed. Based on the uploaded image, I can identify construction elements and provide material quantities. The analysis includes item names, quantities, units (SF, LF, EA), and recommendations from the price list.',
            categories: input.categories || ['All categories'],
            notes: input.notes || 'Complete blueprint analysis',
          });
        },
      }),
      
      generate3DSketch: createRorkTool({
        description: 'Generate a 3D sketch, rendering, or perspective view of a building, room, or construction element. Use this when user asks for 3D sketches, 3D renderings, perspective views, or isometric drawings.',
        zodSchema: z.object({
          description: z.string().describe('Detailed description of what to render in 3D (e.g., "exterior of 2-story modern house with garage", "kitchen interior with island and cabinets", "bathroom with walk-in shower and double vanity")'),
          viewType: z.enum(['exterior', 'interior', 'isometric', 'perspective']).describe('Type of 3D view (exterior for outside views, interior for room views, isometric for technical drawings, perspective for realistic views)'),
          notes: z.string().optional().describe('Additional details, materials, colors, or style preferences (e.g., "modern minimalist style, white walls, wood floors")'),
          style: z.enum(['realistic', 'sketch', 'technical']).optional().describe('Rendering style: realistic for photorealistic, sketch for hand-drawn look, technical for architectural drawing style'),
        }),
        async execute(input) {
          console.log('[3D Sketch] Generating 3D sketch:', input);
          
          try {
            const style = input.style || 'realistic';
            const styleDescription = style === 'realistic' 
              ? 'photorealistic architectural rendering, high quality, detailed materials and lighting' 
              : style === 'sketch' 
              ? 'hand-drawn architectural sketch style, pencil drawing, professional architectural illustration' 
              : 'technical architectural drawing, clean lines, isometric or perspective view, professional CAD-style rendering';
            
            const viewDescription = input.viewType === 'exterior' 
              ? 'exterior view showing the outside of the building' 
              : input.viewType === 'interior' 
              ? 'interior view showing the inside of the room or space' 
              : input.viewType === 'isometric' 
              ? 'isometric 3D view showing the space from an angled perspective' 
              : '3D perspective view with realistic depth and proportions';
            
            const prompt = `Create a professional 3D architectural ${viewDescription}. ${input.description}. ${input.notes ? `Details: ${input.notes}.` : ''} ${styleDescription}. High quality architectural visualization.`;
            
            const response = await fetch('https://toolkit.rork.com/images/generate/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt,
                size: '1024x1024',
              }),
            });
            
            if (!response.ok) {
              throw new Error('Failed to generate 3D sketch');
            }
            
            const data = await response.json();
            
            return JSON.stringify({
              success: true,
              message: '3D sketch generated successfully',
              imageData: data.image.base64Data,
              mimeType: data.image.mimeType,
              description: input.description,
              viewType: input.viewType,
              style: style,
              notes: input.notes || 'No additional notes',
            });
          } catch (error) {
            console.error('[3D Sketch] Error generating sketch:', error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to generate 3D sketch',
            });
          }
        },
      }),
    };
    return toolsObj;
  }, [projects, clients, expenses, clockEntries, tasks, estimates, addEstimate]);

  const { messages, error, sendMessage, status } = useRorkAgent({
    tools,
  });

  const isLoading = status === 'streaming';

  const startRecording = async () => {
    try {
      console.log('[Voice Mode] Starting recording...');
      setIsListening(true);
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } else {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        });

        await recording.startAsync();
        setRecordingInstance(recording);
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      if (!voiceMode) {
        setIsTranscribing(true);
      }

      if (Platform.OS === 'web') {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
          
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
        }
      } else {
        if (recordingInstance) {
          try {
            const status = await recordingInstance.getStatusAsync();
            if (status.canRecord || status.isRecording) {
              await recordingInstance.stopAndUnloadAsync();
              const uri = recordingInstance.getURI();
              if (uri) {
                const uriParts = uri.split('.');
                const fileType = uriParts[uriParts.length - 1];
                
                const audioFile = {
                  uri,
                  name: `recording.${fileType}`,
                  type: `audio/${fileType}`,
                };
                
                await transcribeAudio(audioFile);
              }
            }
          } catch (recordError) {
            console.error('Error stopping recording:', recordError);
          } finally {
            try {
              await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
            } catch (audioModeError) {
              console.error('Error resetting audio mode:', audioModeError);
            }
            setRecordingInstance(null);
          }
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsTranscribing(false);
      setIsListening(false);
    }
  };

  const stopSpeaking = useCallback(async () => {
    if (soundInstance) {
      try {
        const status = await soundInstance.getStatusAsync();
        if (status.isLoaded) {
          await soundInstance.stopAsync();
          await soundInstance.unloadAsync();
        }
      } catch (error) {
        console.error('Error stopping sound:', error);
      } finally {
        setSoundInstance(null);
      }
    }
    setIsSpeaking(false);
  }, [soundInstance]);

  const transcribeAudio = async (audio: Blob | { uri: string; name: string; type: string }) => {
    try {
      const formData = new FormData();
      
      if (audio instanceof Blob) {
        formData.append('audio', audio, 'recording.webm');
      } else {
        formData.append('audio', audio as any);
      }

      const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcribedText = data.text;
      
      console.log('[Voice Mode] Transcribed:', transcribedText);
      
      if (voiceMode && transcribedText.trim()) {
        console.log('[Voice Mode] Sending message in voice conversation mode');
        handleSendWithContext(transcribedText);
      } else {
        setInput(transcribedText);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      if (voiceMode) {
        console.log('[Voice Mode] Transcription failed, restarting listening');
        setTimeout(() => {
          setIsListening(true);
          startRecording();
        }, 1000);
      }
    } finally {
      if (!voiceMode) {
        setIsTranscribing(false);
      }
    }
  };

  const speakText = useCallback(async (text: string, autoNext = false) => {
    try {
      if (isSpeaking && !autoNext) {
        await stopSpeaking();
        return;
      }

      if (isSpeaking && autoNext) {
        await stopSpeaking();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );

      setSoundInstance(sound);
      setIsSpeaking(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false);
          sound.unloadAsync().catch(console.error);
          setSoundInstance(null);
          
          if (voiceMode && autoNext) {
            console.log('[Voice Mode] AI finished speaking, listening again');
            setTimeout(() => {
              setIsListening(true);
              startRecording();
            }, 500);
          }
        }
      });
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  }, [isSpeaking, stopSpeaking, voiceMode]);

  useEffect(() => {
    return () => {
      if (soundInstance) {
        soundInstance.getStatusAsync().then((status) => {
          if (status.isLoaded) {
            soundInstance.unloadAsync().catch(console.error);
          }
        }).catch(console.error);
      }
      if (recordingInstance) {
        recordingInstance.getStatusAsync().then((status) => {
          if (status.canRecord || status.isRecording) {
            recordingInstance.stopAndUnloadAsync().catch(console.error);
          }
        }).catch(console.error);
      }
    };
  }, [soundInstance, recordingInstance]);

  const handleSendWithContext = (userInput: string) => {
    if (!user) {
      console.warn('[Chat] No user found, blocking request');
      return;
    }

    const blockCheck = shouldBlockChatbotQuery(user.role, userInput);
    if (blockCheck.shouldBlock) {
      console.log('[Chat] Query blocked for role:', user.role);
      return;
    }

    const restrictionLevel = getChatbotRestrictionLevel(user.role);
    let systemInstructions = '';

    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    if (restrictionLevel === 'basic-only') {
      systemInstructions = `You are a friendly and conversational construction management AI assistant. Today is ${dateString}.\n\nIMPORTANT - Your personality and style:\n- Be natural, warm, and conversational - like a real person chatting\n- Respond to greetings naturally (e.g., "Hey, how are you?" → "I'm doing great, thanks for asking! How can I help you today?")\n- Use casual, friendly language while remaining professional\n- Answer general questions normally and conversationally\n- ONLY refuse if specifically asked about: estimates, pricing, budgets, contracts, financial data, or payments\n- If asked about restricted topics, say: "Lo siento, no tengo acceso a esa información. Contacta con tu administrador."\n- Focus on being helpful and personable in every interaction\n\nBe conversational, engaging, and helpful!`;
    } else if (restrictionLevel === 'no-financials') {
      systemInstructions = `You are a friendly and conversational construction management AI assistant. Today is ${dateString}.\n\nIMPORTANT - Your personality and style:\n- Be natural, warm, and conversational - like a real person chatting\n- Respond to greetings naturally (e.g., "Hey, how are you?" → "I'm doing great, thanks for asking! How can I help you today?")\n- Use casual, friendly language while remaining professional\n- Answer general questions normally and conversationally\n- ONLY refuse if specifically asked about: internal pricing, costs, contract terms, payment status, or financial reports\n- If asked about restricted topics, say: "Lo siento, no puedo proporcionar esa información. Contacta con tu administrador."\n- Focus on being helpful and personable in every interaction\n\nBe conversational, engaging, and helpful!`;
    } else {
      systemInstructions = `You are a friendly and conversational construction management AI assistant with full access. Today is ${dateString}.\n\nIMPORTANT - Your personality and style:\n- Be natural, warm, and conversational - like a real person chatting\n- Respond to greetings naturally (e.g., "Hey, how are you?" → "I'm doing great, thanks for asking! How can I help you today?")\n- Use casual, friendly language while remaining professional\n- Be helpful, engaging, and personable\n- Answer questions directly and conversationally\n- Treat each interaction like a natural conversation\n\nBe conversational, engaging, and helpful!`;
    }
    
    const contextMessage = `${systemInstructions}\n\nContext: ${getContextForCurrentPage()}\n\n---\n\nUser question: ${userInput}`;
    sendMessage(contextMessage);
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      if (voiceMode && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'assistant' && status !== 'streaming') {
          const textParts = lastMessage.parts.filter(p => p.type === 'text');
          if (textParts.length > 0) {
            const lastTextPart = textParts[textParts.length - 1];
            if (lastTextPart.type === 'text' && lastTextPart.text) {
              console.log('[Voice Mode] AI response received, speaking now');
              setTimeout(() => {
                speakText(lastTextPart.text, true);
              }, 300);
            }
          }
        }
      }
    }
  }, [messages, status, voiceMode, speakText]);

  const handlePickFile = async () => {
    try {
      console.log('[Attachment] Opening document picker...');
      setShowAttachMenu(false);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      console.log('[Attachment] Document picker result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        console.log('[Attachment] Selected file:', file.name, 'Type:', file.mimeType, 'Size:', file.size);
        
        const mimeType = getSanitizedMimeType(file.mimeType, file.name);
        
        const supportedTypes = [
          'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        const isImage = mimeType.startsWith('image/');
        const isSupported = supportedTypes.some(type => mimeType === type) || isImage;
        
        if (!isSupported) {
          alert(`Tipo de archivo no compatible: ${mimeType}\n\nTipos compatibles:\n- Imágenes (PNG, JPG, GIF, WebP)\n- PDF\n- Word (.doc, .docx)\n- Excel (.xls, .xlsx)`);
          return;
        }
        
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.name,
          mimeType,
          size: file.size || 0,
          type: 'file',
        };
        console.log('[Attachment] File successfully attached:', newFile.name);
        setAttachedFiles([...attachedFiles, newFile]);
      } else {
        console.log('[Attachment] Document picker canceled or no assets');
      }
    } catch (error) {
      console.error('[Attachment] Error picking file:', error);
      if (error instanceof Error) {
        console.error('[Attachment] Error message:', error.message);
        console.error('[Attachment] Error stack:', error.stack);
        alert(`Error al seleccionar archivo: ${error.message}`);
      }
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const handlePickImage = async () => {
    try {
      console.log('[Attachment] Opening image picker...');
      setShowAttachMenu(false);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.fileName || `image_${Date.now()}.jpg`,
          mimeType: getSanitizedMimeType(file.mimeType, file.fileName || `image_${Date.now()}.jpg`),
          size: file.fileSize || 0,
          type: 'file',
        };
        console.log('[Attachment] Image successfully attached:', newFile.name);
        setAttachedFiles([...attachedFiles, newFile]);
      } else {
        console.log('[Attachment] Image picker canceled');
      }
    } catch (error) {
      console.error('[Attachment] Error picking image:', error);
      if (error instanceof Error) {
        alert(`Error al seleccionar imagen: ${error.message}`);
      }
    }
  };

  const handleTakePhoto = async () => {
    try {
      console.log('[Attachment] Requesting camera permission...');
      setShowAttachMenu(false);
      
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Attachment] Camera permission denied');
        alert('Se requiere permiso de cámara para tomar fotos. Por favor habilítalo en la configuración de tu dispositivo.');
        return;
      }
      
      console.log('[Attachment] Opening camera...');
      
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.fileName || `photo_${Date.now()}.jpg`,
          mimeType: getSanitizedMimeType(file.mimeType, file.fileName || `photo_${Date.now()}.jpg`),
          size: file.fileSize || 0,
          type: 'file',
        };
        console.log('[Attachment] Photo successfully captured:', newFile.name);
        setAttachedFiles([...attachedFiles, newFile]);
      } else {
        console.log('[Attachment] Camera canceled');
      }
    } catch (error) {
      console.error('[Attachment] Error taking photo:', error);
      if (error instanceof Error) {
        alert(`Error al tomar foto: ${error.message}`);
      }
    }
  };

  const convertFileToBase64 = async (file: AttachedFile): Promise<string> => {
    try {
      console.log('[File Conversion] Starting conversion for:', file.name, 'Platform:', Platform.OS);
      
      if (Platform.OS === 'web') {
        console.log('[File Conversion Web] File URI:', file.uri.substring(0, 50));
        
        // Check if the URI is already a data URL
        if (file.uri.startsWith('data:')) {
          console.log('[File Conversion Web] URI is already a data URL');
          const base64 = file.uri.split(',')[1];
          if (!base64) {
            throw new Error('Invalid data URL format');
          }
          return base64;
        }
        
        // For blob: URLs on web
        console.log('[File Conversion Web] Fetching blob from:', file.uri);
        const response = await fetch(file.uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        console.log('[File Conversion Web] Blob size:', blob.size, 'Type:', blob.type);
        
        if (blob.size === 0) {
          throw new Error('File is empty');
        }
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              const result = reader.result as string;
              if (!result) {
                reject(new Error('FileReader returned empty result'));
                return;
              }
              const base64Data = result.split(',')[1];
              if (!base64Data) {
                reject(new Error('Failed to extract base64 data'));
                return;
              }
              console.log('[File Conversion Web] Conversion successful, base64 length:', base64Data.length);
              resolve(base64Data);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = (error) => {
            console.error('[File Conversion Web] FileReader error:', error);
            reject(new Error('FileReader failed to read file'));
          };
          reader.readAsDataURL(blob);
        });
      } else {
        console.log('[File Conversion Native] Reading file from:', file.uri);
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'base64' as any,
        });
        if (!base64 || base64.length === 0) {
          throw new Error('Failed to read file or file is empty');
        }
        console.log('[File Conversion Native] Conversion successful, base64 length:', base64.length);
        return base64;
      }
    } catch (error) {
      console.error('[File Conversion] Error converting file to base64:', error);
      if (error instanceof Error) {
        console.error('[File Conversion] Error message:', error.message);
        console.error('[File Conversion] Error stack:', error.stack);
      }
      throw new Error(`No se pudo procesar el archivo ${file.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
    
    if (attachedFiles.length > 0) {
      try {
        console.log('[Send] Processing attached files:', attachedFiles.length);
        const filesForMessage: AgentMessageFile[] = [];
        
        for (let i = 0; i < attachedFiles.length; i++) {
          const file = attachedFiles[i];
          console.log(`[Send] Processing file ${i + 1}/${attachedFiles.length}:`, file.name, file.mimeType, 'size bytes:', file.size);
          
          if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
            const sizeMB = Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024));
            alert(`El archivo ${file.name} es demasiado grande. Por favor sube archivos menores a ${sizeMB}MB.`);
            return;
          }
          
          try {
            const base64 = await convertFileToBase64(file);
            console.log(`[Send] File ${i + 1} converted successfully, base64 length:`, base64.length);
            
            filesForMessage.push({
              type: 'file',
              mimeType: file.mimeType,
              name: file.name,
              data: base64,
              uri: `data:${file.mimeType};base64,${base64}`,
              size: file.size,
            });
          } catch (conversionError) {
            console.error(`[Send] Failed to convert file ${file.name}:`, conversionError);
            const errorMsg = conversionError instanceof Error ? conversionError.message : 'Error desconocido';
            alert(`Error al procesar ${file.name}: ${errorMsg}`);
            return;
          }
        }
        
        console.log('[Send] All files converted successfully, preparing to send message');
        
        const userMessage = input.trim() || 'Por favor analiza los archivos adjuntos';
        
        if (!user) {
          console.warn('[Send] No user found, blocking request');
          alert('Usuario no encontrado. Por favor inicia sesión.');
          return;
        }

        const blockCheck = shouldBlockChatbotQuery(user.role, userMessage);
        if (blockCheck.shouldBlock) {
          console.log('[Send] Query blocked for role:', user.role);
          alert('No tienes permisos para realizar esta consulta.');
          return;
        }

        const restrictionLevel = getChatbotRestrictionLevel(user.role);
        let systemInstructions = '';

        const currentDate = new Date();
        const dateString = currentDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        if (restrictionLevel === 'basic-only') {
          systemInstructions = `You are a friendly, conversational construction AI assistant. Today is ${dateString}. Be natural and personable - respond to greetings warmly. ONLY refuse if asked about: estimates, pricing, budgets, contracts, or financial data. If restricted: "Lo siento, no tengo acceso. Contacta con tu administrador."`;
        } else if (restrictionLevel === 'no-financials') {
          systemInstructions = `You are a friendly, conversational construction AI assistant. Today is ${dateString}. Be natural and personable - respond to greetings warmly. ONLY refuse if asked about: internal pricing, costs, contract terms, or financial reports. If restricted: "Lo siento, no puedo proporcionar esa información. Contacta con tu administrador."`;
        } else {
          systemInstructions = `You are a friendly, conversational construction AI assistant with full access. Today is ${dateString}. Be natural, warm, and conversational - like chatting with a helpful colleague.`;
        }
        
        const contextMessage = `${systemInstructions}\n\nContext: ${getContextForCurrentPage()}`;
        const fullMessage = `${contextMessage}\n\n---\n\nUser has attached ${filesForMessage.length} file(s) for analysis.\n\nUser question: ${userMessage}`;
        
        console.log('[Send] Sending message with', filesForMessage.length, 'files to AI');
        console.log('[Send] Files:', filesForMessage.map(f => ({ name: f.name, type: f.mimeType, dataLength: f.data?.length || 0 })));
        
        sendMessage({ text: fullMessage, files: filesForMessage as any });
        
        console.log('[Send] Message sent successfully, clearing input and files');
        setInput('');
        setAttachedFiles([]);
      } catch (error) {
        console.error('[Send] Error sending message with files:', error);
        if (error instanceof Error) {
          console.error('[Send] Error details:', error.message, error.stack);
        }
        const errorMessage = error instanceof Error ? error.message : 'Error al subir el documento';
        alert(`Error: ${errorMessage}`);
      }
    } else {
      handleSendWithContext(input);
      setInput('');
    }
  };

  if ((isOnChatScreen && !inline) || isOnAuthScreen || !user) {
    return null;
  }

  if (inline) {
    return (
      <View style={styles.inlineContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Bot size={56} color="#D1D5DB" strokeWidth={2} />
              <Text style={styles.emptyStateTitle}>Ask me anything!</Text>
              <Text style={styles.emptyStateText}>
                Hey there! I’m here to chat and help with {pathname.includes('dashboard') ? 'projects, budgets, and creating estimates from plans/photos' : pathname.includes('crm') ? 'clients, leads, and call notes' : pathname.includes('schedule') ? 'tasks and schedule' : pathname.includes('expenses') ? 'expenses' : pathname.includes('estimate') ? 'estimates with accurate pricing' : 'anything you need'}. Feel free to say hi, ask me how I’m doing, or jump right into questions! I can analyze images, PDFs, Word documents, and Excel files. You can also use voice to chat with me naturally.
              </Text>
            </View>
          )}

          {messages.map((message) => (
            <View key={message.id} style={styles.messageWrapper}>
              {message.role === 'user' ? (
                <View style={styles.userMessageContainer}>
                  <View style={styles.userMessage}>
                    {message.parts.map((part, i) => {
                      if (part.type === 'text') {
                        return (
                          <Text key={i} style={styles.userMessageText} selectable>
                            {part.text}
                          </Text>
                        );
                      }

                      return null;
                    })}
                  </View>
                </View>
              ) : (
                <View style={styles.assistantMessageContainer}>
                  <View style={styles.assistantMessage}>
                    {message.parts.map((part, i) => {
                      if (part.type === 'text') {
                        return (
                          <View key={i}>
                            <Text style={styles.assistantMessageText} selectable>
                              {part.text}
                            </Text>
                            {part.text && (
                              <TouchableOpacity
                                style={styles.speakButton}
                                onPress={() => speakText(part.text)}
                              >
                                <Volume2 size={14} color={isSpeaking ? '#DC2626' : '#6B7280'} />
                                <Text style={styles.speakButtonText}>
                                  {isSpeaking ? 'Stop' : 'Speak'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      }
                      if (part.type === 'tool') {
                        const toolName = part.toolName;
                        
                        if (part.state === 'input-streaming' || part.state === 'input-available') {
                          return (
                            <View key={i} style={styles.toolExecuting}>
                              <ActivityIndicator size="small" color="#2563EB" />
                              <Text style={styles.toolText}>Executing {toolName}...</Text>
                            </View>
                          );
                        }
                        
                        if (part.state === 'output-available') {
                          if ((toolName === 'generateFloorLayout' || toolName === 'generate3DSketch') && part.output) {
                            try {
                              const outputData = JSON.parse(part.output as string);
                              console.log('[Sketch Inline] Output:', toolName, 'success:', outputData.success, 'hasImage:', !!outputData.imageData);
                              if (outputData.success && outputData.imageData) {
                                const imageUri = `data:${outputData.mimeType};base64,${outputData.imageData}`;
                                console.log('[Sketch Inline] Image URI length:', imageUri.length);
                                return (
                                  <View key={i} style={styles.floorLayoutContainer}>
                                    <Text style={styles.toolSuccessText}>
                                      ✓ {toolName === 'generateFloorLayout' ? 'Floor layout' : '3D sketch'} generated
                                    </Text>
                                    <Image 
                                      source={{ uri: imageUri }} 
                                      style={styles.floorLayoutImage}
                                      resizeMode="contain"
                                      onLoad={() => console.log('[Sketch Inline] Image loaded')}
                                      onError={(error) => console.error('[Sketch Inline] Image error:', error.nativeEvent)}
                                    />
                                    {outputData.notes && (
                                      <Text style={styles.floorLayoutNotes}>{outputData.notes}</Text>
                                    )}
                                    {outputData.viewType && (
                                      <Text style={styles.floorLayoutNotes}>
                                        View: {outputData.viewType} | Style: {outputData.style}
                                      </Text>
                                    )}
                                  </View>
                                );
                              } else {
                                console.warn('[Sketch Inline] Missing image data');
                              }
                            } catch (e) {
                              console.error('[Sketch Inline] Parse error:', e);
                            }
                          }
                          return (
                            <View key={i} style={styles.toolSuccess}>
                              <Text style={styles.toolSuccessText}>✓ {toolName} completed</Text>
                            </View>
                          );
                        }
                        
                        if (part.state === 'output-error') {
                          return (
                            <View key={i} style={styles.toolError}>
                              <Text style={styles.toolErrorText}>✕ Error: {part.errorText}</Text>
                            </View>
                          );
                        }
                      }
                      return null;
                    })}
                  </View>
                </View>
              )}
            </View>
          ))}

          {isLoading && (
            <View style={styles.assistantMessageContainer}>
              <View style={styles.assistantMessage}>
                <ActivityIndicator size="small" color="#2563EB" />
              </View>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error: {error.message}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputWrapper}>
          {voiceMode && (
            <View style={[styles.recordingBanner, isSpeaking ? styles.recordingBannerSpeaking : styles.recordingBannerListening]}>
              {isSpeaking ? (
                <>
                  <Volume2 size={20} color="#10B981" />
                  <Text style={[styles.voiceModeText, { color: '#10B981' }]}>AI is speaking...</Text>
                </>
              ) : isListening ? (
                <>
                  <View style={styles.listeningAnimation}>
                    <View style={[styles.listeningDot, styles.listeningDot1]} />
                    <View style={[styles.listeningDot, styles.listeningDot2]} />
                    <View style={[styles.listeningDot, styles.listeningDot3]} />
                  </View>
                  <Text style={[styles.voiceModeText, { color: '#2563EB' }]}>Listening... speak now</Text>
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color="#F59E0B" />
                  <Text style={[styles.voiceModeText, { color: '#F59E0B' }]}>Processing...</Text>
                </>
              )}
            </View>
          )}
          {!voiceMode && (isTranscribing || isRecording) && (
            <View style={styles.recordingBanner}>
              {isTranscribing ? (
                <>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.recordingText}>Transcribing audio...</Text>
                </>
              ) : (
                <>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording...</Text>
                </>
              )}
            </View>
          )}
          {attachedFiles.length > 0 && (
            <ScrollView
              horizontal
              style={styles.attachmentsContainer}
              contentContainerStyle={styles.attachmentsContent}
              showsHorizontalScrollIndicator={false}
            >
              {attachedFiles.map((file, index) => (
                <View key={index} style={styles.attachmentItem}>
                  {file.mimeType.startsWith('image/') ? (
                    <Image source={{ uri: file.uri }} style={styles.attachmentImage} />
                  ) : (
                    <View style={styles.attachmentFileIcon}>
                      <FileIcon size={24} color="#6B7280" />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeAttachment}
                    onPress={() => removeFile(index)}
                  >
                    <X size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {file.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={[styles.voiceModeButton, voiceMode && styles.voiceModeButtonActive]}
              onPress={() => {
                if (!voiceMode) {
                  console.log('[Voice Mode] Starting voice conversation - tap Voice button again to stop');
                  setVoiceMode(true);
                  setTimeout(() => {
                    setIsListening(true);
                    startRecording();
                  }, 300);
                } else {
                  console.log('[Voice Mode] Stopping voice conversation');
                  setVoiceMode(false);
                  setIsListening(false);
                  if (isSpeaking) {
                    stopSpeaking();
                  }
                  if (isRecording) {
                    stopRecording();
                  }
                }
              }}
              disabled={isLoading && !voiceMode}
            >
              <Volume2 size={22} color={voiceMode ? '#FFFFFF' : '#6B7280'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => setShowAttachMenu(true)}
              disabled={isLoading || isRecording || voiceMode}
            >
              <Paperclip size={22} color={voiceMode ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
            {isRecording ? (
              <TouchableOpacity
                style={styles.recordingButton}
                onPress={stopRecording}
              >
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingButtonText}>Tap to stop</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder={voiceMode ? "Voice mode active - tap Voice button to stop" : "Say hi or ask me anything..."}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                  editable={!isLoading && !isTranscribing && !voiceMode}
                />
                <TouchableOpacity
                  style={[styles.micButton, voiceMode && styles.micButtonActive]}
                  onPress={startRecording}
                  disabled={isLoading || isTranscribing}
                >
                  <Mic size={20} color={voiceMode ? '#FFFFFF' : '#6B7280'} />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[styles.sendButton, (isLoading || isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0) || voiceMode) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={isLoading || isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0) || voiceMode}
            >
              <Send size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setIsOpen(true)}
      >
        <Bot size={28} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={[styles.modalContent, isSmallScreen && styles.modalContentMobile]}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.aiIcon}>
                  <Bot size={22} color="#2563EB" strokeWidth={2.5} />
                </View>
                <Text style={styles.headerTitle}>AI Assistant</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsOpen(false)}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 && (
                <View style={styles.emptyState}>
                  <Bot size={56} color="#D1D5DB" strokeWidth={2} />
                  <Text style={styles.emptyStateTitle}>Ask me anything!</Text>
                  <Text style={styles.emptyStateText}>
                    Hey there! I’m here to chat and help with {pathname.includes('dashboard') ? 'projects, budgets, and creating estimates from plans/photos' : pathname.includes('crm') ? 'clients, leads, and call notes' : pathname.includes('schedule') ? 'tasks and schedule' : pathname.includes('expenses') ? 'expenses' : pathname.includes('estimate') ? 'estimates with accurate pricing' : 'anything you need'}. Feel free to say hi, ask me how I’m doing, or jump right into questions! I can analyze images, PDFs, Word docs, and Excel files. I can also create 2D floor layouts and 3D sketches. You can use voice to chat with me naturally too!
                  </Text>
                </View>
              )}

              {messages.map((message) => (
                <View key={message.id} style={styles.messageWrapper}>
                  {message.role === 'user' ? (
                    <View style={styles.userMessageContainer}>
                      <View style={styles.userMessage}>
                        {message.parts.map((part, i) => {
                          if (part.type === 'text') {
                            return (
                              <Text key={i} style={styles.userMessageText} selectable>
                                {part.text}
                              </Text>
                            );
                          }

                          return null;
                        })}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.assistantMessageContainer}>
                      <View style={styles.assistantMessage}>
                        {message.parts.map((part, i) => {
                          if (part.type === 'text') {
                            return (
                              <View key={i}>
                                <Text style={styles.assistantMessageText} selectable>
                                  {part.text}
                                </Text>
                                {part.text && (
                                  <TouchableOpacity
                                    style={styles.speakButton}
                                    onPress={() => speakText(part.text)}
                                  >
                                    <Volume2 size={14} color={isSpeaking ? '#DC2626' : '#6B7280'} />
                                    <Text style={styles.speakButtonText}>
                                      {isSpeaking ? 'Stop' : 'Speak'}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            );
                          }
                          if (part.type === 'tool') {
                            const toolName = part.toolName;
                            
                            if (part.state === 'input-streaming' || part.state === 'input-available') {
                              return (
                                <View key={i} style={styles.toolExecuting}>
                                  <ActivityIndicator size="small" color="#2563EB" />
                                  <Text style={styles.toolText}>Executing {toolName}...</Text>
                                </View>
                              );
                            }
                            
                            if (part.state === 'output-available') {
                              if ((toolName === 'generateFloorLayout' || toolName === 'generate3DSketch') && part.output) {
                                try {
                                  const outputData = JSON.parse(part.output as string);
                                  console.log('[Sketch Modal] Output:', toolName, 'success:', outputData.success, 'hasImage:', !!outputData.imageData);
                                  if (outputData.success && outputData.imageData) {
                                    const imageUri = `data:${outputData.mimeType};base64,${outputData.imageData}`;
                                    console.log('[Sketch Modal] Image URI length:', imageUri.length);
                                    return (
                                      <View key={i} style={styles.floorLayoutContainer}>
                                        <Text style={styles.toolSuccessText}>
                                          ✓ {toolName === 'generateFloorLayout' ? 'Floor layout' : '3D sketch'} generated
                                        </Text>
                                        <Image 
                                          source={{ uri: imageUri }} 
                                          style={styles.floorLayoutImage}
                                          resizeMode="contain"
                                          onLoad={() => console.log('[Sketch Modal] Image loaded')}
                                          onError={(error) => console.error('[Sketch Modal] Image error:', error.nativeEvent)}
                                        />
                                        {outputData.notes && (
                                          <Text style={styles.floorLayoutNotes}>{outputData.notes}</Text>
                                        )}
                                        {outputData.viewType && (
                                          <Text style={styles.floorLayoutNotes}>
                                            View: {outputData.viewType} | Style: {outputData.style}
                                          </Text>
                                        )}
                                      </View>
                                    );
                                  } else {
                                    console.warn('[Sketch Modal] Missing image data');
                                  }
                                } catch (e) {
                                  console.error('[Sketch Modal] Parse error:', e);
                                }
                              }
                              return (
                                <View key={i} style={styles.toolSuccess}>
                                  <Text style={styles.toolSuccessText}>✓ {toolName} completed</Text>
                                </View>
                              );
                            }
                            
                            if (part.state === 'output-error') {
                              return (
                                <View key={i} style={styles.toolError}>
                                  <Text style={styles.toolErrorText}>✕ Error: {part.errorText}</Text>
                                </View>
                              );
                            }
                          }
                          return null;
                        })}
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {isLoading && (
                <View style={styles.assistantMessageContainer}>
                  <View style={styles.assistantMessage}>
                    <ActivityIndicator size="small" color="#2563EB" />
                  </View>
                </View>
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Error: {error.message}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.inputWrapper}>
              {(isTranscribing || isRecording) && (
                <View style={styles.recordingBanner}>
                  {isTranscribing ? (
                    <>
                      <ActivityIndicator size="small" color="#2563EB" />
                      <Text style={styles.recordingText}>Transcribing audio...</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.recordingDot} />
                      <Text style={styles.recordingText}>Recording...</Text>
                    </>
                  )}
                </View>
              )}
              {attachedFiles.length > 0 && (
                <ScrollView
                  horizontal
                  style={styles.attachmentsContainer}
                  contentContainerStyle={styles.attachmentsContent}
                  showsHorizontalScrollIndicator={false}
                >
                  {attachedFiles.map((file, index) => (
                    <View key={index} style={styles.attachmentItem}>
                      {file.mimeType.startsWith('image/') ? (
                        <Image source={{ uri: file.uri }} style={styles.attachmentImage} />
                      ) : (
                        <View style={styles.attachmentFileIcon}>
                          <FileIcon size={24} color="#6B7280" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeAttachment}
                        onPress={() => removeFile(index)}
                      >
                        <X size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {file.name}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  style={[styles.voiceModeButton, voiceMode && styles.voiceModeButtonActive]}
                  onPress={() => {
                    if (!voiceMode) {
                      console.log('[Voice Mode] Starting voice conversation');
                      setVoiceMode(true);
                      setTimeout(() => {
                        setIsListening(true);
                        startRecording();
                      }, 300);
                    } else {
                      console.log('[Voice Mode] Stopping voice conversation');
                      setVoiceMode(false);
                      setIsListening(false);
                      if (isSpeaking) {
                        stopSpeaking();
                      }
                      if (isRecording) {
                        stopRecording();
                      }
                    }
                  }}
                  disabled={isLoading && !voiceMode}
                >
                  <Volume2 size={20} color={voiceMode ? '#FFFFFF' : '#6B7280'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={() => setShowAttachMenu(true)}
                  disabled={isLoading || isRecording || voiceMode}
                >
                  <Paperclip size={22} color={voiceMode ? '#D1D5DB' : '#6B7280'} />
                </TouchableOpacity>
                {isRecording ? (
                  <TouchableOpacity
                    style={styles.recordingButton}
                    onPress={stopRecording}
                  >
                    <View style={styles.recordingIndicator}>
                      <View style={styles.recordingDot} />
                      <Text style={styles.recordingButtonText}>Tap to stop</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TextInput
                      style={styles.input}
                      value={input}
                      onChangeText={setInput}
                      placeholder={voiceMode ? "Voice mode active - tap Voice button to stop" : "Say hi or ask me anything..."}
                      placeholderTextColor="#9CA3AF"
                      multiline
                      maxLength={500}
                      editable={!isLoading && !isTranscribing && !voiceMode}
                    />
                    <TouchableOpacity
                      style={[styles.micButton, voiceMode && styles.micButtonActive]}
                      onPress={startRecording}
                      disabled={isLoading || isTranscribing}
                    >
                      <Mic size={20} color={voiceMode ? '#FFFFFF' : '#6B7280'} />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.sendButton, (isLoading || isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0) || voiceMode) && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={isLoading || isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0) || voiceMode}
                >
                  <Send size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showAttachMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <TouchableOpacity 
          style={styles.attachModalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachMenu(false)}
        >
          <TouchableOpacity 
            style={styles.attachMenu}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.attachMenuHandle} />
            
            <Text style={styles.attachMenuTitle}>Attach File</Text>
            
            <TouchableOpacity style={styles.attachOption} onPress={handleTakePhoto}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#EF4444' }]}>
                <ImageIcon size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.attachOptionText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.attachOption} onPress={handlePickImage}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#8B5CF6' }]}>
                <ImageIcon size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.attachOptionText}>Photo Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.attachOption} onPress={handlePickFile}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#3B82F6' }]}>
                <Paperclip size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.attachOptionText}>Document / PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.attachCancelButton}
              onPress={() => setShowAttachMenu(false)}
            >
              <Text style={styles.attachCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inlineContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  floatingButton: {
    position: 'absolute' as const,
    bottom: 90,
    left: 16,
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 998,
  },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  inlineButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#8B5CF6',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    maxHeight: 700,
  },
  modalContentMobile: {
    height: '95%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  messageWrapper: {
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  userMessage: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    maxWidth: '80%',
  },
  userMessageText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  assistantMessage: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: '80%',
  },
  assistantMessageText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  attachmentsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  attachmentsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  attachmentItem: {
    position: 'relative' as const,
    width: 80,
  },
  attachmentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  attachmentFileIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAttachment: {
    position: 'absolute' as const,
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  attachmentName: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  attachButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  toolExecuting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  toolText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500' as const,
  },
  toolSuccess: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
  },
  toolSuccessText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500' as const,
  },
  toolError: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  toolErrorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500' as const,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  recordingBannerListening: {
    backgroundColor: '#DBEAFE',
    borderBottomColor: '#93C5FD',
  },
  recordingBannerSpeaking: {
    backgroundColor: '#D1FAE5',
    borderBottomColor: '#6EE7B7',
  },
  listeningAnimation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  listeningDot1: {
    opacity: 0.4,
  },
  listeningDot2: {
    opacity: 0.7,
  },
  listeningDot3: {
    opacity: 1,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  voiceModeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  recordingButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordingButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  micButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignSelf: 'flex-start',
  },
  speakButtonText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  voiceModeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceModeButtonActive: {
    backgroundColor: '#10B981',
  },
  micButtonActive: {
    backgroundColor: '#10B981',
    borderRadius: 22,
  },
  floorLayoutContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  floorLayoutImage: {
    width: '100%',
    height: 300,
    marginTop: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  floorLayoutNotes: {
    marginTop: 8,
    fontSize: 12,
    color: '#166534',
    fontStyle: 'italic' as const,
  },
  attachModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachMenu: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  attachMenuHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  attachMenuTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  attachIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  attachCancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginTop: 8,
    alignItems: 'center',
  },
  attachCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
});
