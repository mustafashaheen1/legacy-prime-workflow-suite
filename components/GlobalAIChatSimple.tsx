import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { Bot, X, Send, Paperclip, File as FileIcon, Mic, Volume2, Image as ImageIcon, Loader2, Phone, PhoneOff, Copy, Sparkles } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useState, useRef, useEffect, useCallback } from 'react';
// Removed Rork AI dependency - using OpenAI directly
import { Audio } from 'expo-av';
import { usePathname, useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
// Removed tRPC dependency - using OpenAI API directly
import { masterPriceList } from '@/mocks/priceList';
import { sendEstimate } from '@/utils/sendEstimate';
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

// Pending action type from AI assistant
interface PendingAction {
  type: string;
  data: any;
  successMessage?: string; // Message to show after action completes successfully
}

// Helper function to generate default estimate items based on project type
const getDefaultEstimateItems = (projectType: string, budget: number, priceList: any[]) => {
  const projectTypeLower = projectType.toLowerCase();
  const timestamp = Date.now();

  // Map project types to relevant categories in the price list
  const categoryMap: { [key: string]: string[] } = {
    'bathroom': ['Bathroom', 'Plumbing', 'Tile'],
    'kitchen': ['Kitchen', 'Appliances', 'Countertops', 'Cabinets'],
    'painting': ['Paint', 'Drywall'],
    'flooring': ['Flooring', 'Tile'],
    'roofing': ['Roofing'],
    'remodel': ['Pre-Construction', 'Demolition', 'Drywall', 'Paint'],
    'renovation': ['Pre-Construction', 'Demolition', 'Drywall', 'Paint'],
    'pool': ['Pre-Construction', 'Concrete', 'Excavation'],
  };

  // Find matching categories based on project type
  let categories: string[] = [];
  for (const [key, cats] of Object.entries(categoryMap)) {
    if (projectTypeLower.includes(key)) {
      categories = [...categories, ...cats];
    }
  }

  // Default to general construction if no specific match
  if (categories.length === 0) {
    categories = ['Pre-Construction', 'General'];
  }

  // Remove duplicates
  categories = [...new Set(categories)];

  // Get items from matching categories
  const matchingItems = priceList.filter((item: any) =>
    categories.some(cat => item.category?.toLowerCase().includes(cat.toLowerCase()))
  );

  // Select items that fit within budget
  const items: any[] = [];
  let remainingBudget = budget * 0.85; // Leave 15% buffer for adjustments

  for (const item of matchingItems) {
    if (remainingBudget <= 0 || items.length >= 10) break;

    const quantity = 1;
    const total = item.unitPrice * quantity;

    if (total <= remainingBudget && total > 0) {
      items.push({
        id: `item-${timestamp}-${items.length}`,
        priceListItemId: item.id,
        quantity,
        unitPrice: item.unitPrice,
        total,
        notes: '',
      });
      remainingBudget -= total;
    }
  }

  // Return items found (may be empty if no matching items in price list)
  // The AI assistant will handle the case when no items are found by prompting user
  return items;
};

// Custom hook to replace Rork AI with direct OpenAI - now with app data awareness and persistent chat history
function useOpenAIChat(appData: {
  projects: any[];
  clients: any[];
  expenses: any[];
  estimates: any[];
  payments: any[];
  clockEntries: any[];
  company: any;
  // Additional data for complete business intelligence
  priceList: any[];
  dailyLogs: any[];
  tasks: any[];
  photos: any[];
  changeOrders: any[];
  subcontractors: any[];
  callLogs: any[];
  users: any[];
  proposals: any[];
  updateClient?: (clientId: string, updates: any) => Promise<void>;
  userId?: string; // User ID for persistent chat history
  currentPageContext?: string | null; // Current page context for "this project" etc.
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const historyLoadedRef = useRef(false);

  const clearPendingAction = () => setPendingAction(null);

  // Load chat history from database on mount
  useEffect(() => {
    if (appData.userId && !historyLoadedRef.current) {
      loadChatHistory();
    } else if (!appData.userId) {
      setIsLoadingHistory(false);
    }
  }, [appData.userId]);

  const loadChatHistory = async () => {
    if (!appData.userId || historyLoadedRef.current) return;

    try {
      setIsLoadingHistory(true);
      console.log('[AI Chat] Loading chat history for user:', appData.userId);

      const response = await fetch(`/api/get-chat-history?userId=${appData.userId}&limit=200`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          setMessages(data.messages);
          console.log('[AI Chat] Loaded', data.messages.length, 'messages from history');
        }
      }
      historyLoadedRef.current = true;
    } catch (error) {
      console.error('[AI Chat] Error loading chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Save message to database
  const saveMessageToDb = async (role: 'user' | 'assistant', content: string, files: any[] = []) => {
    if (!appData.userId) return;

    try {
      // Don't save large base64 image data to database - it can exceed column size limits
      // Only save file metadata (without the actual data URI) for display purposes
      const filesToSave = files.map(f => ({
        mimeType: f.mimeType,
        // Keep URIs that are URLs (S3 links for PDFs and images)
        uri: f.uri?.startsWith('http') ? f.uri : undefined,
        hasImage: f.uri?.startsWith('data:image') || f.mimeType?.startsWith('image/'),
        // Include file metadata for PDFs
        name: f.name,
        size: f.size,
      })).filter(f => f.uri || f.hasImage);

      await fetch('/api/save-chat-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: appData.userId,
          role,
          content,
          files: filesToSave,
        }),
      });
    } catch (error) {
      console.error('[AI Chat] Error saving message to DB:', error);
    }
  };

  const sendMessage = async (userMessage: string | { text: string; files: any[] }) => {
    const messageText = typeof userMessage === 'string' ? userMessage : userMessage.text;
    const files = typeof userMessage === 'object' && 'files' in userMessage ? userMessage.files : [];

    // Add user message
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: messageText,
      files,
      parts: [{ type: 'text', text: messageText }],
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Save user message to database
    saveMessageToDb('user', messageText, files);

    try {
      // Prepare messages for API - send last 50 messages for context (to avoid token limits)
      const allMessages = [...messages, userMsg];
      const recentMessages = allMessages.slice(-50);
      const apiMessages = recentMessages.map(msg => ({
        role: msg.role,
        text: msg.text,
        files: msg.files,
      }));

      // Call AI Assistant API with all business data
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          pageContext: appData.currentPageContext || null, // Current page context for "this project" etc.
          appData: {
            projects: appData.projects,
            clients: appData.clients,
            expenses: appData.expenses,
            estimates: appData.estimates,
            payments: appData.payments,
            clockEntries: appData.clockEntries,
            company: appData.company,
            // Additional data for complete business intelligence
            priceList: appData.priceList,
            dailyLogs: appData.dailyLogs,
            tasks: appData.tasks,
            photos: appData.photos,
            changeOrders: appData.changeOrders,
            subcontractors: appData.subcontractors,
            callLogs: appData.callLogs,
            users: appData.users,
            proposals: appData.proposals,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();

      // Handle pending actions from AI
      // If there's an action required, DON'T show the AI's success message yet
      // We'll show an appropriate message after the action completes or fails
      if (data.actionRequired && data.actionData) {
        console.log('[AI Chat] Action required:', data.actionRequired, data.actionData);
        // Store the intended success message for after action completes
        setPendingAction({
          type: data.actionRequired,
          data: data.actionData,
          successMessage: data.content, // Store the message to show after success
        });
        // Show a "working on it" message while action is in progress
        const workingMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: 'Working on it...',
          parts: [{ type: 'text', text: 'Working on it...' }],
        };
        setMessages(prev => [...prev, workingMsg]);
      } else {
        // No action required, just show the message normally
        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: data.content,
          parts: [{ type: 'text', text: data.content }],
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Save assistant message to database
        saveMessageToDb('assistant', data.content);
      }
    } catch (error) {
      console.error('[AI Chat] Error:', error);
      // Add error message
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Sorry, I encountered an error. Please try again.',
        parts: [{ type: 'text', text: 'Sorry, I encountered an error. Please try again.' }],
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to add a message from outside the hook (e.g., for estimate links)
  // Also persists to database if it has special metadata like estimateLink
  const addMessage = async (message: any) => {
    setMessages(prev => [...prev, message]);

    // Save to database if we have userId and message has content
    if (appData.userId && message.text) {
      try {
        const metadata = message.estimateLink ? { estimateLink: message.estimateLink } : null;
        await fetch('/api/save-chat-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: appData.userId,
            role: message.role || 'assistant',
            content: message.text,
            files: message.files || [],
            metadata,
          }),
        });
      } catch (error) {
        console.error('[AI Chat] Error saving link message to DB:', error);
      }
    }
  };

  // Function to update the last message (used after action completes)
  const updateLastMessage = async (newText: string, metadata?: any) => {
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          text: newText,
          parts: [{ type: 'text', text: newText }],
        };
      }
      return updated;
    });

    // Save to database
    if (appData.userId) {
      try {
        await fetch('/api/save-chat-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: appData.userId,
            role: 'assistant',
            content: newText,
            files: [],
            metadata: metadata || null,
          }),
        });
      } catch (error) {
        console.error('[AI Chat] Error saving updated message to DB:', error);
      }
    }
  };

  return { messages, sendMessage, isLoading, isLoadingHistory, pendingAction, clearPendingAction, addMessage, updateLastMessage };
}

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
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const conversationModeInitialized = useRef<boolean>(false);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [soundInstance, setSoundInstance] = useState<Audio.Sound | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const isProcessingActionRef = useRef<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const voicesLoadedRef = useRef<boolean>(false);
  const previousMessageCountRef = useRef<number>(0);
  // Store pending receipt data for when user specifies a project
  const pendingReceiptDataRef = useRef<{
    imageData: string;
    store: string;
    amount: number;
    category: string;
    items?: string;
  } | null>(null);
  const pathname = usePathname();
  const router = useRouter();
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
    estimates,
    updateClient,
    updateEstimate,
    addReport,
    addClient,
    addProject,
    addEstimate,
    addExpense,
    refreshEstimates,
    // Additional data for complete business intelligence
    customPriceListItems,
    addCustomPriceListItem,
    addCustomCategory,
    dailyLogs,
    photos,
    subcontractors,
    callLogs,
    proposals,
  } = useApp();

  // Combine master price list with custom items
  const fullPriceList = [...masterPriceList, ...customPriceListItems];

  // Pass all business data to AI assistant for complete data-aware responses
  const { messages, sendMessage, isLoading, isLoadingHistory, pendingAction, clearPendingAction, addMessage, updateLastMessage } = useOpenAIChat({
    projects,
    clients,
    expenses,
    estimates,
    payments,
    clockEntries,
    company,
    updateClient,
    // Additional data for complete business intelligence
    priceList: fullPriceList,
    dailyLogs,
    tasks,
    photos: photos.length > 0 ? photos : mockPhotos, // Use mock if no real photos
    changeOrders,
    subcontractors,
    callLogs,
    users: [], // TODO: Add users from AppContext when available
    proposals,
    userId: user?.id, // User ID for persistent chat history
    currentPageContext, // Pass page context from component prop
  });

  // Handle pending actions from AI assistant
  useEffect(() => {
    const handlePendingAction = async () => {
      if (!pendingAction) return;

      // Prevent duplicate processing if already handling an action
      if (isProcessingActionRef.current) {
        console.log('[AI Action] Already processing, skipping duplicate:', pendingAction.type);
        return;
      }
      isProcessingActionRef.current = true;

      console.log('[AI Action] Handling action:', pendingAction.type);
      setIsProcessingAction(true);

      try {
        switch (pendingAction.type) {
          case 'set_followup':
            // Update client with follow-up date
            if (updateClient && pendingAction.data.clientId) {
              await updateClient(pendingAction.data.clientId, {
                nextFollowUpDate: pendingAction.data.date,
              });
              console.log('[AI Action] Follow-up set for client:', pendingAction.data.clientName);
            }
            break;

          case 'send_inspection_link':
            // TODO: Implement inspection link sending
            console.log('[AI Action] Would send inspection link to:', pendingAction.data.clientEmail);
            break;

          case 'request_payment':
            // TODO: Implement payment request - could navigate to payment screen
            console.log('[AI Action] Would request payment:', pendingAction.data);
            break;

          case 'generate_estimate':
            // Create estimate linked to client using OpenAI API to generate items
            if (addEstimate && pendingAction.data) {
              const { clientId, clientName, projectType, budget, description } = pendingAction.data;

              try {
                // Build price list context for OpenAI (same format as estimate page)
                const priceListContext = masterPriceList.map(item =>
                  `${item.id}|${item.name}|${item.unit}|$${item.unitPrice}`
                ).join('\n');

                const systemPrompt = `You are a construction estimator. Your PRIMARY GOAL is to create estimates that FIT THE CUSTOMER'S BUDGET.

Items (ID|Name|Unit|Price):
${priceListContext}

ABSOLUTE BUDGET CONSTRAINT (HIGHEST PRIORITY):
- When a budget is specified, the final total MUST NOT exceed it by more than 10%
- NEVER generate estimates that are 2x or 3x the stated budget
- If budget is $5000, total must be $4500-$5500 MAX
- Budget compliance is MORE IMPORTANT than including every possible item

HOW TO FIT BUDGET:
1. Start with ESSENTIAL items only (critical work, materials, labor)
2. Use MINIMUM viable quantities
3. Skip nice-to-have items if they push over budget
4. Calculate running total as you add items
5. Stop adding items when approaching budget limit

CRITICAL - RESPONSE FORMAT:
You MUST respond with ONLY a JSON object. NO explanations, NO questions, NO other text.
Format: {"items": [{"priceListItemId":"item-id","quantity":1,"notes":"description"}]}

ONLY use item IDs from the price list above. Do NOT invent new items.`;

                const userPrompt = `Create an estimate for: ${projectType || 'General construction work'}
${description ? `Description: ${description}` : ''}
${budget ? `Budget: $${budget} (MUST stay within this amount)` : ''}

Generate appropriate line items from the price list that fit this scope of work${budget ? ` and budget` : ''}.`;

                // Call OpenAI API
                const openaiResponse = await fetch('/api/generate-estimate-items', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    systemPrompt,
                    userPrompt,
                    priceList: masterPriceList,
                    budget: budget || 0,
                  }),
                });

                let generatedItems: any[] = [];

                if (openaiResponse.ok) {
                  const openaiData = await openaiResponse.json();
                  if (openaiData.success && openaiData.items) {
                    // Map AI response to estimate items with proper structure
                    generatedItems = openaiData.items.map((aiItem: any, index: number) => {
                      const priceListItem = masterPriceList.find(pl => pl.id === aiItem.priceListItemId);
                      if (priceListItem) {
                        return {
                          id: `item-${Date.now()}-${index}`,
                          priceListItemId: priceListItem.id,
                          quantity: aiItem.quantity || 1,
                          unitPrice: priceListItem.unitPrice,
                          total: (aiItem.quantity || 1) * priceListItem.unitPrice,
                          notes: aiItem.notes || '',
                        };
                      }
                      return null;
                    }).filter(Boolean);
                  }
                }

                // Fallback to simple category matching if OpenAI fails
                if (generatedItems.length === 0) {
                  console.log('[AI Action] OpenAI failed, using fallback category matching');
                  generatedItems = getDefaultEstimateItems(projectType || 'General', budget || 0, masterPriceList);
                }

                const subtotal = generatedItems.reduce((sum: number, item: any) => sum + item.total, 0);
                const taxRate = 0.08; // 8% default tax
                const taxAmount = subtotal * taxRate;
                const total = subtotal + taxAmount;

                // Create the estimate linked to the client
                const estimateId = `estimate-${Date.now()}`;
                const newEstimate = {
                  id: estimateId,
                  clientId: clientId,
                  name: `${projectType} Estimate - ${clientName}`,
                  items: generatedItems,
                  subtotal: subtotal,
                  taxRate: taxRate,
                  taxAmount: taxAmount,
                  total: total,
                  createdDate: new Date().toISOString(),
                  status: 'draft' as const,
                };

                // Save to database via API
                const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
                const saveResponse = await fetch(`${apiUrl}/api/save-estimate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ estimate: newEstimate }),
                });

                if (saveResponse.ok) {
                  // Refresh estimates from database to ensure proper data sync
                  await refreshEstimates();
                  console.log('[AI Action] Estimate saved to database:', estimateId, 'with', generatedItems.length, 'items, Client ID:', clientId);

                  // Add follow-up message with link to the estimate
                  const linkMessage = {
                    id: `msg-${Date.now()}-link`,
                    role: 'assistant',
                    text: `You can view the estimate here`,
                    parts: [{ type: 'text', text: `You can view the estimate here` }],
                    estimateLink: {
                      estimateId: estimateId,
                      clientId: clientId,
                      label: 'View Estimate',
                    },
                  };
                  addMessage(linkMessage);
                } else {
                  const errorData = await saveResponse.json();
                  console.error('[AI Action] Failed to save estimate:', errorData.error);
                  // Still add to local state so user sees it
                  addEstimate(newEstimate);

                  // Add link message even if API failed (estimate still created locally)
                  const linkMessage = {
                    id: `msg-${Date.now()}-link`,
                    role: 'assistant',
                    text: `You can view the estimate here`,
                    parts: [{ type: 'text', text: `You can view the estimate here` }],
                    estimateLink: {
                      estimateId: estimateId,
                      clientId: clientId,
                      label: 'View Estimate',
                    },
                  };
                  addMessage(linkMessage);
                }
              } catch (error) {
                console.error('[AI Action] Error generating estimate:', error);
                // Fallback: create estimate with default items
                const fallbackItems = getDefaultEstimateItems(projectType || 'General', budget || 0, masterPriceList);
                const subtotal = fallbackItems.reduce((sum: number, item: any) => sum + item.total, 0);
                const taxRate = 0.08;
                const fallbackEstimateId = `estimate-${Date.now()}`;
                const newEstimate = {
                  id: fallbackEstimateId,
                  clientId: clientId,
                  name: `${projectType} Estimate - ${clientName}`,
                  items: fallbackItems,
                  subtotal: subtotal,
                  taxRate: taxRate,
                  taxAmount: subtotal * taxRate,
                  total: subtotal * 1.08,
                  createdDate: new Date().toISOString(),
                  status: 'draft' as const,
                };
                addEstimate(newEstimate);
                console.log('[AI Action] Fallback estimate created:', fallbackEstimateId);

                // Add link message for fallback estimate
                const linkMessage = {
                  id: `msg-${Date.now()}-link`,
                  role: 'assistant',
                  text: `You can view the estimate here`,
                  parts: [{ type: 'text', text: `You can view the estimate here` }],
                  estimateLink: {
                    estimateId: fallbackEstimateId,
                    clientId: clientId,
                    label: 'View Estimate',
                  },
                };
                addMessage(linkMessage);
              }
            }
            break;

          case 'generate_takeoff_estimate':
            // Create takeoff estimate from attached images/PDFs
            if (pendingAction.data) {
              const { clientName, estimateName, documentDescription, selectedFiles } = pendingAction.data;

              try {
                // Call document analysis API
                const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
                const analysisResponse = await fetch(`${apiUrl}/api/analyze-document`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    companyId: user?.company_id,
                    imageUrls: selectedFiles.map((f: any) => f.uri),
                    fileNames: selectedFiles.map((f: any) => f.name),
                    prompt: `Analyze this construction document (${documentDescription}) and extract a detailed material takeoff.

Return a JSON array of line items with this exact structure:
[
  {
    "item": "Material name",
    "quantity": number,
    "unit": "unit of measurement (e.g., SQ FT, LF, EA)",
    "notes": "Additional details or location"
  }
]

Important:
- Extract ALL materials, dimensions, and quantities visible
- Include measurements from blueprints (convert to actual dimensions if scale is shown)
- For floor plans: include flooring, walls, trim, doors, windows
- For foundation: concrete volume, rebar lengths, forms
- Be comprehensive but accurate
- If you see a scale (e.g., 1/4" = 1'), apply it to measurements
- Return ONLY the JSON array, no other text`
                  })
                });

                if (!analysisResponse.ok) {
                  throw new Error('Document analysis failed');
                }

                const analysisResult = await analysisResponse.json();
                if (!analysisResult.success) {
                  throw new Error(analysisResult.error || 'Failed to analyze document');
                }

                // Parse AI response
                const extractedItems = JSON.parse(analysisResult.analysis);

                // Match items to price list
                const matchedItems = extractedItems.map((extracted: any) => {
                  const match = masterPriceList.find((pl: any) =>
                    pl.name.toLowerCase().includes(extracted.item.toLowerCase()) ||
                    extracted.item.toLowerCase().includes(pl.name.toLowerCase())
                  );

                  return {
                    priceListItemId: match?.id || null,
                    name: match?.name || extracted.item,
                    category: match?.category || 'Materials',
                    unit: match?.unit || extracted.unit,
                    quantity: extracted.quantity,
                    unitPrice: match?.unitPrice || 0,
                    total: (match?.unitPrice || 0) * extracted.quantity,
                    notes: extracted.notes
                  };
                });

                // Find or create client
                let client = clients.find((c: any) =>
                  c.name.toLowerCase() === clientName.toLowerCase()
                );

                if (!client && addClient) {
                  // Create new client
                  const newClientId = `client-${Date.now()}`;
                  const newClient = {
                    id: newClientId,
                    name: clientName,
                    email: '',
                    phone: '',
                    status: 'lead' as const,
                    source: 'AI Assistant',
                    createdDate: new Date().toISOString(),
                  };
                  await addClient(newClient);
                  client = newClient;
                }

                if (client) {
                  // Create estimate
                  const subtotal = matchedItems.reduce((sum: number, item: any) => sum + item.total, 0);
                  const taxRate = 0.105; // 10.5% default
                  const taxAmount = subtotal * taxRate;
                  const total = subtotal + taxAmount;

                  const estimateId = `estimate-${Date.now()}`;
                  const newEstimate = {
                    id: estimateId,
                    clientId: client.id,
                    name: estimateName,
                    items: matchedItems.map((item: any, index: number) => ({
                      id: `item-${Date.now()}-${index}`,
                      priceListItemId: item.priceListItemId,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      total: item.total,
                      notes: item.notes
                    })),
                    subtotal,
                    taxRate,
                    taxAmount,
                    total,
                    createdDate: new Date().toISOString(),
                    status: 'draft' as const,
                  };

                  // Save to database
                  const saveResponse = await fetch(`${apiUrl}/api/save-estimate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estimate: newEstimate }),
                  });

                  if (saveResponse.ok) {
                    await refreshEstimates();
                    console.log('[AI Action] Takeoff estimate saved:', estimateId);

                    // Add link message
                    const linkMessage = {
                      id: `msg-${Date.now()}-link`,
                      role: 'assistant',
                      text: `I've created a takeoff estimate "${estimateName}" with ${matchedItems.length} line items.\n\nTotal: $${total.toFixed(2)}`,
                      parts: [{ type: 'text', text: `I've created a takeoff estimate "${estimateName}" with ${matchedItems.length} line items.\n\nTotal: $${total.toFixed(2)}` }],
                      takeoffLink: {
                        estimateId: estimateId,
                        clientId: client.id,
                        label: '📋 View Takeoff Estimate',
                      },
                    };
                    addMessage(linkMessage);
                  }
                }
              } catch (error) {
                console.error('[AI Action] Error generating takeoff estimate:', error);
                const errorMessage = {
                  id: `msg-${Date.now()}-error`,
                  role: 'assistant',
                  text: 'Sorry, I encountered an error generating the takeoff estimate. Please try again.',
                  parts: [{ type: 'text', text: 'Sorry, I encountered an error generating the takeoff estimate. Please try again.' }],
                };
                addMessage(errorMessage);
              }
            }
            break;

          case 'send_estimate':
            // Send estimate via email - generates PDF and opens mail client
            if (pendingAction.data) {
              const { estimateId, clientId } = pendingAction.data;
              console.log('[AI Action] Sending estimate:', estimateId);

              try {
                await sendEstimate({
                  estimateId,
                  estimates,
                  clients,
                  projects,
                  company,
                  customPriceListItems,
                  updateEstimate,
                  clientId,
                });
                console.log('[AI Action] Estimate send initiated successfully');
              } catch (error) {
                console.error('[AI Action] Error sending estimate:', error);
              }
            }
            break;

          case 'save_report':
            // Save AI-generated report to database
            if (addReport && pendingAction.data) {
              const reportData = pendingAction.data;
              const reportType = reportData.reportType || 'custom';

              // Map reportType to valid database type
              const typeMap: { [key: string]: 'administrative' | 'financial' | 'time-tracking' | 'expenses' | 'custom' } = {
                'administrative': 'administrative',
                'financial': 'financial',
                'time-tracking': 'time-tracking',
                'expenses': 'expenses',
                'custom': 'custom',
                'daily-logs': 'custom', // Daily logs stored as custom type
              };

              // Create report object matching the Report type from project/[id].tsx
              const report = {
                id: `report-ai-${Date.now()}`,
                name: reportData.reportName || `AI ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
                type: typeMap[reportType] || 'custom',
                generatedDate: new Date().toISOString(),
                projectIds: reportData.projectIds || [],
                projectsCount: reportData.projectsCount || reportData.projectIds?.length || 0,
                totalBudget: reportData.totalBudget || 0,
                totalExpenses: reportData.totalExpenses || 0,
                totalHours: reportData.totalHours || 0,
                notes: reportData.notes || undefined,
                expensesByCategory: reportData.expensesByCategory || undefined,
                employeeData: reportData.employeeData || undefined,
                employeeIds: reportData.employeeIds || undefined,
                projects: reportData.projects || undefined,
              };

              await addReport(report);
              console.log('[AI Action] Report saved to database:', report.name, 'Type:', report.type);
            }
            break;

          case 'add_client':
            // Add new client to CRM
            if (addClient && pendingAction.data) {
              const newClient = {
                id: `client-${Date.now()}`,
                name: pendingAction.data.name,
                email: pendingAction.data.email,
                phone: pendingAction.data.phone,
                address: pendingAction.data.address || undefined,
                source: pendingAction.data.source,
                status: pendingAction.data.status || 'Lead',
                lastContactDate: new Date().toISOString(),
              };
              await addClient(newClient);
              console.log('[AI Action] Client added to CRM:', newClient.name);
            }
            break;

          case 'create_price_list_items':
            // Create new price list items (and optionally a new category)
            if (addCustomPriceListItem && pendingAction.data) {
              const { category, isNewCategory, items } = pendingAction.data;

              // Create category if it's new
              if (isNewCategory && addCustomCategory) {
                await addCustomCategory({
                  id: `cat-${Date.now()}`,
                  name: category,
                  createdAt: new Date().toISOString(),
                });
                console.log('[AI Action] Created new category:', category);
              }

              // Create each item
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                await addCustomPriceListItem({
                  id: `pl-custom-${Date.now()}-${i}`,
                  category,
                  name: item.name,
                  description: item.description || '',
                  unit: item.unit,
                  unitPrice: item.unitPrice,
                  isCustom: true,
                  createdAt: new Date().toISOString(),
                });
                console.log('[AI Action] Created price list item:', item.name);
              }

              console.log('[AI Action] Created', items.length, 'price list items in category:', category);
            }
            break;

          case 'approve_estimate':
            // Approve an estimate - change status to approved
            if (updateEstimate && pendingAction.data) {
              const { estimateId, estimateName, clientName } = pendingAction.data;
              await updateEstimate(estimateId, { status: 'approved' });
              console.log('[AI Action] Estimate approved:', estimateName, 'for', clientName);
            }
            break;

          case 'convert_estimate_to_project':
            // Convert an estimate to a project (auto-approve if needed)
            if (updateEstimate && pendingAction.data && company?.id) {
              const { estimateId, estimateName, clientName, budget, needsApproval } = pendingAction.data;

              // If estimate needs approval, approve it first
              if (needsApproval) {
                await updateEstimate(estimateId, { status: 'approved' });
                console.log('[AI Action] Auto-approved estimate:', estimateName);
              }

              // Use direct API endpoint for reliable project creation
              console.log('[AI Action] Creating project via direct API...');
              const projectName = estimateName.replace(' Estimate', '').replace(' - ' + clientName, '');

              const response = await fetch('/api/add-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyId: company.id,
                  name: projectName,
                  budget: parseFloat(budget) || 0,
                  expenses: 0,
                  progress: 0,
                  status: 'active',
                  image: '',
                  hoursWorked: 0,
                  startDate: new Date().toISOString(),
                  estimateId: estimateId, // Link the project to the estimate
                }),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create project');
              }

              const result = await response.json();

              if (result.success && result.project) {
                // Update local state with the new project from database
                // The project has a UUID from Supabase, so addProject won't re-sync
                if (addProject) {
                  await addProject(result.project);
                }
                console.log('[AI Action] Project created successfully:', result.project.id, 'for', clientName);
              } else {
                throw new Error('Project creation failed - no project returned');
              }
            }
            break;

          case 'add_expense':
            // Add an expense to a project
            if (addExpense && pendingAction.data) {
              const { projectId, type, subcategory, amount, store, date, receiptImageData } = pendingAction.data;

              let receiptUrl: string | undefined;

              // Check for image data from action data OR from pending receipt data ref
              const imageDataToUpload = receiptImageData || pendingReceiptDataRef.current?.imageData;

              // Upload receipt to S3 if image data provided
              // Check if it's already an S3 URL (already uploaded)
              if (imageDataToUpload && imageDataToUpload.startsWith('http')) {
                receiptUrl = imageDataToUpload;
                console.log('[AI Action] Using existing S3 URL:', receiptUrl);
              } else if (imageDataToUpload && imageDataToUpload.startsWith('data:')) {
                // Upload base64 data to S3
                try {
                  console.log('[AI Action] Uploading receipt image to S3...');
                  const uploadResponse = await fetch('/api/upload-to-s3', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      fileData: imageDataToUpload,
                      fileName: `receipt-${Date.now()}.jpg`,
                      fileType: 'image/jpeg',
                    }),
                  });

                  if (uploadResponse.ok) {
                    const uploadResult = await uploadResponse.json();
                    receiptUrl = uploadResult.url;
                    console.log('[AI Action] Receipt uploaded:', receiptUrl);
                  } else {
                    console.error('[AI Action] Failed to upload receipt:', await uploadResponse.text());
                  }
                } catch (e) {
                  console.error('[AI Action] Error uploading receipt:', e);
                }
              }

              // Use pending receipt data for store/amount if available and not provided
              const finalStore = store || pendingReceiptDataRef.current?.store || '';
              const finalAmount = amount || pendingReceiptDataRef.current?.amount || 0;
              const finalSubcategory = subcategory || pendingReceiptDataRef.current?.category || type || 'Material';

              // Create the expense
              await addExpense({
                id: `expense-${Date.now()}`,
                projectId,
                type: type || 'Material',
                subcategory: finalSubcategory,
                amount: parseFloat(String(finalAmount)) || 0,
                store: finalStore,
                date: date || new Date().toISOString(),
                receiptUrl,
              });

              console.log('[AI Action] Added expense:', finalAmount, 'to project:', projectId, 'with receipt:', receiptUrl ? 'yes' : 'no');

              // Clear the pending receipt data after use
              pendingReceiptDataRef.current = null;
            }
            break;

          default:
            console.log('[AI Action] Unknown action type:', pendingAction.type);
        }

        // Action succeeded - update the "Working on it..." message with success message
        const successMsg = pendingAction.successMessage || 'Done!';
        await updateLastMessage(successMsg);
        console.log('[AI Action] Updated message with success:', successMsg);
      } catch (error: any) {
        console.error('[AI Action] Error handling action:', error);
        // Action failed - update the message with error
        const errorMsg = `Sorry, there was an error: ${error.message || 'Unknown error'}. Please try again.`;
        await updateLastMessage(errorMsg);
      } finally {
        setIsProcessingAction(false);
        isProcessingActionRef.current = false;
        clearPendingAction();
      }
    };

    handlePendingAction();
  }, [pendingAction, updateClient, addReport, addClient, addProject, addEstimate, addExpense, refreshEstimates, clearPendingAction, updateLastMessage, addCustomPriceListItem, addCustomCategory, updateEstimate]);

  // Complete cleanup function for conversation mode
  const cleanupConversationMode = useCallback(async () => {
    console.log('[Conversation] Complete cleanup starting');

    // Clear conversation mode flags
    conversationModeInitialized.current = false;
    setIsConversationMode(false);
    setIsRecording(false);
    setIsTranscribing(false);

    // Stop and clear MediaRecorder
    if (Platform.OS === 'web' && mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      console.log('[Cleanup] MediaRecorder state:', recorder.state);

      // Get stream from MediaRecorder and stop its tracks
      if (recorder.stream) {
        console.log('[Cleanup] Stopping tracks from MediaRecorder stream');
        recorder.stream.getTracks().forEach(track => {
          console.log('[Cleanup] MediaRecorder track:', track.kind, track.label, track.readyState);
          track.stop();
          console.log('[Cleanup] MediaRecorder track after stop:', track.readyState);
        });
      }

      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    }

    // Clear silence detection timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      console.log('[Cleanup] Cleared silence timer');
    }

    // Stop all media stream tracks
    if (streamRef.current) {
      const stream = streamRef.current;
      console.log('[Cleanup] Stopping', stream.getTracks().length, 'tracks');

      stream.getTracks().forEach(track => {
        console.log('[Cleanup] Track:', track.kind, 'label:', track.label, 'state:', track.readyState);
        track.stop();
        console.log('[Cleanup] After stop - state:', track.readyState);
      });

      streamRef.current = null;
    }

    // Disconnect microphone source from audio context
    if (microphoneSourceRef.current) {
      console.log('[Cleanup] Disconnecting microphone source node');
      try {
        microphoneSourceRef.current.disconnect();
        microphoneSourceRef.current = null;
        console.log('[Cleanup] Microphone source disconnected');
      } catch (error) {
        console.error('[Cleanup] Error disconnecting microphone:', error);
      }
    }

    // Clear analyser
    if (analyserRef.current) {
      console.log('[Cleanup] Clearing analyser node');
      try {
        analyserRef.current.disconnect();
      } catch (e) {}
      analyserRef.current = null;
    }

    // Close audio context and wait for it to fully close
    if (audioContextRef.current) {
      console.log('[Cleanup] Closing audio context, state:', audioContextRef.current.state);
      const context = audioContextRef.current;

      try {
        await context.close();
        console.log('[Cleanup] Audio context fully closed, state:', context.state);
      } catch (error) {
        console.error('[Cleanup] Error closing audio context:', error);
      }

      audioContextRef.current = null;
    }

    console.log('[Conversation] Complete cleanup finished');

    // Verify all media devices are released
    setTimeout(async () => {
      console.log('[Cleanup] Final verification - checking media devices...');

      if (Platform.OS === 'web' && navigator.mediaDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(d => d.kind === 'audioinput');
          console.log('[Cleanup] Available audio inputs:', audioInputs.length);

          // Check if any streams are active (Chrome DevTools check)
          console.log('[Cleanup] All media stream tracks should be stopped now');
          console.log('[Cleanup] If mic indicator is still on, this is a Chrome UI bug');
        } catch (error) {
          console.error('[Cleanup] Error checking devices:', error);
        }
      }
    }, 200);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Only auto-speak if this is a NEW message (message count increased)
      const hasNewMessage = messages.length > previousMessageCountRef.current;
      previousMessageCountRef.current = messages.length;

      if (isConversationMode && conversationModeInitialized.current && !isSpeaking && !isRecording && hasNewMessage) {
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

  // Scroll to bottom when history finishes loading or when chat opens
  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      // Use a longer delay to ensure content is fully rendered after history load
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 300);
      // Double-check scroll after a longer delay for slower renders
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 600);
    }
  }, [isLoadingHistory, messages.length]);

  // Scroll to bottom when modal opens
  useEffect(() => {
    if (isOpen && messages.length > 0 && !isLoadingHistory) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [isOpen]);

  // Load and cache preferred voice on mount
  useEffect(() => {
    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('[TTS] Available voices:', voices.length);

        if (voices.length > 0 && !voicesLoadedRef.current) {
          // Select a consistent English voice - prefer Google US English
          const preferredVoice =
            voices.find(voice => voice.name === 'Google US English') ||
            voices.find(voice => voice.name.includes('Google') && voice.lang.startsWith('en-US')) ||
            voices.find(voice => voice.name.includes('Microsoft') && voice.lang.startsWith('en-US')) ||
            voices.find(voice => voice.lang.startsWith('en-US')) ||
            voices.find(voice => voice.lang.startsWith('en'));

          if (preferredVoice) {
            preferredVoiceRef.current = preferredVoice;
            voicesLoadedRef.current = true;
            console.log('[TTS] Selected voice:', preferredVoice.name, preferredVoice.lang);
          }
        }
      };

      // Load voices immediately
      loadVoices();

      // Also listen for voiceschanged event (needed for Chrome)
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const startRecording = async () => {
    try {
      console.log('[Voice] Starting recording...');
      if (Platform.OS === 'web') {
        // Reuse existing stream in conversation mode, or get a new one
        let stream = streamRef.current;
        if (!stream || stream.getTracks().length === 0 || stream.getTracks()[0].readyState !== 'live') {
          console.log('[Voice] Getting new media stream');
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
        } else {
          console.log('[Voice] Reusing existing media stream');
        }

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
          console.log('[Voice] Starting silence detection for conversation mode');
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

      // Clear silence detection timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Clean up audio analysis (but not the stream if in conversation mode)
      if (microphoneSourceRef.current) {
        try {
          microphoneSourceRef.current.disconnect();
          microphoneSourceRef.current = null;
        } catch (e) {
          console.error('[Recording] Error disconnecting microphone source:', e);
        }
      }

      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
          analyserRef.current = null;
        } catch (e) {
          console.error('[Recording] Error disconnecting analyser:', e);
        }
      }

      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        } catch (e) {
          console.error('[Recording] Error closing audio context:', e);
        }
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

        // Stop the stream if NOT in conversation mode (for one-time recordings)
        if (!isConversationMode && streamRef.current) {
          console.log('[Recording] Stopping stream for non-conversation recording');
          streamRef.current.getTracks().forEach(track => {
            console.log('[Recording] Stopping track:', track.kind, track.label, track.readyState);
            track.stop();
            console.log('[Recording] Track stopped, new state:', track.readyState);
          });
          streamRef.current = null;
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

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64 }),
      });

      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }

      const result = await response.json();

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
        } else if (!isConversationMode) {
          // Only set input if we're NOT in conversation mode
          // (i.e., user explicitly used voice-to-text button)
          setInput(transcribedText);
        }
        // If in conversation mode but sendImmediately is false, discard the transcription
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

      // Convert audio blob to base64 using browser-compatible method
      const arrayBuffer = await audio.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64 }),
      });

      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }

      const result = await response.json();

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
        } else if (!isConversationMode) {
          // Only set input if we're NOT in conversation mode
          // (i.e., user explicitly used voice-to-text button)
          setInput(transcribedText);
        }
        // If in conversation mode but sendImmediately is false, discard the transcription
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
    console.log('[TTS] Stopping speech');

    // Stop browser speech synthesis
    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      console.log('[TTS] Cancelled browser speech synthesis');
    }

    // Stop mobile audio
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

      console.log('[TTS] Speaking:', text.substring(0, 50));
      setIsSpeaking(true);

      // Use browser's built-in speech synthesis for instant playback
      if (Platform.OS === 'web' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Use cached voice for consistency and instant playback
        if (preferredVoiceRef.current) {
          utterance.voice = preferredVoiceRef.current;
          console.log('[TTS] Using cached voice:', preferredVoiceRef.current.name);
        } else {
          console.warn('[TTS] No cached voice, using default');
        }

        utterance.onend = () => {
          console.log('[TTS] Finished speaking');
          setIsSpeaking(false);

          if (autoStartRecording && isConversationMode && conversationModeInitialized.current) {
            console.log('[Conversation] Starting recording after speech');
            setTimeout(() => {
              if (isConversationMode && conversationModeInitialized.current) {
                startRecording();
              }
            }, 500);
          }
        };

        utterance.onerror = (event) => {
          console.error('[TTS] Speech error:', event);
          setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
      } else {
        // Fallback to OpenAI TTS for mobile or if browser doesn't support speech synthesis
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text,
            voice: 'nova',
            model: 'tts-1',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate speech');
        }

        const result = await response.json();

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
      }
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
      microphoneSourceRef.current = microphone;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let silenceStart = Date.now();
      let hasSpoken = false;
      let lastLoggedLevel = 0;
      let peakLevel = 0; // Track the highest level when speaking
      let baselineLevel = 0; // Track background noise level
      let sampleCount = 0;

      // More conservative thresholds
      const SILENCE_DURATION = 1500; // 1.5 seconds of silence
      const INITIAL_SPEECH_THRESHOLD = 50; // Initial threshold to detect speech start
      const BASELINE_SAMPLES = 10; // Number of samples to calculate baseline

      const checkAudioLevel = () => {
        // Check actual recording state instead of React state to avoid closure issues
        if (!conversationModeInitialized.current) {
          console.log('[Silence Detection] Stopped: conversation mode not initialized');
          return;
        }

        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
          console.log('[Silence Detection] Stopped: MediaRecorder not recording, state:', mediaRecorderRef.current?.state);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;

        // Calculate baseline noise level from first few samples
        if (sampleCount < BASELINE_SAMPLES && !hasSpoken) {
          baselineLevel = ((baselineLevel * sampleCount) + average) / (sampleCount + 1);
          sampleCount++;
          console.log('[Silence Detection] Calculating baseline:', Math.round(baselineLevel), 'current:', Math.round(average));
        }

        // Adaptive threshold: baseline + 20
        const adaptiveSpeechThreshold = Math.max(baselineLevel + 20, INITIAL_SPEECH_THRESHOLD);
        const adaptiveSilenceThreshold = baselineLevel + 10;

        // Only log when there's a significant change in audio level
        if (Math.abs(average - lastLoggedLevel) > 10) {
          console.log('[Silence Detection] Audio:', Math.round(average), 'Peak:', Math.round(peakLevel), 'Baseline:', Math.round(baselineLevel), 'Thresholds:', Math.round(adaptiveSpeechThreshold), '/', Math.round(adaptiveSilenceThreshold));
          lastLoggedLevel = average;
        }

        // Detect speech start
        if (average > adaptiveSpeechThreshold) {
          if (!hasSpoken) {
            console.log('[Silence Detection] Speech detected! Level:', Math.round(average), 'Threshold:', Math.round(adaptiveSpeechThreshold));
          }
          hasSpoken = true;
          peakLevel = Math.max(peakLevel, average);
          silenceStart = Date.now();
        }
        // Detect silence after speech
        else if (hasSpoken && average < adaptiveSilenceThreshold) {
          const silenceDuration = Date.now() - silenceStart;

          // Log silence progress every 500ms
          if (silenceDuration % 500 < 100) {
            console.log('[Silence Detection] Silent for', Math.round(silenceDuration), 'ms (need', SILENCE_DURATION, 'ms)');
          }

          if (silenceDuration > SILENCE_DURATION) {
            console.log('[Silence Detection] Auto-stopping - silence for', silenceDuration, 'ms');
            stopRecording(true);
            return;
          }
        }
        // Still speaking (above silence threshold but below speech threshold)
        else if (hasSpoken) {
          silenceStart = Date.now(); // Reset silence timer
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

  // Compress image to reduce size for API requests
  const compressImage = async (uri: string): Promise<string> => {
    // Only compress on native platforms (not web)
    if (Platform.OS === 'web') {
      return uri;
    }

    try {
      console.log('[Image Compression] Starting compression...');

      // Resize to max 1024px on longest side and compress to 70% quality
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );

      console.log('[Image Compression] Compressed successfully, new URI:', result.uri);
      return result.uri;
    } catch (error) {
      console.error('[Image Compression] Error compressing image:', error);
      // Return original URI if compression fails
      return uri;
    }
  };

  const convertFileToDataUri = async (file: AttachedFile): Promise<string> => {
    try {
      console.log('[File Conversion] Starting conversion for:', file.name);

      // Check if this is an image that needs compression
      const isImage = file.mimeType.startsWith('image/');
      let uriToProcess = file.uri;

      // Compress images before converting to data URI
      if (isImage && Platform.OS !== 'web') {
        uriToProcess = await compressImage(file.uri);
      }

      if (Platform.OS === 'web') {
        if (uriToProcess.startsWith('data:')) {
          // For web, if image is already a data URI and large, compress via canvas
          if (isImage && uriToProcess.length > 500000) { // > 500KB
            console.log('[File Conversion] Compressing large web image...');
            return await compressWebImage(uriToProcess);
          }
          return uriToProcess;
        }

        const response = await fetch(uriToProcess);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }

        const blob = await response.blob();

        // For web images, compress if large
        if (isImage && blob.size > 500000) {
          console.log('[File Conversion] Compressing large web blob...');
          const dataUri = await blobToDataUri(blob);
          return await compressWebImage(dataUri);
        }

        return await blobToDataUri(blob);
      } else {
        const base64 = await FileSystem.readAsStringAsync(uriToProcess, {
          encoding: 'base64' as any,
        });
        if (!base64 || base64.length === 0) {
          throw new Error('Failed to read file or file is empty');
        }
        // Use JPEG for compressed images
        const outputMimeType = isImage ? 'image/jpeg' : file.mimeType;
        return `data:${outputMimeType};base64,${base64}`;
      }
    } catch (error) {
      console.error('[File Conversion] Error:', error);
      throw new Error(`Could not process file ${file.name}`);
    }
  };

  // Helper to convert blob to data URI
  const blobToDataUri = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (!result) {
          reject(new Error('FileReader returned empty result'));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => reject(new Error('FileReader failed to read file'));
      reader.readAsDataURL(blob);
    });
  };

  // Compress image on web using canvas
  const compressWebImage = async (dataUri: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1024;
        let { width, height } = img;

        // Scale down if larger than maxSize
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with 70% quality
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        console.log('[File Conversion] Web image compressed from', dataUri.length, 'to', compressed.length, 'bytes');
        resolve(compressed);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = dataUri;
    });
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

    const userMessage = input.trim() || 'Please analyze the attached images';
    const hasImages = attachedFiles.some(f => f.mimeType.startsWith('image/'));
    const hasPDFs = attachedFiles.some(f => f.mimeType === 'application/pdf');

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
      // Upload PDFs to S3 first if any are attached
      const filesWithS3Urls = [...attachedFiles];
      if (hasPDFs) {
        console.log('[Send] Uploading PDFs to S3...');
        for (let i = 0; i < filesWithS3Urls.length; i++) {
          const file = filesWithS3Urls[i];
          if (file.mimeType === 'application/pdf') {
            try {
              const dataUri = await convertFileToDataUri(file);
              const uploadResponse = await fetch('/api/upload-to-s3', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileData: dataUri,
                  fileName: file.name || `document-${Date.now()}.pdf`,
                  fileType: 'application/pdf',
                  folder: 'ai-assistant-documents',
                }),
              });

              if (uploadResponse.ok) {
                const uploadResult = await uploadResponse.json();
                // Replace local URI with S3 URL
                filesWithS3Urls[i] = {
                  ...file,
                  uri: uploadResult.url,
                };
                console.log('[Send] PDF uploaded to S3:', uploadResult.url);
              } else {
                console.error('[Send] Failed to upload PDF to S3');
              }
            } catch (uploadError) {
              console.error('[Send] Error uploading PDF:', uploadError);
            }
          }
        }
      }

      if (hasImages) {
        console.log('[Send] Processing with images');

        // Check if this is likely a receipt/expense request
        const lowerMessage = userMessage.toLowerCase();
        const isReceiptRequest =
          lowerMessage.includes('expense') ||
          lowerMessage.includes('receipt') ||
          lowerMessage.includes('add this') ||
          lowerMessage.includes('analyze this') ||
          lowerMessage === 'please analyze the attached images';

        if (isReceiptRequest && attachedFiles.length === 1 && !hasPDFs) {
          // Use dedicated receipt analysis endpoint to avoid payload size issues
          console.log('[Send] Using dedicated receipt analysis endpoint');
          const file = attachedFiles[0];
          const dataUri = await convertFileToDataUri(file);

          setAttachedFiles([]);

          // Add user message to chat (with file for display in UI)
          addMessage({
            id: Date.now().toString(),
            role: 'user',
            parts: [{ type: 'text', text: userMessage }],
            text: userMessage,
            files: [{ uri: dataUri, mimeType: file.mimeType || 'image/jpeg' }],
          });

          // Show loading message
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            parts: [{ type: 'text', text: 'Analyzing receipt...' }],
            text: 'Analyzing receipt...',
          });

          try {
            const response = await fetch('/api/analyze-receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageData: dataUri,
              }),
            });

            if (!response.ok) {
              throw new Error(`Receipt analysis failed: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
              const { store, amount, category, items, confidence } = result.data;

              // Upload receipt image to S3 immediately so it persists
              let receiptS3Url: string | undefined;
              try {
                console.log('[Send] Uploading receipt to S3...');
                const uploadResponse = await fetch('/api/upload-to-s3', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fileData: dataUri,
                    fileName: `receipt-${Date.now()}.jpg`,
                    fileType: 'image/jpeg',
                  }),
                });
                if (uploadResponse.ok) {
                  const uploadResult = await uploadResponse.json();
                  receiptS3Url = uploadResult.url;
                  console.log('[Send] Receipt uploaded to S3:', receiptS3Url);
                }
              } catch (uploadError) {
                console.error('[Send] Failed to upload receipt to S3:', uploadError);
              }

              // Store the receipt data for when user specifies the project
              // Use S3 URL if available, otherwise fall back to base64 data
              pendingReceiptDataRef.current = {
                imageData: receiptS3Url || dataUri,
                store: store || '',
                amount: amount || 0,
                category: category || 'Material',
                items: items || undefined,
              };
              console.log('[Send] Stored pending receipt data for later use');

              // Update the last message with receipt analysis results
              const analysisMessage = `I've analyzed the receipt:\n- Store: ${store}\n- Amount: $${amount?.toFixed(2) || '0.00'}\n- Category: ${category}\n${items ? `- Items: ${items}\n` : ''}\nWhich project should I add this expense to?`;

              updateLastMessage(analysisMessage);
            } else {
              updateLastMessage('I couldn\'t analyze the receipt clearly. Please enter the expense details manually, or try taking another photo with better lighting.');
            }
          } catch (analyzeError) {
            console.error('[Send] Receipt analysis error:', analyzeError);
            updateLastMessage('Sorry, I had trouble analyzing the receipt. Please try again or enter the expense details manually.');
          }
          return;
        }

        // For non-receipt images or multiple images, use the regular flow
        const filesForAI: { type: 'file'; mimeType: string; uri: string; name?: string; size?: number; }[] = [];

        // Add images
        for (const file of filesWithS3Urls.filter(f => f.mimeType.startsWith('image/'))) {
          const dataUri = await convertFileToDataUri(file);
          filesForAI.push({
            type: 'file',
            mimeType: file.mimeType,
            uri: dataUri,
            name: file.name,
            size: file.size,
          });
        }

        // Add PDFs with S3 URLs
        for (const file of filesWithS3Urls.filter(f => f.mimeType === 'application/pdf')) {
          filesForAI.push({
            type: 'file',
            mimeType: file.mimeType,
            uri: file.uri, // This is now the S3 URL
            name: file.name,
            size: file.size,
          });
        }

        setAttachedFiles([]);

        await sendMessage({
          text: userMessage,
          files: filesForAI as any,
        });
      } else if (hasPDFs) {
        // PDFs only (no images)
        console.log('[Send] Sending message with PDFs');
        const filesForAI: { type: 'file'; mimeType: string; uri: string; name?: string; size?: number; }[] = [];

        for (const file of filesWithS3Urls.filter(f => f.mimeType === 'application/pdf')) {
          filesForAI.push({
            type: 'file',
            mimeType: file.mimeType,
            uri: file.uri, // This is now the S3 URL
            name: file.name,
            size: file.size,
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
          {isLoadingHistory ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.emptyStateTitle}>Loading chat history...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Bot size={56} color="#D1D5DB" strokeWidth={2} />
              <Text style={styles.emptyStateTitle}>Ask me anything!</Text>
              <Text style={styles.emptyStateText}>
                I can analyze images, do blueprint takeoffs, generate images, and answer your questions. Try me!
              </Text>
            </View>
          ) : null}

          {/* PDF Attachment Display Component */}
          {(() => {
            const PDFAttachment = ({ file }: { file: any }) => (
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.open(file.uri, '_blank');
                  } else {
                    Alert.alert('PDF', `${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FEF3C7',
                  padding: 12,
                  borderRadius: 8,
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: '#FCD34D',
                }}
              >
                <FileText size={24} color="#D97706" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400E' }}>
                    {file.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#78350F', marginTop: 2 }}>
                    PDF • {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </View>
                <Download size={18} color="#D97706" />
              </TouchableOpacity>
            );
            return null;
          })()}

          {messages.map((message) => (
            <View key={message.id} style={styles.messageWrapper}>
              {/* Show attached files for user messages */}
              {message.role === 'user' && message.files && message.files.length > 0 && (
                <View style={styles.userMessageContainer}>
                  {/* Images */}
                  {message.files.filter((f: any) => f.mimeType?.startsWith('image/') || f.uri?.startsWith('data:image')).length > 0 && (
                    <View style={styles.attachedImagesContainer}>
                      {message.files.filter((f: any) => f.mimeType?.startsWith('image/') || f.uri?.startsWith('data:image')).map((file: any, idx: number) => (
                        <Image
                          key={`${message.id}-img-${idx}`}
                          source={{ uri: file.uri }}
                          style={styles.attachedImage}
                          resizeMode="cover"
                        />
                      ))}
                    </View>
                  )}
                  {/* PDFs */}
                  {message.files.filter((f: any) => f.mimeType === 'application/pdf').map((file: any, idx: number) => (
                    <TouchableOpacity
                      key={`${message.id}-pdf-${idx}`}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.open(file.uri, '_blank');
                        } else {
                          Alert.alert('PDF', `${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                        }
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#FEF3C7',
                        padding: 12,
                        borderRadius: 8,
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: '#FCD34D',
                      }}
                    >
                      <FileText size={24} color="#D97706" />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400E' }}>
                          {file.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#78350F', marginTop: 2 }}>
                          PDF • {(file.size / 1024 / 1024).toFixed(2)} MB
                        </Text>
                      </View>
                      <Download size={18} color="#D97706" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <View key={`${message.id}-${i}`} style={message.role === 'user' ? styles.userMessageContainer : styles.assistantMessageContainer}>
                      <View style={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                        <Text style={message.role === 'user' ? styles.userMessageText : styles.assistantMessageText} selectable>
                          {part.text}
                          {/* Render estimate link if present */}
                          {message.estimateLink && (
                            <>
                              {' '}
                              <Text
                                style={{ color: '#2563EB', textDecorationLine: 'underline', fontWeight: '600' }}
                                onPress={() => {
                                  router.push(`/project/new/estimate?clientId=${message.estimateLink.clientId}&estimateId=${message.estimateLink.estimateId}`);
                                }}
                              >
                                {message.estimateLink.label || 'here'}
                              </Text>
                            </>
                          )}
                        </Text>
                        {message.takeoffLink && (
                          <TouchableOpacity
                            onPress={() => {
                              router.push(`/project/new/takeoff?clientId=${message.takeoffLink.clientId}&estimateId=${message.takeoffLink.estimateId}`);
                            }}
                            style={{
                              backgroundColor: '#10B981',
                              paddingVertical: 10,
                              paddingHorizontal: 16,
                              borderRadius: 8,
                              marginTop: 12,
                              alignSelf: 'flex-start',
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                              {message.takeoffLink.label}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {message.role === 'assistant' && !message.estimateLink && !message.takeoffLink && (
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
                          <Text style={styles.toolText}>Analyzing {part.toolName}...</Text>
                        </View>
                      </View>
                    );
                  }
                  if (part.state === 'output-available') {
                    return (
                      <View key={`${message.id}-${i}`} style={styles.assistantMessageContainer}>
                        <View style={[styles.assistantMessage, styles.toolMessage]}>
                          <Text style={styles.toolText}>✓ {part.toolName} completed</Text>
                        </View>
                      </View>
                    );
                  }
                }
                return null;
              })}
            </View>
          ))}

          {/* Loading indicator while AI is responding */}
          {isLoading && (
            <View style={styles.assistantMessageContainer}>
              <View style={styles.assistantMessage}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={[styles.assistantMessageText, { marginLeft: 8, fontStyle: 'italic' }]}>
                  AI is thinking...
                </Text>
              </View>
            </View>
          )}

          {/* Loading indicator while AI is performing an action */}
          {isProcessingAction && (
            <View style={styles.assistantMessageContainer}>
              <View style={[styles.assistantMessage, { backgroundColor: '#ECFDF5' }]}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={[styles.assistantMessageText, { marginLeft: 8, fontStyle: 'italic', color: '#059669' }]}>
                  Performing action...
                </Text>
              </View>
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
                  <Text style={styles.recordingText}>
                    {isConversationMode ? 'Speak now - I\'ll stop when you\'re done' : 'Recording...'}
                  </Text>
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
                  <Text style={styles.recordingButtonText}>
                    {isConversationMode ? 'Listening...' : 'Tap to stop'}
                  </Text>
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
                      console.log('[Conversation] Phone button - ending conversation mode');
                      if (isSpeaking) {
                        await stopSpeaking();
                      }
                      await cleanupConversationMode();
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
                  onPress={async () => {
                    setIsOpen(false);
                    if (isConversationMode) {
                      console.log('[Conversation] Close button - ending conversation mode');
                      if (isSpeaking) await stopSpeaking();
                      await cleanupConversationMode();
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
              {isLoadingHistory ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text style={styles.emptyStateTitle}>Loading chat history...</Text>
                </View>
              ) : messages.length === 0 ? (
                <View style={styles.emptyState}>
                  <Bot size={56} color="#D1D5DB" strokeWidth={2} />
                  <Text style={styles.emptyStateTitle}>Ask me anything!</Text>
                  <Text style={styles.emptyStateText}>
                    I can analyze construction images, do blueprint takeoffs, and answer your questions. Try me!
                  </Text>
                </View>
              ) : null}

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
                  {/* Show attached images for user messages */}
                  {message.role === 'user' && message.files && message.files.length > 0 && (
                    <View style={styles.userMessageContainer}>
                      <View style={styles.attachedImagesContainer}>
                        {message.files.filter((f: any) => f.mimeType?.startsWith('image/') || f.uri?.startsWith('data:image')).map((file: any, idx: number) => (
                          <Image
                            key={`${message.id}-img-${idx}`}
                            source={{ uri: file.uri }}
                            style={styles.attachedImage}
                            resizeMode="cover"
                          />
                        ))}
                      </View>
                    </View>
                  )}
                  {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return (
                        <View key={`${message.id}-${i}`} style={message.role === 'user' ? styles.userMessageContainer : styles.assistantMessageContainer}>
                          <View style={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                            <Text style={message.role === 'user' ? styles.userMessageText : styles.assistantMessageText} selectable>
                              {part.text}
                              {/* Render estimate link if present */}
                              {message.estimateLink && (
                                <>
                                  {' '}
                                  <Text
                                    style={{ color: '#2563EB', textDecorationLine: 'underline', fontWeight: '600' }}
                                    onPress={() => {
                                      router.push(`/project/new/estimate?clientId=${message.estimateLink.clientId}&estimateId=${message.estimateLink.estimateId}`);
                                    }}
                                  >
                                    {message.estimateLink.label || 'here'}
                                  </Text>
                                </>
                              )}
                            </Text>
                            {message.takeoffLink && (
                              <TouchableOpacity
                                onPress={() => {
                                  router.push(`/project/new/takeoff?clientId=${message.takeoffLink.clientId}&estimateId=${message.takeoffLink.estimateId}`);
                                }}
                                style={{
                                  backgroundColor: '#10B981',
                                  paddingVertical: 10,
                                  paddingHorizontal: 16,
                                  borderRadius: 8,
                                  marginTop: 12,
                                  alignSelf: 'flex-start',
                                }}
                              >
                                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                                  {message.takeoffLink.label}
                                </Text>
                              </TouchableOpacity>
                            )}
                            {message.role === 'assistant' && !message.estimateLink && !message.takeoffLink && (
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
                              <Text style={styles.toolText}>Analyzing {part.toolName}...</Text>
                            </View>
                          </View>
                        );
                      }
                      if (part.state === 'output-available') {
                        return (
                          <View key={`${message.id}-${i}`} style={styles.assistantMessageContainer}>
                            <View style={[styles.assistantMessage, styles.toolMessage]}>
                              <Text style={styles.toolText}>✓ {part.toolName} completed</Text>
                            </View>
                          </View>
                        );
                      }
                    }
                    return null;
                  })}
                </View>
              ))}

              {/* Loading indicator while AI is responding */}
              {isLoading && (
                <View style={styles.assistantMessageContainer}>
                  <View style={styles.assistantMessage}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={[styles.assistantMessageText, { marginLeft: 8, fontStyle: 'italic' }]}>
                      AI is thinking...
                    </Text>
                  </View>
                </View>
              )}

              {/* Loading indicator while AI is performing an action */}
              {isProcessingAction && (
                <View style={styles.assistantMessageContainer}>
                  <View style={[styles.assistantMessage, { backgroundColor: '#ECFDF5' }]}>
                    <ActivityIndicator size="small" color="#10B981" />
                    <Text style={[styles.assistantMessageText, { marginLeft: 8, fontStyle: 'italic', color: '#059669' }]}>
                      Performing action...
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.inputWrapper}>
              {isConversationMode && (
                <View style={styles.conversationBanner}>
                  <Phone size={16} color="#10A37F" />
                  <Text style={styles.conversationText}>Conversation Mode Active</Text>
                  <TouchableOpacity
                    onPress={async () => {
                      console.log('[Conversation] End button - ending conversation mode');
                      if (isSpeaking) await stopSpeaking();
                      await cleanupConversationMode();
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
                      <Text style={styles.recordingText}>
                        {isConversationMode ? 'Speak now - I\'ll stop when you\'re done' : 'Recording...'}
                      </Text>
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
                      <Text style={styles.recordingButtonText}>
                        {isConversationMode ? 'Listening...' : 'Tap to stop'}
                      </Text>
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
  attachedImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
    justifyContent: 'flex-end',
  },
  attachedImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
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
