import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { Bot, X, Send, Paperclip, File as FileIcon, Mic, Volume2, Image as ImageIcon, Loader2, Phone, PhoneOff, Copy, Sparkles } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRorkAgent, createRorkTool } from '@rork-ai/toolkit-sdk';
import { Audio } from 'expo-av';
import { usePathname } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { trpc, trpcClient } from '@/lib/trpc';
import { z } from 'zod';
import { masterPriceList } from '@/mocks/priceList';
import { mockPhotos } from '@/mocks/data';

interface GlobalAIChatProps {
  currentPageContext?: string;
  inline?: boolean;
}

const extensionMimeTypeMap: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

type AttachedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  type: 'file';
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

export default function GlobalAIChatSimple({ currentPageContext, inline = false }: GlobalAIChatProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isConversationMode, setIsConversationMode] = useState<boolean>(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<{ url: string; prompt: string }[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const conversationModeInitialized = useRef<boolean>(false);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [soundInstance, setSoundInstance] = useState<Audio.Sound | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pathname = usePathname();
  const isOnChatScreen = pathname === '/chat';
  const isOnAuthScreen = pathname?.includes('/login') || pathname?.includes('/subscription') || pathname?.includes('/signup');
  const { user } = useApp();

  const { 
    projects, 
    expenses, 
    clients, 
    clockEntries, 
    payments, 
    changeOrders, 
    tasks,
    company,
    estimates
  } = useApp();

  const { messages, sendMessage } = useRorkAgent({
    tools: {
      getProjects: createRorkTool({
        description: 'Get information about all projects or a specific project. Shows budget, expenses, progress, status, and hours worked.',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Optional project ID to get specific project details'),
        }),
        async execute(input) {
          if (input.projectId) {
            const project = projects.find(p => p.id === input.projectId);
            return JSON.stringify(project || { error: 'Project not found' }, null, 2);
          }
          return JSON.stringify(projects, null, 2);
        },
      }),
      getProjectFinancials: createRorkTool({
        description: 'Get detailed financial information for a specific project including budget, expenses, payments, and change orders.',
        zodSchema: z.object({
          projectId: z.string().describe('The ID of the project'),
        }),
        execute: (input) => {
          const project = projects.find(p => p.id === input.projectId);
          if (!project) return JSON.stringify({ error: 'Project not found' });
          
          const projectExpenses = expenses.filter(e => e.projectId === input.projectId);
          const projectPayments = payments.filter(p => p.projectId === input.projectId);
          const projectChangeOrders = changeOrders.filter(co => co.projectId === input.projectId);
          const projectEstimates = estimates.filter(e => e.projectId === input.projectId);
          
          const totalExpenses = projectExpenses.reduce((sum, e) => sum + e.amount, 0);
          const totalPayments = projectPayments.reduce((sum, p) => sum + p.amount, 0);
          const approvedChangeOrders = projectChangeOrders
            .filter(co => co.status === 'approved')
            .reduce((sum, co) => sum + co.amount, 0);
          
          return JSON.stringify({
            project: {
              name: project.name,
              budget: project.budget,
              expenses: project.expenses,
              progress: project.progress,
              status: project.status,
            },
            expenses: {
              total: totalExpenses,
              count: projectExpenses.length,
              byCategory: projectExpenses.reduce((acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + e.amount;
                return acc;
              }, {} as Record<string, number>),
            },
            payments: {
              total: totalPayments,
              count: projectPayments.length,
              list: projectPayments,
            },
            changeOrders: {
              total: approvedChangeOrders,
              count: projectChangeOrders.length,
              list: projectChangeOrders,
            },
            estimates: projectEstimates,
            remaining: project.budget - project.expenses,
          }, null, 2);
        },
      }),
      getCompanyOverview: createRorkTool({
        description: 'Get overall company information including all projects summary, total financials, and company details.',
        zodSchema: z.object({}),
        execute: () => {
          const activeProjects = projects.filter(p => p.status === 'active');
          const completedProjects = projects.filter(p => p.status === 'completed');
          
          const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
          const totalExpenses = projects.reduce((sum, p) => sum + p.expenses, 0);
          const totalHours = projects.reduce((sum, p) => sum + p.hoursWorked, 0);
          
          const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
          const totalChangeOrders = changeOrders
            .filter(co => co.status === 'approved')
            .reduce((sum, co) => sum + co.amount, 0);
          
          return JSON.stringify({
            company: {
              name: company?.name,
              subscriptionStatus: company?.subscriptionStatus,
              subscriptionPlan: company?.subscriptionPlan,
            },
            projects: {
              total: projects.length,
              active: activeProjects.length,
              completed: completedProjects.length,
              archived: projects.filter(p => p.status === 'archived').length,
            },
            financials: {
              totalBudget,
              totalExpenses,
              totalPayments,
              totalChangeOrders,
              remaining: totalBudget - totalExpenses,
            },
            time: {
              totalHours,
              totalClockEntries: clockEntries.length,
            },
            clients: {
              total: clients.length,
              leads: clients.filter(c => c.status === 'Lead').length,
              active: clients.filter(c => c.status === 'Project').length,
            },
          }, null, 2);
        },
      }),
      getExpenses: createRorkTool({
        description: 'Get expenses information, optionally filtered by project.',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Optional project ID to filter expenses'),
        }),
        async execute(input) {
          try {
            const result = await trpcClient.expenses.getExpensesDetailed.query({
              projectId: input.projectId,
            });
            return JSON.stringify({
              total: result.total,
              count: result.count,
              byCategory: result.byCategory,
              recentExpenses: result.expenses.slice(0, 10),
            }, null, 2);
          } catch (error) {
            console.error('[getExpenses Tool] Error:', error);
            return JSON.stringify({ error: 'Failed to fetch expenses', count: 0, total: 0 }, null, 2);
          }
        },
      }),
      getTasks: createRorkTool({
        description: 'Get tasks information, optionally filtered by project.',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Optional project ID to filter tasks'),
        }),
        execute: (input) => {
          const filteredTasks = input.projectId 
            ? tasks.filter(t => t.projectId === input.projectId)
            : tasks;
          
          return JSON.stringify({
            total: filteredTasks.length,
            completed: filteredTasks.filter(t => t.completed).length,
            pending: filteredTasks.filter(t => !t.completed).length,
            tasks: filteredTasks,
          }, null, 2);
        },
      }),
      getClients: createRorkTool({
        description: 'Get information about clients/customers.',
        zodSchema: z.object({}),
        execute: () => {
          return JSON.stringify({
            total: clients.length,
            leads: clients.filter(c => c.status === 'Lead').length,
            active: clients.filter(c => c.status === 'Project').length,
            completed: clients.filter(c => c.status === 'Completed').length,
            clients: clients,
          }, null, 2);
        },
      }),
      analyzeDrawing: createRorkTool({
        description: 'Analyze construction drawings, blueprints, and plans. Can read scale, perform quantity takeoffs, identify materials, and generate estimates based on drawings. Use this when user uploads plans or asks for takeoff analysis.',
        zodSchema: z.object({
          drawingAnalysis: z.string().describe('Detailed analysis of the drawing including scale, dimensions, and observations'),
          scale: z.string().optional().describe('Drawing scale if detected (e.g., 1/4"=1\'-0", 1:100)'),
          takeoffItems: z.array(z.object({
            item: z.string().describe('Item name from price list'),
            priceListId: z.string().optional().describe('Matching price list ID if found'),
            category: z.string().describe('Category (e.g., Foundation, Framing, Electrical)'),
            quantity: z.number().describe('Measured quantity from drawing'),
            unit: z.string().describe('Unit of measurement (SF, LF, CY, EA)'),
            notes: z.string().optional().describe('Additional notes about the measurement'),
          })).describe('Takeoff items measured from the drawing'),
          recommendations: z.array(z.string()).optional().describe('Construction recommendations based on the drawing'),
        }),
        execute: (input) => {
          console.log('[Drawing Analysis] Processed takeoff with', input.takeoffItems.length, 'items');
          console.log('[Drawing Analysis] Scale detected:', input.scale || 'Not specified');
          
          const takeoffSummary = {
            scale: input.scale,
            totalItems: input.takeoffItems.length,
            byCategory: input.takeoffItems.reduce((acc, item) => {
              acc[item.category] = (acc[item.category] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            items: input.takeoffItems,
          };
          
          return JSON.stringify({
            message: 'Drawing analysis completed successfully',
            analysis: input.drawingAnalysis,
            scale: input.scale,
            takeoff: takeoffSummary,
            recommendations: input.recommendations,
          }, null, 2);
        },
      }),
      createEstimateFromDrawing: createRorkTool({
        description: 'Create a detailed cost estimate from drawing takeoff analysis using the price list. Use this after analyzing a drawing to generate costs.',
        zodSchema: z.object({
          projectName: z.string().describe('Project name for the estimate'),
          drawingReference: z.string().optional().describe('Drawing reference or sheet number'),
          items: z.array(z.object({
            itemName: z.string().describe('Item description'),
            priceListId: z.string().optional().describe('ID from price list if matched'),
            quantity: z.number().describe('Quantity from takeoff'),
            unit: z.string().describe('Unit of measurement'),
            unitPrice: z.number().optional().describe('Unit price if known'),
            notes: z.string().optional().describe('Notes about this item'),
          })).describe('Line items for the estimate'),
        }),
        execute: (input) => {
          const lineItems = input.items.map(item => {
            let priceItem;
            let unitPrice = item.unitPrice || 0;
            
            if (item.priceListId) {
              priceItem = masterPriceList.find(p => p.id === item.priceListId);
              if (priceItem) {
                unitPrice = priceItem.unitPrice;
              }
            }
            
            if (!priceItem && !item.unitPrice) {
              const searchResults = masterPriceList.filter(p => 
                p.name.toLowerCase().includes(item.itemName.toLowerCase()) ||
                p.description.toLowerCase().includes(item.itemName.toLowerCase())
              );
              
              if (searchResults.length > 0) {
                priceItem = searchResults[0];
                unitPrice = priceItem.unitPrice;
                console.log(`[Estimate] Auto-matched "${item.itemName}" to "${priceItem.name}"`);
              }
            }
            
            const lineTotal = unitPrice * item.quantity;
            
            return {
              itemName: item.itemName,
              priceListId: priceItem?.id || item.priceListId,
              matchedItem: priceItem?.name,
              category: priceItem?.category || 'Custom',
              quantity: item.quantity,
              unit: item.unit,
              unitPrice,
              lineTotal,
              notes: item.notes,
            };
          });
          
          const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
          const tax = 0;
          const total = subtotal + tax;
          
          const estimate = {
            projectName: input.projectName,
            drawingReference: input.drawingReference,
            date: new Date().toISOString().split('T')[0],
            lineItems,
            summary: {
              subtotal,
              tax,
              total,
              totalItems: lineItems.length,
            },
          };
          
          return JSON.stringify(estimate, null, 2);
        },
      }),
      getPriceList: createRorkTool({
        description: 'Get pricing information from the master price list database. Search by category, item name, or get all prices. Use this to create estimates and quote prices.',
        zodSchema: z.object({
          category: z.string().optional().describe('Optional category to filter prices (e.g., "Pre-Construction", "Kitchen", "Plumbing")'),
          searchTerm: z.string().optional().describe('Optional search term to find specific items by name'),
        }),
        execute: (input) => {
          let filteredPrices = masterPriceList;
          
          if (input.category) {
            filteredPrices = filteredPrices.filter(item => 
              item.category.toLowerCase().includes(input.category!.toLowerCase())
            );
          }
          
          if (input.searchTerm) {
            const term = input.searchTerm.toLowerCase();
            filteredPrices = filteredPrices.filter(item => 
              item.name.toLowerCase().includes(term) ||
              item.description.toLowerCase().includes(term) ||
              item.category.toLowerCase().includes(term)
            );
          }
          
          const result = {
            totalItems: filteredPrices.length,
            items: filteredPrices.map(item => ({
              id: item.id,
              category: item.category,
              name: item.name,
              description: item.description,
              unit: item.unit,
              unitPrice: item.unitPrice,
              laborCost: item.laborCost,
              materialCost: item.materialCost,
            })),
          };
          
          return JSON.stringify(result, null, 2);
        },
      }),
      calculateEstimate: createRorkTool({
        description: 'Calculate an estimate based on items from the price list and quantities. Returns a detailed breakdown with line items and totals.',
        zodSchema: z.object({
          items: z.array(z.object({
            priceListId: z.string().describe('ID of the item from the price list'),
            quantity: z.number().describe('Quantity of the item'),
            notes: z.string().optional().describe('Optional notes for this line item'),
          })).describe('Array of items to include in the estimate'),
          projectName: z.string().optional().describe('Optional project name for the estimate'),
        }),
        execute: (input) => {
          const lineItems = input.items.map(item => {
            const priceItem = masterPriceList.find(p => p.id === item.priceListId);
            if (!priceItem) {
              return {
                error: `Item ${item.priceListId} not found in price list`,
                priceListId: item.priceListId,
              };
            }
            
            const lineTotal = priceItem.unitPrice * item.quantity;
            return {
              priceListId: item.priceListId,
              category: priceItem.category,
              name: priceItem.name,
              description: priceItem.description,
              quantity: item.quantity,
              unit: priceItem.unit,
              unitPrice: priceItem.unitPrice,
              lineTotal,
              notes: item.notes,
            };
          });
          
          const validLineItems = lineItems.filter(item => !('error' in item));
          const subtotal = validLineItems.reduce((sum, item) => sum + (item as any).lineTotal, 0);
          const tax = subtotal * 0.0;
          const total = subtotal + tax;
          
          const estimate = {
            projectName: input.projectName || 'Untitled Project',
            date: new Date().toISOString().split('T')[0],
            lineItems,
            summary: {
              subtotal,
              tax,
              total,
              totalItems: validLineItems.length,
            },
          };
          
          return JSON.stringify(estimate, null, 2);
        },
      }),
      getPhotosUploaded: createRorkTool({
        description: 'Get photos uploaded to projects. Can filter by project, category, and date. Use this to answer questions about which photos were uploaded today, this week, or in a specific time period.',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Optional project ID to filter photos'),
          category: z.string().optional().describe('Optional category to filter photos (e.g., Foundation, Framing, Plumbing)'),
          date: z.string().optional().describe('Optional specific date to filter photos (YYYY-MM-DD format)'),
          startDate: z.string().optional().describe('Optional start date for date range filter (YYYY-MM-DD format)'),
          endDate: z.string().optional().describe('Optional end date for date range filter (YYYY-MM-DD format)'),
        }),
        async execute(input) {
          try {
            const result = await trpcClient.photos.getPhotos.query({
              projectId: input.projectId,
              category: input.category,
              date: input.date,
              startDate: input.startDate,
              endDate: input.endDate,
            });

            const byProject = result.photos.reduce((acc, p) => {
              const proj = projects.find(pr => pr.id === p.projectId);
              const projectName = proj?.name || 'Unknown Project';
              if (!acc[projectName]) {
                acc[projectName] = { count: 0, categories: {} };
              }
              acc[projectName].count++;
              acc[projectName].categories[p.category] = (acc[projectName].categories[p.category] || 0) + 1;
              return acc;
            }, {} as Record<string, { count: number; categories: Record<string, number> }>);

            const byCategory = result.photos.reduce((acc, p) => {
              acc[p.category] = (acc[p.category] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            return JSON.stringify({
              total: result.total,
              photos: result.photos.map(p => ({
                id: p.id,
                projectId: p.projectId,
                projectName: projects.find(pr => pr.id === p.projectId)?.name || 'Unknown',
                category: p.category,
                notes: p.notes,
                date: p.date,
              })),
              byProject,
              byCategory,
            }, null, 2);
          } catch (error) {
            console.error('[getPhotosUploaded Tool] Error:', error);
            return JSON.stringify({ error: 'Failed to fetch photos', total: 0, photos: [] }, null, 2);
          }
        },
      }),
      getExpensesDetailed: createRorkTool({
        description: 'Get detailed expenses information with filtering and analysis. Can filter by project, category, date, and employee. Use this to answer questions about expenses today, this week, by category, or by project.',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Optional project ID to filter expenses'),
          type: z.string().optional().describe('Optional expense type/category to filter (e.g., Material, Labor, Equipment)'),
          date: z.string().optional().describe('Optional specific date to filter expenses (YYYY-MM-DD format)'),
          startDate: z.string().optional().describe('Optional start date for date range filter (YYYY-MM-DD format)'),
          endDate: z.string().optional().describe('Optional end date for date range filter (YYYY-MM-DD format)'),
        }),
        async execute(input) {
          try {
            const result = await trpcClient.expenses.getExpensesDetailed.query({
              projectId: input.projectId,
              type: input.type,
              date: input.date,
              startDate: input.startDate,
              endDate: input.endDate,
            });

            const byProject = result.expenses.reduce((acc, e) => {
              const proj = projects.find(p => p.id === e.projectId);
              const projectName = proj?.name || 'Unknown Project';
              if (!acc[projectName]) {
                acc[projectName] = { total: 0, count: 0, byCategory: {} };
              }
              acc[projectName].total += e.amount;
              acc[projectName].count++;
              acc[projectName].byCategory[e.type] = (acc[projectName].byCategory[e.type] || 0) + e.amount;
              return acc;
            }, {} as Record<string, { total: number; count: number; byCategory: Record<string, number> }>);

            return JSON.stringify({
              total: result.total,
              count: result.count,
              byCategory: result.byCategory,
              byProject,
              recentExpenses: result.expenses.slice(0, 20).map(e => ({
                id: e.id,
                projectId: e.projectId,
                projectName: projects.find(p => p.id === e.projectId)?.name || 'Unknown',
                type: e.type,
                subcategory: e.subcategory,
                amount: e.amount,
                store: e.store,
                date: e.date,
              })),
            }, null, 2);
          } catch (error) {
            console.error('[getExpensesDetailed Tool] Error:', error);
            return JSON.stringify({ error: 'Failed to fetch expenses', total: 0, count: 0 }, null, 2);
          }
        },
      }),
      getTimeTracking: createRorkTool({
        description: 'Get clock in/out entries and time tracking information. Can filter by project, employee, and date. Use this to answer questions about hours worked, who worked today, or time spent on projects.',
        zodSchema: z.object({
          projectId: z.string().optional().describe('Optional project ID to filter clock entries'),
          employeeId: z.string().optional().describe('Optional employee ID to filter clock entries'),
          date: z.string().optional().describe('Optional specific date to filter entries (YYYY-MM-DD format)'),
          startDate: z.string().optional().describe('Optional start date for date range filter (YYYY-MM-DD format)'),
          endDate: z.string().optional().describe('Optional end date for date range filter (YYYY-MM-DD format)'),
        }),
        async execute(input) {
          try {
            const result = await trpcClient.clock.getClockEntries.query({
              projectId: input.projectId,
              employeeId: input.employeeId,
              date: input.date,
              startDate: input.startDate,
              endDate: input.endDate,
            });

            const byProject = result.entries.reduce((acc, e) => {
              const proj = projects.find(p => p.id === e.projectId);
              const projectName = proj?.name || 'Unknown Project';
              if (!acc[projectName]) {
                acc[projectName] = { count: 0, hours: 0 };
              }
              acc[projectName].count++;
              if (e.clockOut) {
                const hoursWorked = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);
                acc[projectName].hours += hoursWorked;
              }
              return acc;
            }, {} as Record<string, { count: number; hours: number }>);

            return JSON.stringify({
              totalHours: result.totalHours.toFixed(2),
              count: result.count,
              byEmployee: result.byEmployee,
              byProject,
              recentEntries: result.entries.slice(0, 20).map(e => ({
                id: e.id,
                employeeId: e.employeeId,
                projectId: e.projectId,
                projectName: projects.find(p => p.id === e.projectId)?.name || 'Unknown',
                clockIn: e.clockIn,
                clockOut: e.clockOut,
                category: e.category,
                workPerformed: e.workPerformed,
              })),
            }, null, 2);
          } catch (error) {
            console.error('[getTimeTracking Tool] Error:', error);
            return JSON.stringify({ error: 'Failed to fetch clock entries', totalHours: '0.00', count: 0 }, null, 2);
          }
        },
      }),
    },
  });

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      if (isConversationMode && conversationModeInitialized.current && !isSpeaking && !isRecording) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          const textPart = lastMessage.parts.find(p => p.type === 'text');
          if (textPart && textPart.type === 'text') {
            console.log('[Conversation] Auto-speaking AI response');
            setTimeout(() => {
              speakText(textPart.text, true);
            }, 300);
          }
        }
      }
    }
  }, [messages, isConversationMode, isSpeaking, isRecording]);

  const startRecording = async () => {
    try {
      console.log('[Voice] Starting recording...');
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
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

        if (isConversationMode) {
          startSilenceDetection(stream);
        }
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
      alert('Error starting recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async (sendImmediately = false) => {
    try {
      setIsRecording(false);
      setIsTranscribing(true);

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      if (Platform.OS === 'web') {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob, sendImmediately);
          
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
                const base64 = await FileSystem.readAsStringAsync(uri, {
                  encoding: 'base64' as any,
                });
                await transcribeAudioBase64(base64, sendImmediately);
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
      alert('Error processing recording.');
    }
  };

  const transcribeAudioBase64 = async (base64: string, sendImmediately = false) => {
    try {
      console.log('[STT] Transcribing audio via OpenAI Whisper...');
      
      const result = await trpcClient.openai.speechToText.mutate({
        audioBase64: base64,
      });

      if (!result.success || !result.text) {
        throw new Error(result.error || 'Transcription failed');
      }

      const transcribedText = result.text;
      
      console.log('[STT] Transcription successful:', transcribedText);
      setIsTranscribing(false);
      
      if (transcribedText && transcribedText.trim()) {
        if (sendImmediately && isConversationMode) {
          console.log('[Conversation] Auto-sending message:', transcribedText);
          await sendMessage(transcribedText);
        } else {
          setInput(transcribedText);
        }
      }
    } catch (error) {
      console.error('[STT] Transcription error:', error);
      setIsTranscribing(false);
      if (isConversationMode) {
        startRecording();
      }
    }
  };

  const transcribeAudio = async (audio: Blob, sendImmediately = false) => {
    try {
      console.log('[STT] Starting transcription...');
      
      const arrayBuffer = await audio.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      
      const result = await trpcClient.openai.speechToText.mutate({
        audioBase64: base64,
      });

      if (!result.success || !result.text) {
        throw new Error(result.error || 'Transcription failed');
      }

      const transcribedText = result.text;
      
      console.log('[STT] Transcription successful:', transcribedText);
      setIsTranscribing(false);
      
      if (transcribedText && transcribedText.trim()) {
        if (sendImmediately && isConversationMode) {
          console.log('[Conversation] Auto-sending message:', transcribedText);
          await sendMessage(transcribedText);
        } else {
          setInput(transcribedText);
        }
      }
    } catch (error) {
      console.error('[STT] Transcription error:', error);
      setIsTranscribing(false);
      if (isConversationMode) {
        startRecording();
      }
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

  const speakText = useCallback(async (text: string, autoStartRecording = false) => {
    try {
      if (isSpeaking) {
        await stopSpeaking();
        return;
      }

      console.log('[TTS] Generating speech:', text.substring(0, 50));
      setIsSpeaking(true);
      
      const result = await trpcClient.openai.textToSpeech.mutate({
        text: text,
        voice: 'nova',
        model: 'tts-1',
      });

      if (!result.success || !result.audioBase64) {
        throw new Error(result.error || 'TTS request failed');
      }

      const audioBase64 = result.audioBase64;
      
      console.log('[TTS] Audio generated, playing...');
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${audioBase64}` },
        { shouldPlay: true }
      );

      setSoundInstance(sound);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('[TTS] Finished speaking');
          setIsSpeaking(false);
          sound.unloadAsync().catch(console.error);
          setSoundInstance(null);
          
          if (autoStartRecording && isConversationMode && conversationModeInitialized.current) {
            console.log('[Conversation] Starting recording after speech');
            setTimeout(() => {
              if (isConversationMode && conversationModeInitialized.current) {
                startRecording();
              }
            }, 500);
          }
        }
      });
    } catch (error) {
      console.error('[TTS] Error:', error);
      setIsSpeaking(false);
      if (autoStartRecording && isConversationMode && conversationModeInitialized.current) {
        console.log('[Conversation] Retrying recording after TTS error');
        setTimeout(() => {
          if (isConversationMode && conversationModeInitialized.current) {
            startRecording();
          }
        }, 800);
      }
    }
  }, [isSpeaking, stopSpeaking, isConversationMode]);

  const startSilenceDetection = (stream: MediaStream) => {
    if (Platform.OS !== 'web') return;

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 512;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let silenceStart = Date.now();
      let hasSpoken = false;
      const SILENCE_THRESHOLD = 30;
      const SILENCE_DURATION = 1500;
      const SPEECH_THRESHOLD = 40;

      const checkAudioLevel = () => {
        if (!isConversationMode || !isRecording) {
          console.log('[Silence Detection] Stopped: conversation mode or recording inactive');
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;

        if (average > SPEECH_THRESHOLD) {
          hasSpoken = true;
          silenceStart = Date.now();
        } else if (hasSpoken && average < SILENCE_THRESHOLD) {
          if (Date.now() - silenceStart > SILENCE_DURATION) {
            console.log('[Silence Detection] Detected silence after speech, stopping recording');
            stopRecording(true);
            return;
          }
        }

        silenceTimerRef.current = setTimeout(checkAudioLevel, 100) as any;
      };

      checkAudioLevel();
    } catch (error) {
      console.error('[Silence Detection] Error:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
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
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const mimeType = getSanitizedMimeType(file.mimeType, file.name);
        
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.name,
          mimeType,
          size: file.size || 0,
          type: 'file',
        };
        console.log('[Attachment] File successfully attached:', newFile.name);
        setAttachedFiles([...attachedFiles, newFile]);
      }
    } catch (error) {
      console.error('[Attachment] Error picking file:', error);
      alert('Error selecting file.');
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
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[Attachment] Photo library permission status:', permissionResult.status);
      
      if (permissionResult.status !== 'granted') {
        console.log('[Attachment] Permission denied');
        alert('Photo library permission is required to attach images. Please enable it in your device settings.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: Platform.OS !== 'web',
      });

      console.log('[Attachment] Image picker result:', result.canceled, result.assets?.length);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map((asset) => {
          const newFile: AttachedFile = {
            uri: asset.uri,
            name: asset.fileName || `image_${Date.now()}.jpg`,
            mimeType: getSanitizedMimeType(asset.mimeType, asset.fileName || `image_${Date.now()}.jpg`),
            size: asset.fileSize || 0,
            type: 'file',
          };
          console.log('[Attachment] Image successfully attached:', newFile.name, 'URI:', asset.uri.substring(0, 50));
          return newFile;
        });
        setAttachedFiles(prev => [...prev, ...newFiles]);
        console.log('[Attachment] Total attached files:', attachedFiles.length + newFiles.length);
      } else {
        console.log('[Attachment] Image picker was canceled');
      }
    } catch (error) {
      console.error('[Attachment] Error picking image:', error);
      alert('Error selecting image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      console.log('[Attachment] Requesting camera permission...');
      setShowAttachMenu(false);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('[Attachment] Camera permission status:', status);
      
      if (status !== 'granted') {
        console.log('[Attachment] Camera permission denied');
        alert('Camera permission is required to take photos. Please enable it in your device settings.');
        return;
      }
      
      console.log('[Attachment] Opening camera...');

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      console.log('[Attachment] Camera result:', result.canceled, result.assets?.length);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.fileName || `photo_${Date.now()}.jpg`,
          mimeType: getSanitizedMimeType(file.mimeType, file.fileName || `photo_${Date.now()}.jpg`),
          size: file.fileSize || 0,
          type: 'file',
        };
        console.log('[Attachment] Photo successfully captured:', newFile.name, 'URI:', file.uri.substring(0, 50));
        setAttachedFiles(prev => [...prev, newFile]);
        console.log('[Attachment] Total attached files:', attachedFiles.length + 1);
      } else {
        console.log('[Attachment] Camera was canceled');
      }
    } catch (error) {
      console.error('[Attachment] Error taking photo:', error);
      alert('Error taking photo. Please try again.');
    }
  };

  const convertFileToDataUri = async (file: AttachedFile): Promise<string> => {
    try {
      console.log('[File Conversion] Starting conversion for:', file.name);
      
      if (Platform.OS === 'web') {
        if (file.uri.startsWith('data:')) {
          return file.uri;
        }
        
        const response = await fetch(file.uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              const result = reader.result as string;
              if (!result) {
                reject(new Error('FileReader returned empty result'));
                return;
              }
              resolve(result);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => {
            reject(new Error('FileReader failed to read file'));
          };
          reader.readAsDataURL(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'base64' as any,
        });
        if (!base64 || base64.length === 0) {
          throw new Error('Failed to read file or file is empty');
        }
        return `data:${file.mimeType};base64,${base64}`;
      }
    } catch (error) {
      console.error('[File Conversion] Error:', error);
      throw new Error(`Could not process file ${file.name}`);
    }
  };

  const generateImage = async (prompt: string) => {
    try {
      console.log('[Image Generation] Starting generation with prompt:', prompt);
      setIsGeneratingImage(true);
      
      const response = await fetch('https://toolkit.rork.com/images/generate/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          size: '1024x1024',
        }),
      });

      if (!response.ok) {
        throw new Error('Image generation failed');
      }

      const data = await response.json();
      const imageData = `data:${data.image.mimeType};base64,${data.image.base64Data}`;
      
      console.log('[Image Generation] Image generated successfully');
      setGeneratedImages(prev => [...prev, { url: imageData, prompt }]);
      
      await sendMessage(`Generated image for: "${prompt}"`);
      
      setIsGeneratingImage(false);
    } catch (error) {
      console.error('[Image Generation] Error:', error);
      setIsGeneratingImage(false);
      alert('Error generating image. Please try again.');
    }
  };

  const handleSend = async (speakResponse = false) => {
    if (!input.trim() && attachedFiles.length === 0) return;
    
    const userMessage = input.trim() || 'Por favor analiza las imágenes adjuntas';
    const hasImages = attachedFiles.some(f => f.mimeType.startsWith('image/'));
    
    const isImageGenerationRequest = userMessage.toLowerCase().includes('genera') && 
      (userMessage.toLowerCase().includes('imagen') || userMessage.toLowerCase().includes('image'));
    
    if (isImageGenerationRequest && !hasImages) {
      const prompt = userMessage.replace(/genera(r)?\s+(una?\s+)?imagen\s+(de|con)?\s*/i, '').trim();
      if (prompt) {
        setInput('');
        await generateImage(prompt);
        return;
      }
    }
    
    setInput('');

    try {
      if (hasImages) {
        console.log('[Send] Processing with images');
        const filesForAI: { type: 'file'; mimeType: string; uri: string; }[] = [];
        
        for (const file of attachedFiles.filter(f => f.mimeType.startsWith('image/'))) {
          const dataUri = await convertFileToDataUri(file);
          filesForAI.push({
            type: 'file',
            mimeType: file.mimeType,
            uri: dataUri,
          });
        }
        
        setAttachedFiles([]);
        
        await sendMessage({
          text: userMessage,
          files: filesForAI as any,
        });
      } else {
        console.log('[Send] Sending text message');
        setAttachedFiles([]);
        await sendMessage(userMessage);
      }
    } catch (error) {
      console.error('[Send] Error:', error);
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
                I can analyze images, do blueprint takeoffs, generate images, and answer your questions. Try me!
              </Text>
            </View>
          )}

          {messages.map((message) => (
            <View key={message.id} style={styles.messageWrapper}>
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <View key={`${message.id}-${i}`} style={message.role === 'user' ? styles.userMessageContainer : styles.assistantMessageContainer}>
                      <View style={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                        <Text style={message.role === 'user' ? styles.userMessageText : styles.assistantMessageText} selectable>
                          {part.text}
                        </Text>
                        {message.role === 'assistant' && (
                          <View style={styles.messageActions}>
                            <TouchableOpacity
                              style={styles.speakButton}
                              onPress={() => speakText(part.text)}
                            >
                              <Volume2 size={14} color={isSpeaking ? '#DC2626' : '#6B7280'} />
                              <Text style={styles.speakButtonText}>
                                {isSpeaking ? 'Stop' : 'Speak'}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.copyButton}
                              onPress={async () => {
                                await Clipboard.setStringAsync(part.text);
                                setCopiedMessageId(message.id);
                                setTimeout(() => setCopiedMessageId(null), 2000);
                              }}
                            >
                              <Copy size={14} color="#6B7280" />
                              <Text style={styles.copyButtonText}>
                                {copiedMessageId === message.id ? 'Copied' : 'Copy'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                }
                if (part.type === 'tool') {
                  if (part.state === 'input-streaming' || part.state === 'input-available') {
                    return (
                      <View key={`${message.id}-${i}`} style={styles.assistantMessageContainer}>
                        <View style={[styles.assistantMessage, styles.toolMessage]}>
                          <Loader2 size={16} color="#8B5CF6" />
                          <Text style={styles.toolText}>Analizando {part.toolName}...</Text>
                        </View>
                      </View>
                    );
                  }
                  if (part.state === 'output-available') {
                    return (
                      <View key={`${message.id}-${i}`} style={styles.assistantMessageContainer}>
                        <View style={[styles.assistantMessage, styles.toolMessage]}>
                          <Text style={styles.toolText}>✓ {part.toolName} completado</Text>
                        </View>
                      </View>
                    );
                  }
                }
                return null;
              })}
            </View>
          ))}
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
              style={styles.attachButton}
              onPress={() => setShowAttachMenu(true)}
              disabled={isRecording || isGeneratingImage}
            >
              <Paperclip size={22} color="#6B7280" />
            </TouchableOpacity>
            {isRecording ? (
              <TouchableOpacity
                style={styles.recordingButton}
                onPress={() => stopRecording(false)}
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
                  placeholder="Ask me anything..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                  editable={!isTranscribing}
                />
                <TouchableOpacity
                  style={styles.micButton}
                  onPress={startRecording}
                  disabled={isTranscribing}
                >
                  <Mic size={20} color="#6B7280" />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[styles.sendButton, (isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0)) && styles.sendButtonDisabled]}
              onPress={() => handleSend()}
              disabled={isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0)}
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
        >
          <View style={[styles.modalContent, isSmallScreen && styles.modalContentMobile]}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.aiIcon}>
                  <Bot size={22} color="#2563EB" strokeWidth={2.5} />
                </View>
                <Text style={styles.headerTitle}>AI Assistant</Text>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={[styles.conversationButton, isConversationMode && styles.conversationButtonActive]}
                  onPress={async () => {
                    if (isConversationMode) {
                      console.log('[Conversation] Ending conversation mode');
                      conversationModeInitialized.current = false;
                      setIsConversationMode(false);
                      
                      if (isRecording) {
                        await stopRecording(false);
                      }
                      if (isSpeaking) {
                        await stopSpeaking();
                      }
                      if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                      }
                      if (streamRef.current) {
                        streamRef.current.getTracks().forEach(track => track.stop());
                        streamRef.current = null;
                      }
                      if (audioContextRef.current) {
                        audioContextRef.current.close().catch(console.error);
                        audioContextRef.current = null;
                      }
                    } else {
                      console.log('[Conversation] Starting conversation mode');
                      setIsConversationMode(true);
                      setTimeout(() => {
                        conversationModeInitialized.current = true;
                        startRecording();
                      }, 800);
                    }
                  }}
                >
                  {isConversationMode ? (
                    <PhoneOff size={20} color="#FFFFFF" />
                  ) : (
                    <Phone size={20} color="#10A37F" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setIsOpen(false);
                    if (isConversationMode) {
                      setIsConversationMode(false);
                      if (isRecording) stopRecording(false);
                      if (isSpeaking) stopSpeaking();
                    }
                  }}
                >
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
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
                    I can analyze construction images, do blueprint takeoffs, and answer your questions. Try me!
                  </Text>
                </View>
              )}

              {isGeneratingImage && (
                <View style={styles.assistantMessageContainer}>
                  <View style={[styles.assistantMessage, styles.toolMessage]}>
                    <Loader2 size={16} color="#8B5CF6" />
                    <Text style={styles.toolText}>Generando imagen...</Text>
                  </View>
                </View>
              )}

              {generatedImages.map((img, idx) => (
                <View key={`img-${idx}`} style={styles.assistantMessageContainer}>
                  <View style={styles.assistantMessage}>
                    <Text style={styles.assistantMessageText}>Imagen generada:</Text>
                    <Image source={{ uri: img.url }} style={styles.generatedImage} />
                    <Text style={styles.imagePrompt}>{img.prompt}</Text>
                  </View>
                </View>
              ))}

              {messages.map((message) => (
                <View key={message.id} style={styles.messageWrapper}>
                  {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return (
                        <View key={`${message.id}-${i}`} style={message.role === 'user' ? styles.userMessageContainer : styles.assistantMessageContainer}>
                          <View style={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                            <Text style={message.role === 'user' ? styles.userMessageText : styles.assistantMessageText} selectable>
                              {part.text}
                            </Text>
                            {message.role === 'assistant' && (
                              <View style={styles.messageActions}>
                                <TouchableOpacity
                                  style={styles.speakButton}
                                  onPress={() => speakText(part.text)}
                                >
                                  <Volume2 size={14} color={isSpeaking ? '#DC2626' : '#6B7280'} />
                                  <Text style={styles.speakButtonText}>
                                    {isSpeaking ? 'Stop' : 'Speak'}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.copyButton}
                                  onPress={async () => {
                                    await Clipboard.setStringAsync(part.text);
                                    setCopiedMessageId(message.id);
                                    setTimeout(() => setCopiedMessageId(null), 2000);
                                  }}
                                >
                                  <Copy size={14} color="#6B7280" />
                                  <Text style={styles.copyButtonText}>
                                    {copiedMessageId === message.id ? 'Copied' : 'Copy'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    }
                    if (part.type === 'tool') {
                      if (part.state === 'input-streaming' || part.state === 'input-available') {
                        return (
                          <View key={`${message.id}-${i}`} style={styles.assistantMessageContainer}>
                            <View style={[styles.assistantMessage, styles.toolMessage]}>
                              <Loader2 size={16} color="#8B5CF6" />
                              <Text style={styles.toolText}>Analizando {part.toolName}...</Text>
                            </View>
                          </View>
                        );
                      }
                      if (part.state === 'output-available') {
                        return (
                          <View key={`${message.id}-${i}`} style={styles.assistantMessageContainer}>
                            <View style={[styles.assistantMessage, styles.toolMessage]}>
                              <Text style={styles.toolText}>✓ {part.toolName} completado</Text>
                            </View>
                          </View>
                        );
                      }
                    }
                    return null;
                  })}
                </View>
              ))}
            </ScrollView>

            <View style={styles.inputWrapper}>
              {isConversationMode && (
                <View style={styles.conversationBanner}>
                  <Phone size={16} color="#10A37F" />
                  <Text style={styles.conversationText}>Conversation Mode Active</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsConversationMode(false);
                      if (isRecording) stopRecording(false);
                      if (isSpeaking) stopSpeaking();
                    }}
                  >
                    <Text style={styles.conversationEndText}>End</Text>
                  </TouchableOpacity>
                </View>
              )}
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
                  style={styles.attachButton}
                  onPress={() => setShowAttachMenu(true)}
                  disabled={isRecording}
                >
                  <Paperclip size={22} color="#6B7280" />
                </TouchableOpacity>
                {isRecording ? (
                  <TouchableOpacity
                    style={styles.recordingButton}
                    onPress={() => stopRecording(isConversationMode)}
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
                      placeholder="Ask me anything..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      maxLength={500}
                      editable={!isTranscribing}
                    />
                    <TouchableOpacity
                      style={styles.micButton}
                      onPress={startRecording}
                      disabled={isTranscribing}
                    >
                      <Mic size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.sendButton, (isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0)) && styles.sendButtonDisabled]}
                  onPress={() => handleSend()}
                  disabled={isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0)}
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
    backgroundColor: '#10A37F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 998,
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
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conversationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationButtonActive: {
    backgroundColor: '#10A37F',
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
    backgroundColor: '#10A37F',
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
    marginBottom: 8,
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
    backgroundColor: '#10A37F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  conversationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#D1FAE5',
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
  },
  conversationText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#065F46',
  },
  conversationEndText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#DC2626',
    marginLeft: 12,
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
  messageActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  speakButtonText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  toolMessage: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  toolText: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '500' as const,
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
  generatedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  imagePrompt: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic' as const,
  },
});
