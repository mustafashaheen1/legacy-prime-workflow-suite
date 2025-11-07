import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { Bot, X, Send, Paperclip, File as FileIcon, Mic, Volume2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useState, useRef, useEffect } from 'react';
import { createRorkTool, useRorkAgent } from '@rork/toolkit-sdk';
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

type AttachedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  type: 'file';
};

export default function GlobalAIChat({ currentPageContext, inline = false }: GlobalAIChatProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [soundInstance, setSoundInstance] = useState<Audio.Sound | null>(null);
  const [voiceMode, setVoiceMode] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pathname = usePathname();
  const isOnChatScreen = pathname === '/chat';
  const isOnAuthScreen = pathname === '/login' || pathname === '/subscription';
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

  const { messages, error, sendMessage, status } = useRorkAgent({
    tools: {
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
        description: 'Generate a basic floor layout/plan with notes and annotations. Use this when user asks for floor plans, layouts, or architectural sketches.',
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
    },
  });

  const isLoading = status === 'streaming';

  const startRecording = async () => {
    try {
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
      setIsTranscribing(true);

      if (Platform.OS === 'web') {
        if (mediaRecorderRef.current) {
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
          await recordingInstance.stopAndUnloadAsync();
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
          
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
          setRecordingInstance(null);
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsTranscribing(false);
    }
  };

  const stopSpeaking = async () => {
    if (soundInstance) {
      await soundInstance.stopAsync();
      await soundInstance.unloadAsync();
      setSoundInstance(null);
    }
    setIsSpeaking(false);
  };

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
      setInput(transcribedText);
      
      if (voiceMode && transcribedText.trim()) {
        setTimeout(() => {
          handleSendWithContext(transcribedText);
          setInput('');
        }, 300);
      }
    } catch (error) {
      console.error('Transcription error:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const speakText = async (text: string, autoNext = false) => {
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
          sound.unloadAsync();
          setSoundInstance(null);
          
          if (voiceMode && autoNext) {
            setTimeout(() => {
              startRecording();
            }, 500);
          }
        }
      });
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    return () => {
      if (soundInstance) {
        soundInstance.unloadAsync();
      }
      if (recordingInstance) {
        recordingInstance.stopAndUnloadAsync();
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
      const blockedMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant' as const,
        parts: [
          {
            type: 'text' as const,
            text: blockCheck.reason || "I'm sorry, I can't provide details about prices, payments, or contracts. Please contact your admin.",
          },
        ],
      };
      return;
    }

    const restrictionLevel = getChatbotRestrictionLevel(user.role);
    let systemInstructions = '';

    if (restrictionLevel === 'basic-only') {
      systemInstructions = `IMPORTANT: You are assisting a Field Employee with LIMITED access.
- You CAN answer ONLY: Scope of work, general project info, document/photo summaries, how to clock in/out, how to add expenses/photos.
- You CANNOT answer: Anything about estimates, cost breakdowns, contract terms, revenue, payment info, budgets, pricing, or financial data.
- If asked about restricted topics, respond: "I'm sorry, I can't provide details about prices, contracts, or financials. Please contact your admin."
- Keep responses focused on field work and basic app usage.

`;
    } else if (restrictionLevel === 'no-financials') {
      systemInstructions = `IMPORTANT: You are assisting a Salesperson with RESTRICTED financial access.
- You CAN answer: General construction questions, CRM usage, how to create estimates, scope of work, schedule, chat, photos, industry best practices.
- You CANNOT answer: Pricing details, markup percentages, actual costs, contract terms, payment status, profit margins, cost reports, or financial analytics.
- If asked about restricted topics, respond: "I'm sorry, I can't provide details about prices, contracts, or financials. Please contact your admin."
- You can help CREATE estimates but cannot discuss internal costs or pricing strategy.

`;
    } else {
      systemInstructions = `IMPORTANT GLOBAL RESTRICTIONS (applies to everyone):
- You CANNOT answer: Contract legal terms, specific legal advice, or compliance questions.
- For non-restricted topics, provide full assistance.
- You have unrestricted access to app features and data for this role.

`;
    }
    
    const contextMessage = `${systemInstructions}Context: ${getContextForCurrentPage()}\n\nUser Role: ${user.role}\n\nUser question: ${userInput}`;
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
              setTimeout(() => {
                speakText(lastTextPart.text, true);
              }, 500);
            }
          }
        }
      }
    }
  }, [messages, status, voiceMode]);

  const handlePickFile = async () => {
    try {
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

      console.log('Document picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        console.log('Selected file:', file.name, file.mimeType, file.size);
        
        let mimeType = file.mimeType || 'application/octet-stream';
        
        if (!mimeType || mimeType === 'application/octet-stream') {
          const extension = file.name.toLowerCase().split('.').pop();
          if (extension === 'pdf') {
            mimeType = 'application/pdf';
          } else if (extension === 'doc') {
            mimeType = 'application/msword';
          } else if (extension === 'docx') {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (extension === 'xls') {
            mimeType = 'application/vnd.ms-excel';
          } else if (extension === 'xlsx') {
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else if (extension === 'png') {
            mimeType = 'image/png';
          } else if (extension === 'jpg' || extension === 'jpeg') {
            mimeType = 'image/jpeg';
          } else if (extension === 'gif') {
            mimeType = 'image/gif';
          } else if (extension === 'webp') {
            mimeType = 'image/webp';
          }
        }
        
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
          alert(`Unsupported file type: ${mimeType}\n\nSupported types:\n- Images (PNG, JPG, GIF, WebP)\n- PDF\n- Word (.doc, .docx)\n- Excel (.xls, .xlsx)`);
          return;
        }
        
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.name,
          mimeType: mimeType,
          size: file.size || 0,
          type: 'file',
        };
        setAttachedFiles([...attachedFiles, newFile]);
      } else {
        console.log('Document picker canceled or no assets');
      }
    } catch (error) {
      console.error('Error picking file:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        alert(`Error picking file: ${error.message}`);
      }
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const convertFileToBase64 = async (file: AttachedFile): Promise<string> => {
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            resolve(base64.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'base64' as any,
        });
        return base64;
      }
    } catch (error) {
      console.error('Error converting file to base64:', error);
      throw error;
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
    
    if (attachedFiles.length > 0) {
      try {
        console.log('Processing attached files:', attachedFiles.length);
        const filesForMessage: {type: 'file'; mimeType: string; uri: string}[] = [];
        
        for (const file of attachedFiles) {
          console.log('Processing file:', file.name, file.mimeType);
          
          if (file.mimeType.startsWith('image/')) {
            try {
              const base64 = await convertFileToBase64(file);
              console.log('Image converted to base64, length:', base64.length);
              filesForMessage.push({
                type: 'file',
                mimeType: file.mimeType,
                uri: `data:${file.mimeType};base64,${base64}`,
              });
            } catch (error) {
              console.error('Failed to convert image to base64:', error);
              throw new Error(`Failed to process image: ${file.name}`);
            }
          } else if (file.mimeType === 'application/pdf' || file.mimeType.includes('pdf')) {
            try {
              const base64 = await convertFileToBase64(file);
              console.log('PDF converted to base64, length:', base64.length);
              filesForMessage.push({
                type: 'file',
                mimeType: 'application/pdf',
                uri: `data:application/pdf;base64,${base64}`,
              });
            } catch (error) {
              console.error('Failed to convert PDF to base64:', error);
              throw new Error(`Failed to process PDF: ${file.name}`);
            }
          } else if (
            file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.mimeType === 'application/msword' ||
            file.mimeType.includes('word')
          ) {
            try {
              const base64 = await convertFileToBase64(file);
              console.log('Word document converted to base64, length:', base64.length);
              filesForMessage.push({
                type: 'file',
                mimeType: file.mimeType,
                uri: `data:${file.mimeType};base64,${base64}`,
              });
            } catch (error) {
              console.error('Failed to convert Word document to base64:', error);
              throw new Error(`Failed to process Word document: ${file.name}`);
            }
          } else if (
            file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimeType === 'application/vnd.ms-excel' ||
            file.mimeType.includes('excel') ||
            file.mimeType.includes('spreadsheet')
          ) {
            try {
              const base64 = await convertFileToBase64(file);
              console.log('Excel document converted to base64, length:', base64.length);
              filesForMessage.push({
                type: 'file',
                mimeType: file.mimeType,
                uri: `data:${file.mimeType};base64,${base64}`,
              });
            } catch (error) {
              console.error('Failed to convert Excel document to base64:', error);
              throw new Error(`Failed to process Excel document: ${file.name}`);
            }
          } else {
            console.warn('Unsupported file type:', file.mimeType, 'for file:', file.name);
            throw new Error(`Sorry, I can only analyze images, PDFs, Word documents (.doc, .docx), and Excel files (.xls, .xlsx). Please select a supported file type.`);
          }
        }
        
        const userMessage = input.trim() || 'Please analyze the attached file(s)';
        
        if (!user) {
          console.warn('[Chat] No user found, blocking request');
          return;
        }

        const blockCheck = shouldBlockChatbotQuery(user.role, userMessage);
        if (blockCheck.shouldBlock) {
          console.log('[Chat] Query blocked for role:', user.role);
          return;
        }

        const restrictionLevel = getChatbotRestrictionLevel(user.role);
        let systemInstructions = '';

        if (restrictionLevel === 'basic-only') {
          systemInstructions = `IMPORTANT: You are assisting a Field Employee with LIMITED access.
- You CAN answer ONLY: Scope of work, general project info, document/photo summaries, how to clock in/out, how to add expenses/photos.
- You CANNOT answer: Anything about estimates, cost breakdowns, contract terms, revenue, payment info, budgets, pricing, or financial data.
- If asked about restricted topics, respond: "I'm sorry, I can't provide details about prices, contracts, or financials. Please contact your admin."

`;
        } else if (restrictionLevel === 'no-financials') {
          systemInstructions = `IMPORTANT: You are assisting a Salesperson with RESTRICTED financial access.
- You CAN answer: General construction questions, CRM usage, how to create estimates, scope of work, schedule, chat, photos.
- You CANNOT answer: Pricing details, markup percentages, actual costs, contract terms, payment status, profit margins, cost reports.
- If asked about restricted topics, respond: "I'm sorry, I can't provide details about prices, contracts, or financials. Please contact your admin."

`;
        } else {
          systemInstructions = `IMPORTANT GLOBAL RESTRICTIONS:
- You CANNOT answer: Contract legal terms or specific legal advice.
- You have unrestricted access to app features and data for this role.

`;
        }
        
        const contextMessage = `${systemInstructions}Context: ${getContextForCurrentPage()}`;
        const fullMessage = `${contextMessage}\n\nUser question: ${userMessage}\n\nAttached ${filesForMessage.length} file(s) for analysis.`;
        
        console.log('Sending message with', filesForMessage.length, 'files');
        sendMessage({ text: fullMessage, files: filesForMessage as any });
        setInput('');
        setAttachedFiles([]);
      } catch (error) {
        console.error('Error sending message with files:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload document';
        alert(errorMessage);
        setAttachedFiles([]);
      }
    } else {
      handleSendWithContext(input);
      setInput('');
    }
  };

  if ((isOnChatScreen && !inline) || isOnAuthScreen) {
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
                I can help you with {pathname.includes('dashboard') ? 'projects, budgets, and creating estimates from plans/photos' : pathname.includes('crm') ? 'clients, leads, and call notes' : pathname.includes('schedule') ? 'tasks and schedule' : pathname.includes('expenses') ? 'expenses' : pathname.includes('estimate') ? 'estimates with accurate pricing' : 'any questions'}. I can analyze images, PDFs, Word documents (.doc, .docx), and Excel files (.xls, .xlsx) you attach! You can also use voice to talk to me.
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
                          if (toolName === 'generateFloorLayout' && part.output) {
                            try {
                              const outputData = JSON.parse(part.output as string);
                              if (outputData.success && outputData.imageData) {
                                return (
                                  <View key={i} style={styles.floorLayoutContainer}>
                                    <Text style={styles.toolSuccessText}>✓ Floor layout generated</Text>
                                    <Image 
                                      source={{ uri: `data:${outputData.mimeType};base64,${outputData.imageData}` }} 
                                      style={styles.floorLayoutImage}
                                      resizeMode="contain"
                                    />
                                    {outputData.notes && (
                                      <Text style={styles.floorLayoutNotes}>{outputData.notes}</Text>
                                    )}
                                  </View>
                                );
                              }
                            } catch (e) {
                              console.error('Failed to parse floor layout output:', e);
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
                const newVoiceMode = !voiceMode;
                setVoiceMode(newVoiceMode);
                if (!newVoiceMode && isSpeaking) {
                  stopSpeaking();
                }
              }}
              disabled={isLoading || isRecording}
            >
              <Volume2 size={20} color={voiceMode ? '#FFFFFF' : '#6B7280'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={handlePickFile}
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
                  placeholder={voiceMode ? "Voice mode active - tap mic to talk" : "Ask me anything or tap mic..."}
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
                    I can help you with {pathname.includes('dashboard') ? 'projects, budgets, and creating estimates from plans/photos' : pathname.includes('crm') ? 'clients, leads, and call notes' : pathname.includes('schedule') ? 'tasks and schedule' : pathname.includes('expenses') ? 'expenses' : pathname.includes('estimate') ? 'estimates with accurate pricing' : 'any questions'}. I can analyze images, PDFs, Word documents (.doc, .docx), and Excel files (.xls, .xlsx) you attach! You can also use voice to talk to me.
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
                              <Text key={i} style={styles.userMessageText}>
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
                                <Text style={styles.assistantMessageText}>
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
                    const newVoiceMode = !voiceMode;
                    setVoiceMode(newVoiceMode);
                    if (!newVoiceMode && isSpeaking) {
                      stopSpeaking();
                    }
                  }}
                  disabled={isLoading || isRecording}
                >
                  <Volume2 size={20} color={voiceMode ? '#FFFFFF' : '#6B7280'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={handlePickFile}
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
                      placeholder={voiceMode ? "Voice mode active - tap mic to talk" : "Ask me anything or tap mic..."}
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
  recordingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
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
    fontStyle: 'italic',
  },
});
