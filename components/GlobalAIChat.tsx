import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { Bot, X, Send, Paperclip, File as FileIcon } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useState, useRef, useEffect } from 'react';
import { createRorkTool, useRorkAgent } from '@rork/toolkit-sdk';
import { z } from 'zod';
import { useApp } from '@/contexts/AppContext';
import { masterPriceList, priceListCategories } from '@/mocks/priceList';
import { usePathname } from 'expo-router';

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
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const pathname = usePathname();
  const { projects, clients, expenses, photos, tasks, clockEntries, estimates, addEstimate } = useApp();

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
    },
  });

  const isLoading = status === 'streaming';

  const handleSendWithContext = (userInput: string) => {
    const contextMessage = `Context: ${getContextForCurrentPage()}\n\nUser question: ${userInput}`;
    sendMessage(contextMessage);
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/*', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || 'application/octet-stream',
          size: file.size || 0,
          type: 'file',
        };
        setAttachedFiles([...attachedFiles, newFile]);
      }
    } catch (error) {
      console.error('Error picking file:', error);
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
          encoding: FileSystem.EncodingType.Base64,
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
        const filesForMessage: {type: 'file'; mimeType: string; uri: string}[] = [];
        
        for (const file of attachedFiles) {
          if (file.mimeType.startsWith('image/')) {
            const base64 = await convertFileToBase64(file);
            filesForMessage.push({
              type: 'file',
              mimeType: file.mimeType,
              uri: `data:${file.mimeType};base64,${base64}`,
            });
          } else {
            filesForMessage.push({
              type: 'file',
              mimeType: file.mimeType,
              uri: file.uri,
            });
          }
        }
        
        const contextMessage = `Context: ${getContextForCurrentPage()}`;
        const userMessage = input.trim() || 'Please analyze the attached file(s)';
        const fullMessage = `${contextMessage}\n\nUser question: ${userMessage}\n\nAttached ${filesForMessage.length} file(s) for analysis.`;
        
        sendMessage({ text: fullMessage, files: filesForMessage as any });
        setInput('');
        setAttachedFiles([]);
      } catch (error) {
        console.error('Error sending message with files:', error);
      }
    } else {
      handleSendWithContext(input);
      setInput('');
    }
  };

  return (
    <>
      <TouchableOpacity
        style={inline ? styles.inlineButton : styles.floatingButton}
        onPress={() => setIsOpen(true)}
      >
        {inline ? (
          <>
            <Bot size={20} color="#8B5CF6" />
            <Text style={styles.inlineButtonText}>Ask AI</Text>
          </>
        ) : (
          <Bot size={28} color="#FFFFFF" strokeWidth={2.5} />
        )}
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
                    I can help you with {pathname.includes('dashboard') ? 'projects, budgets, and creating estimates from plans/photos' : pathname.includes('crm') ? 'clients, leads, and call notes' : pathname.includes('schedule') ? 'tasks and schedule' : pathname.includes('expenses') ? 'expenses' : pathname.includes('estimate') ? 'estimates with accurate pricing' : 'any questions'}. I can analyze documents, images, plans, and PDFs you attach!
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
                              <Text key={i} style={styles.assistantMessageText}>
                                {part.text}
                              </Text>
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
                  onPress={handlePickFile}
                  disabled={isLoading}
                >
                  <Paperclip size={22} color="#6B7280" />
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask me anything..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={[styles.sendButton, (isLoading || (!input.trim() && attachedFiles.length === 0)) && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
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
});