import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Linking, Alert, Platform, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Plus, Mail, MessageSquare, Send, X, CheckSquare, Square, Paperclip, FileText, Calculator, FileSignature, DollarSign, CheckCircle, CreditCard, ClipboardList, Sparkles, Phone, Settings, PhoneIncoming, PhoneOutgoing, Clock, Trash2, Calendar, ChevronDown, ChevronUp, TrendingUp, Users, FileCheck, DollarSign as DollarSignIcon, Camera } from 'lucide-react-native';
import { Project, Client, CallLog } from '@/types';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import { useRouter } from 'expo-router';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { useTwilioSMS, useTwilioCalls } from '@/components/TwilioIntegration';
import { trpc } from '@/lib/trpc';

// Phone validation helpers
const isValidUSPhone = (phone: string): boolean => {
  if (!phone || phone.trim() === '') return false; // Phone is required for clients
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // US phone numbers should have 10 digits (or 11 if starts with 1)
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
};

const formatUSPhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Remove leading 1 if present
  const normalized = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
  if (normalized.length !== 10) return phone; // Return original if not valid
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
};

type MessageType = 'email' | 'sms';
type MessageTemplate = {
  id: string;
  title: string;
  subject?: string;
  body: string;
};

const promotionTemplates: MessageTemplate[] = [
  {
    id: '1',
    title: 'Spring Special - 15% Off',
    subject: 'Spring Construction Special - Save 15%!',
    body: 'Hi {name}, Spring is the perfect time for your construction project! Get 15% off all remodeling projects booked this month. From kitchen renovations to full home remodels, Legacy Prime Construction has you covered. Call us today at (555) 123-4567!',
  },
  {
    id: '2',
    title: 'Referral Bonus Program',
    subject: 'Earn $500 for Every Referral!',
    body: 'Hi {name}, Love working with Legacy Prime? Refer a friend and earn $500 when they complete a project with us! There\'s no limit - refer as many clients as you\'d like. Contact us to learn more.',
  },
  {
    id: '3',
    title: 'Maintenance Check Reminder',
    subject: 'Time for Your Seasonal Maintenance Check',
    body: 'Hi {name}, It\'s been a while since we completed your project. We recommend scheduling a seasonal maintenance check to ensure everything is in perfect condition. Book your free inspection today!',
  },
  {
    id: '4',
    title: 'Summer Deck & Patio Special',
    subject: 'Summer Ready: Deck & Patio Specials',
    body: 'Hi {name}, Get your outdoor space ready for summer! Special pricing on deck construction, patio pavers, and outdoor kitchens. Limited time offer - 20% off materials. Call (555) 123-4567 to schedule a free estimate.',
  },
  {
    id: '5',
    title: 'Free Estimate Reminder',
    subject: 'Your Free Construction Estimate Awaits',
    body: 'Hi {name}, Thank you for your interest in Legacy Prime Construction. We\'d love to provide you with a free, no-obligation estimate for your project. Our expert team is ready to bring your vision to life. Schedule today!',
  },
  {
    id: '6',
    title: 'Winter Weatherproofing Special',
    subject: 'Protect Your Home This Winter',
    body: 'Hi {name}, Winter is coming! Protect your investment with our weatherproofing services. Special rates on insulation, window replacement, and roof repairs. Don\'t wait until it\'s too late - call us at (555) 123-4567.',
  },
];

export default function CRMScreen() {
  const { clients, addClient, addProject, updateClient, estimates, updateEstimate, callLogs, addCallLog, deleteCallLog, setCallLogs, company, refreshClients, refreshEstimates, projects, customPriceListItems } = useApp();
  const router = useRouter();
  const { sendSingleSMS, sendBulkSMSMessages, isLoading: isSendingSMS } = useTwilioSMS();
  const { initiateCall, isLoadingCall } = useTwilioCalls();
  const sendInspectionLinkMutation = trpc.crm.sendInspectionLink.useMutation();
  const createInspectionVideoLinkMutation = trpc.crm.createInspectionVideoLink.useMutation();
  const getInspectionVideosQuery = trpc.crm.getInspectionVideos.useQuery(
    { companyId: company?.id || '' },
    { enabled: !!company?.id }
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Load estimates from database when component mounts
  useEffect(() => {
    console.log('[CRM] Loading estimates from database...');
    refreshEstimates();
  }, [refreshEstimates]);

  // Fetch call logs from database
  const fetchCallLogs = async () => {
    if (!company?.id) return;

    setIsLoadingCallLogs(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/get-call-logs?companyId=${company.id}`);
      const data = await response.json();

      if (data.success && data.callLogs) {
        // Merge with local call logs, avoiding duplicates
        const dbLogIds = new Set(data.callLogs.map((l: any) => l.id));
        const localOnly = callLogs.filter(l => !l.id.startsWith('call-') || !dbLogIds.has(l.id));
        const mergedLogs = [...data.callLogs, ...localOnly.filter(l => l.id.startsWith('call-'))];
        setCallLogs(mergedLogs);
        console.log('[CRM] Loaded', data.callLogs.length, 'call logs from database');
      }
    } catch (error) {
      console.error('[CRM] Failed to fetch call logs:', error);
    } finally {
      setIsLoadingCallLogs(false);
    }
  };

  // Handle opening call logs modal
  const handleOpenCallLogs = () => {
    setShowCallLogsModal(true);
    fetchCallLogs();
  };

  // Handle adding a new client via direct API
  const handleAddClient = async (fromModal: boolean = false) => {
    if (!newClientName || !newClientEmail || !newClientPhone || !newClientSource) {
      Alert.alert('Error', 'Please fill in all required fields (Name, Email, Phone, Source)');
      return;
    }

    // Validate US phone number
    if (!isValidUSPhone(newClientPhone)) {
      Alert.alert('Error', 'Please enter a valid US phone number (10 digits)');
      return;
    }

    const validSources = ['Google', 'Referral', 'Ad', 'Phone Call'];
    if (!validSources.includes(newClientSource)) {
      Alert.alert('Error', 'Source must be one of: Google, Referral, Ad, Phone Call');
      return;
    }

    if (!company?.id) {
      Alert.alert('Error', 'No company found. Please log in again.');
      return;
    }

    setIsAddingClient(true);

    try {
      // Format phone number before saving
      const formattedPhone = formatUSPhone(newClientPhone);

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/add-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          name: newClientName,
          address: newClientAddress || undefined,
          email: newClientEmail,
          phone: formattedPhone,
          source: newClientSource,
          status: 'lead',
          lastContactDate: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add client');
      }

      console.log('[CRM] Client added successfully:', data.client);

      // Refresh clients from database to get the new client with proper ID
      await refreshClients();

      // Clear form
      setNewClientName('');
      setNewClientAddress('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientSource('');

      if (fromModal) {
        setShowAddClientModal(false);
      } else {
        setShowAddForm(false);
      }

      Alert.alert('Success', `${data.client.name} has been added to your client list!`);
    } catch (error: any) {
      console.error('[CRM] Error adding client:', error);
      Alert.alert('Error', error.message || 'Failed to add client');
    } finally {
      setIsAddingClient(false);
    }
  };

  // Open Add Client modal and reset form
  const openAddClientModal = () => {
    setNewClientName('');
    setNewClientAddress('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientSource('');
    setShowAddClientModal(true);
  };

  const [showAddForm, setShowAddForm] = useState<boolean>(true);
  const [showAddClientModal, setShowAddClientModal] = useState<boolean>(false);
  const [isAddingClient, setIsAddingClient] = useState<boolean>(false);
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientAddress, setNewClientAddress] = useState<string>('');
  const [newClientEmail, setNewClientEmail] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [newClientSource, setNewClientSource] = useState<string>('');
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const [messageType, setMessageType] = useState<MessageType>('email');
  const [messageSubject, setMessageSubject] = useState<string>('');
  const [messageBody, setMessageBody] = useState<string>('');
  const [singleRecipient, setSingleRecipient] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [showEstimateModal, setShowEstimateModal] = useState<boolean>(false);
  const [selectedClientForEstimate, setSelectedClientForEstimate] = useState<string | null>(null);
  const [showEstimateTypeModal, setShowEstimateTypeModal] = useState<boolean>(false);
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [aiInput, setAiInput] = useState<string>('');
  const [showCallAssistantModal, setShowCallAssistantModal] = useState<boolean>(false);
  const [showCallLogsModal, setShowCallLogsModal] = useState<boolean>(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [isLoadingCallLogs, setIsLoadingCallLogs] = useState<boolean>(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState<boolean>(false);
  const [selectedClientForFollowUp, setSelectedClientForFollowUp] = useState<string | null>(null);
  const [selectedFollowUpDate, setSelectedFollowUpDate] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [showConvertToProjectModal, setShowConvertToProjectModal] = useState<boolean>(false);
  const [selectedClientForConversion, setSelectedClientForConversion] = useState<string | null>(null);
  const [showMetricsWidget, setShowMetricsWidget] = useState<boolean>(false);
  const [showPaymentRequestModal, setShowPaymentRequestModal] = useState<boolean>(false);
  const [selectedClientForPayment, setSelectedClientForPayment] = useState<string | null>(null);
  const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState<boolean>(false);
  const [callAssistantConfig, setCallAssistantConfig] = useState({
    enabled: true,
    businessName: 'Legacy Prime Construction',
    greeting: 'Thank you for calling Legacy Prime Construction. How can I help you today?',
    qualificationQuestions: [
      'What type of construction project are you interested in?',
      'What is your estimated budget for this project?',
      'When are you looking to start the project?',
      'Is this for a residential or commercial property?',
    ],
    autoAddToCRM: true,
    autoSchedule: true,
    seriousLeadCriteria: 'Budget over $10,000 and ready to start within 3 months',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshClients();
    setRefreshing(false);
  };

  const leadsByGoogle = clients.filter(c => c.source === 'Google' && c.status === 'Lead').length;
  const leadsByReferral = clients.filter(c => c.source === 'Referral' && c.status === 'Lead').length;
  const leadsByAd = clients.filter(c => c.source === 'Ad' && c.status === 'Lead').length;

  const totalLeads = clients.filter(c => c.status === 'Lead').length;
  const totalProjects = clients.filter(c => c.status === 'Project' || c.status === 'Completed').length;
  const conversionRate = totalLeads > 0 ? ((totalProjects / (totalLeads + totalProjects)) * 100).toFixed(1) : '0.0';
  
  const calculateAverageResponseTime = () => {
    const clientsWithFollowUps = clients.filter(c => c.lastContactDate);
    if (clientsWithFollowUps.length === 0) return '0';
    
    let totalDays = 0;
    clientsWithFollowUps.forEach(client => {
      const lastContact = new Date(client.lastContactDate || client.lastContacted);
      const now = new Date();
      const daysSince = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
      totalDays += daysSince;
    });
    
    return (totalDays / clientsWithFollowUps.length).toFixed(1);
  };
  
  const averageResponseTime = calculateAverageResponseTime();
  const totalEstimatesSent = estimates.filter(e => e.status === 'sent' || e.status === 'approved').length;
  
  const revenueBySource = {
    Google: estimates
      .filter(e => e.status === 'approved')
      .filter(e => {
        const client = clients.find(c => e.projectId.includes(c.name) || e.name.includes(c.name));
        return client?.source === 'Google';
      })
      .reduce((sum, e) => sum + e.total, 0),
    Referral: estimates
      .filter(e => e.status === 'approved')
      .filter(e => {
        const client = clients.find(c => e.projectId.includes(c.name) || e.name.includes(c.name));
        return client?.source === 'Referral';
      })
      .reduce((sum, e) => sum + e.total, 0),
    Ad: estimates
      .filter(e => e.status === 'approved')
      .filter(e => {
        const client = clients.find(c => e.projectId.includes(c.name) || e.name.includes(c.name));
        return client?.source === 'Ad';
      })
      .reduce((sum, e) => sum + e.total, 0),
  };

  const { messages, sendMessage: sendAIMessage } = useRorkAgent({
    tools: {
      getCRMStats: createRorkTool({
        description: 'Get overall CRM statistics including lead counts by source, client status breakdown, and total counts',
        zodSchema: z.object({}),
        execute() {
          const totalClients = clients.length;
          const totalLeads = clients.filter(c => c.status === 'Lead').length;
          const totalProjects = clients.filter(c => c.status === 'Project').length;
          const totalCompleted = clients.filter(c => c.status === 'Completed').length;
          
          return JSON.stringify({
            totalClients,
            totalLeads,
            totalProjects,
            totalCompleted,
            leadsByGoogle,
            leadsByReferral,
            leadsByAd,
            leadsByPhoneCall: clients.filter(c => c.source === 'Phone Call' && c.status === 'Lead').length,
          });
        },
      }),
      getClientDetails: createRorkTool({
        description: 'Get detailed information about a specific client by name or email',
        zodSchema: z.object({
          identifier: z.string().describe('Client name or email to search for'),
        }),
        execute(input) {
          const client = clients.find(
            c => c.name.toLowerCase().includes(input.identifier.toLowerCase()) ||
                 c.email.toLowerCase().includes(input.identifier.toLowerCase())
          );
          
          if (!client) {
            return JSON.stringify({ error: `No client found matching "${input.identifier}"` });
          }
          
          const clientEstimates = estimates; // Show all estimates
          
          return JSON.stringify({
            ...client,
            estimatesCount: clientEstimates.length,
            estimates: clientEstimates.map(e => ({
              name: e.name,
              total: e.total,
              status: e.status,
              createdDate: e.createdDate,
            })),
          });
        },
      }),
      searchClients: createRorkTool({
        description: 'Search and filter clients by status, source, or other criteria',
        zodSchema: z.object({
          status: z.enum(['Lead', 'Project', 'Completed', 'All']).optional().describe('Filter by client status'),
          source: z.enum(['Google', 'Referral', 'Ad', 'Phone Call', 'All']).optional().describe('Filter by lead source'),
        }),
        execute(input) {
          let filtered = clients;
          
          if (input.status && input.status !== 'All') {
            filtered = filtered.filter(c => c.status === input.status);
          }
          
          if (input.source && input.source !== 'All') {
            filtered = filtered.filter(c => c.source === input.source);
          }
          
          return JSON.stringify({
            count: filtered.length,
            clients: filtered.map(c => ({
              name: c.name,
              email: c.email,
              phone: c.phone,
              status: c.status,
              source: c.source,
              lastContacted: c.lastContacted,
            })),
          });
        },
      }),
      getEstimatesStats: createRorkTool({
        description: 'Get statistics about estimates including counts by status and total values',
        zodSchema: z.object({}),
        execute() {
          const totalEstimates = estimates.length;
          const draftEstimates = estimates.filter(e => e.status === 'draft').length;
          const sentEstimates = estimates.filter(e => e.status === 'sent').length;
          const approvedEstimates = estimates.filter(e => e.status === 'approved').length;
          const rejectedEstimates = estimates.filter(e => e.status === 'rejected').length;
          const totalValue = estimates.reduce((sum, e) => sum + e.total, 0);
          const approvedValue = estimates.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.total, 0);
          
          return JSON.stringify({
            totalEstimates,
            draftEstimates,
            sentEstimates,
            approvedEstimates,
            rejectedEstimates,
            totalValue,
            approvedValue,
          });
        },
      }),
    },
  });

  const toggleClientSelection = (clientId: string) => {
    const newSelection = new Set(selectedClients);
    if (newSelection.has(clientId)) {
      newSelection.delete(clientId);
    } else {
      newSelection.add(clientId);
    }
    setSelectedClients(newSelection);
  };

  const selectAllClients = () => {
    // Only select leads (visible clients), not converted projects
    const visibleLeads = clients.filter(c => c.status === 'Lead');
    if (selectedClients.size === visibleLeads.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(visibleLeads.map(c => c.id)));
    }
  };

  const openMessageModal = (type: MessageType, clientId?: string) => {
    setMessageType(type);
    setSingleRecipient(clientId || null);
    setMessageSubject('');
    setMessageBody('');
    setAttachments([]);
    setShowMessageModal(true);
  };

  const applyTemplate = (template: MessageTemplate) => {
    if (template.subject) setMessageSubject(template.subject);
    setMessageBody(template.body);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newAttachments = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        }));
        setAttachments([...attachments, ...newAttachments]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    const recipients = singleRecipient 
      ? [clients.find(c => c.id === singleRecipient)!]
      : clients.filter(c => selectedClients.has(c.id));

    if (recipients.length === 0) {
      Alert.alert('No Recipients', 'Please select at least one client.');
      return;
    }

    if (!messageBody.trim()) {
      Alert.alert('Error', 'Please enter a message.');
      return;
    }

    if (messageType === 'email') {
      const attachmentNote = attachments.length > 0 
        ? `\n\n--- Attachments (${attachments.length}) ---\n${attachments.map(a => a.name).join('\n')}\n\nNote: Please attach these files manually to your email.`
        : '';

      recipients.forEach(client => {
        const personalizedBody = messageBody.replace('{name}', client.name.split(' ')[0]) + attachmentNote;
        const emailUrl = `mailto:${client.email}?subject=${encodeURIComponent(messageSubject)}&body=${encodeURIComponent(personalizedBody)}`;
        
        if (Platform.OS === 'web') {
          window.open(emailUrl, '_blank');
        } else {
          Linking.openURL(emailUrl).catch(() => {
            Alert.alert('Error', 'Unable to open email client');
          });
        }
      });
      
      const attachmentWarning = attachments.length > 0 
        ? ' Remember to manually attach your files to the email.' 
        : '';
      
      Alert.alert(
        'Success', 
        `Email${recipients.length > 1 ? 's' : ''} prepared for ${recipients.length} client${recipients.length > 1 ? 's' : ''}. Your email client should open.${attachmentWarning}`,
        [{ text: 'OK', onPress: () => {
          setShowMessageModal(false);
          setSelectedClients(new Set());
        }}]
      );
    } else {
      console.log('[CRM] Sending SMS via Twilio to', recipients.length, 'recipients');
      
      if (recipients.length === 1) {
        const client = recipients[0];
        const success = await sendSingleSMS(
          client.phone,
          messageBody,
          client.name
        );
        
        if (success) {
          setShowMessageModal(false);
          setSelectedClients(new Set());
          setMessageBody('');
          setMessageSubject('');
        }
      } else {
        const recipientList = recipients.map(client => ({
          phone: client.phone,
          name: client.name,
        }));
        
        const result = await sendBulkSMSMessages(recipientList, messageBody);
        
        if (result && result.success) {
          setShowMessageModal(false);
          setSelectedClients(new Set());
          setMessageBody('');
          setMessageSubject('');
        }
      }
    }
  };

  const createEstimateForClient = (clientId: string) => {
    setSelectedClientForEstimate(clientId);
    setShowEstimateTypeModal(true);
  };

  const createRegularEstimate = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const newProject: Project = {
      id: `project-${Date.now()}`,
      name: `${client.name} - Estimate`,
      budget: 0,
      expenses: 0,
      progress: 0,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
      hoursWorked: 0,
      startDate: new Date().toISOString(),
    };

    await addProject(newProject);
    setShowEstimateTypeModal(false);

    // Small delay to ensure state propagation before navigation
    setTimeout(() => {
      router.push(`/project/${newProject.id}/estimate`);
    }, 100);
  };

  const createTakeoffEstimate = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const newProject: Project = {
      id: `project-${Date.now()}`,
      name: `${client.name} - Takeoff`,
      budget: 0,
      expenses: 0,
      progress: 0,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
      hoursWorked: 0,
      startDate: new Date().toISOString(),
    };

    await addProject(newProject);
    setShowEstimateTypeModal(false);

    // Small delay to ensure state propagation before navigation
    setTimeout(() => {
      router.push(`/project/${newProject.id}/takeoff`);
    }, 100);
  };



  const openEstimateActions = (clientId: string) => {
    setSelectedClientForEstimate(clientId);
    setShowEstimateModal(true);
  };

  const sendEstimate = async (estimateId: string) => {
    const estimate = estimates.find(e => e.id === estimateId);
    if (!estimate) return;

    const client = clients.find(c => c.id === selectedClientForEstimate);
    if (!client) return;

    try {
      console.log('[CRM] Starting estimate send with PDF generation...');

      // 1. Fetch complete estimate data with items from database
      console.log('[CRM] Fetching complete estimate data...');
      const getEstimateResponse = await fetch(`/api/get-estimate?estimateId=${estimateId}`);
      const getEstimateResult = await getEstimateResponse.json();

      if (!getEstimateResult.success || !getEstimateResult.estimate) {
        throw new Error(getEstimateResult.error || 'Failed to load estimate data');
      }

      const fullEstimate = getEstimateResult.estimate;
      console.log('[CRM] Loaded estimate with', fullEstimate.items?.length || 0, 'items');

      // 2. Update estimate status to 'sent' in database
      console.log('[CRM] Updating estimate status to sent...');
      const updateResponse = await fetch('/api/update-estimate-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateId: estimateId,
          status: 'sent',
        }),
      });

      const updateResult = await updateResponse.json();
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update estimate status');
      }

      console.log('[CRM] Estimate status updated successfully');

      // Update local state
      updateEstimate(estimateId, { status: 'sent' });

      // 3. Get project info for the estimate
      const project = projects.find(p => p.id === fullEstimate.projectId);

      // 4. Calculate line items with details
      const lineItems = (fullEstimate.items || []).map((item: any) => {
        if (item.isSeparator) {
          return {
            isSeparator: true,
            label: item.separatorLabel || '---',
          };
        }

        // Get price list item details if available
        const priceListItem = item.priceListItemId ?
          customPriceListItems.find(p => p.id === item.priceListItemId) : null;

        const name = item.customName || priceListItem?.name || 'Custom Item';
        const unit = item.customUnit || priceListItem?.unit || 'unit';
        const category = item.customCategory || priceListItem?.category || 'Miscellaneous';

        return {
          isSeparator: false,
          category,
          name,
          quantity: item.quantity || 0,
          unit,
          unitPrice: item.customPrice || item.unitPrice || 0,
          total: item.total || 0,
          notes: item.notes || '',
        };
      });

      // Group items by category
      const groupedItems: { [key: string]: any[] } = {};
      lineItems.forEach(item => {
        if (item.isSeparator) {
          const separatorKey = `__SEPARATOR__${item.label}`;
          if (!groupedItems[separatorKey]) {
            groupedItems[separatorKey] = [];
          }
        } else {
          if (!groupedItems[item.category]) {
            groupedItems[item.category] = [];
          }
          groupedItems[item.category].push(item);
        }
      });

      // 5. Generate HTML for PDF
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estimate - ${fullEstimate.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #1f2937;
      background: white;
      padding: 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }

    .company-info h1 {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .company-info p {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.5;
    }

    .estimate-info {
      text-align: right;
    }

    .estimate-info h2 {
      font-size: 20px;
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 8px;
    }

    .estimate-info p {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .project-details {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
    }

    .project-details h3 {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 10px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 11px;
    }

    .detail-label {
      color: #6b7280;
      font-weight: 500;
    }

    .detail-value {
      color: #1f2937;
      font-weight: 600;
    }

    .line-items {
      margin-bottom: 25px;
    }

    .category-header {
      background: #2563eb;
      color: white;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 15px;
      margin-bottom: 8px;
      border-radius: 4px;
    }

    .separator-row {
      background: #f3f4f6;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      margin: 10px 0;
      border-left: 3px solid #9ca3af;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }

    thead {
      background: #f3f4f6;
    }

    th {
      padding: 8px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    th:last-child,
    td:last-child {
      text-align: right;
    }

    tbody tr {
      border-bottom: 1px solid #e5e7eb;
    }

    tbody tr:last-child {
      border-bottom: none;
    }

    td {
      padding: 8px;
      font-size: 11px;
      color: #1f2937;
    }

    .item-name {
      font-weight: 500;
    }

    .item-notes {
      font-size: 10px;
      color: #6b7280;
      font-style: italic;
      margin-top: 2px;
    }

    .totals-section {
      margin-top: 25px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
    }

    .totals-table {
      margin-left: auto;
      width: 300px;
    }

    .totals-table tr {
      border-bottom: none;
    }

    .totals-table td {
      padding: 6px 8px;
      font-size: 12px;
    }

    .totals-table .label {
      text-align: right;
      color: #6b7280;
      font-weight: 500;
    }

    .totals-table .value {
      text-align: right;
      color: #1f2937;
      font-weight: 600;
      width: 120px;
    }

    .total-row {
      border-top: 2px solid #e5e7eb;
      font-size: 14px !important;
    }

    .total-row .label {
      color: #1f2937;
      font-weight: 700;
    }

    .total-row .value {
      color: #2563eb;
      font-weight: 700;
      font-size: 16px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #6b7280;
      text-align: center;
    }

    @media print {
      body {
        padding: 0;
      }

      .container {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        <h1>${company?.name || 'Legacy Prime Construction'}</h1>
        <p>${company?.email || 'info@legacyprime.com'}</p>
        <p>${company?.phone || '(555) 123-4567'}</p>
      </div>
      <div class="estimate-info">
        <h2>ESTIMATE</h2>
        <p><strong>Estimate #:</strong> ${fullEstimate.id.slice(0, 8).toUpperCase()}</p>
        <p><strong>Date:</strong> ${new Date(fullEstimate.createdDate).toLocaleDateString()}</p>
        <p><strong>Status:</strong> Sent</p>
      </div>
    </div>

    <div class="project-details">
      <h3>Project Information</h3>
      <div class="detail-row">
        <span class="detail-label">Client:</span>
        <span class="detail-value">${client.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Project:</span>
        <span class="detail-value">${project?.name || 'Unnamed Project'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Estimate Name:</span>
        <span class="detail-value">${fullEstimate.name}</span>
      </div>
    </div>

    <div class="line-items">
      ${Object.entries(groupedItems).map(([category, items]) => {
        if (category.startsWith('__SEPARATOR__')) {
          const label = category.replace('__SEPARATOR__', '');
          return `<div class="separator-row">${label}</div>`;
        }

        return `
          <div class="category-header">${category}</div>
          <table>
            <thead>
              <tr>
                <th style="width: 45%;">Item</th>
                <th style="width: 15%;">Quantity</th>
                <th style="width: 15%;">Unit Price</th>
                <th style="width: 25%;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>
                    <div class="item-name">${item.name}</div>
                    ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                  </td>
                  <td>${item.quantity} ${item.unit}</td>
                  <td>$${item.unitPrice.toFixed(2)}</td>
                  <td>$${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }).join('')}
    </div>

    <div class="totals-section">
      <table class="totals-table">
        <tbody>
          <tr>
            <td class="label">Subtotal:</td>
            <td class="value">$${fullEstimate.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">Tax (${((fullEstimate.taxRate || 0) * 100).toFixed(1)}%):</td>
            <td class="value">$${fullEstimate.taxAmount.toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td class="label">TOTAL:</td>
            <td class="value">$${fullEstimate.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>This estimate is valid for 30 days from the date of issue.</p>
      <p>Thank you for considering ${company?.name || 'Legacy Prime Construction'} for your project!</p>
      <p style="margin-top: 10px;">Questions? Contact us at ${company?.email || 'info@legacyprime.com'} or ${company?.phone || '(555) 123-4567'}</p>
    </div>
  </div>
</body>
</html>
      `;

      // 6. Platform-specific PDF handling
      const emailSubject = `Estimate: ${fullEstimate.name}`;
      const emailBody = `Hi ${client.name.split(' ')[0]},\n\nPlease find attached your estimate for ${fullEstimate.name}.\n\nProject: ${project?.name || 'Your Project'}\nEstimate Total: $${fullEstimate.total.toFixed(2)}\n\nPlease review and let us know if you have any questions.\n\nBest regards,\n${company?.name || 'Legacy Prime Construction'}`;

      if (Platform.OS === 'web') {
        console.log('[CRM] Web platform - opening print dialog and email client...');

        // Open print dialog in new window
        if (typeof window !== 'undefined') {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();

            // Wait for content to load, then trigger print
            printWindow.onload = () => {
              printWindow.focus();
              printWindow.print();
            };

            console.log('[CRM] Print dialog opened');
          }

          // Open email client after brief delay
          setTimeout(() => {
            console.log('[CRM] Opening email client...');
            const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
            window.location.href = mailtoUrl;
          }, 1000);

          // Show success message
          setTimeout(() => {
            Alert.alert(
              'Estimate Sent!',
              'Print dialog and email client opened.\n\nSave the PDF and attach it to the email.',
              [{ text: 'OK' }]
            );
          }, 1500);
        }
      } else {
        // Mobile: Generate PDF file and open email composer with attachment
        console.log('[CRM] Mobile platform - generating PDF file...');

        const { uri } = await Print.printToFileAsync({ html });
        console.log('[CRM] PDF generated at:', uri);

        // Open email composer with PDF attachment
        const canSendMail = await MailComposer.isAvailableAsync();
        if (canSendMail) {
          await MailComposer.composeAsync({
            recipients: [client.email],
            subject: emailSubject,
            body: emailBody,
            attachments: [uri],
          });
          console.log('[CRM] Email composer opened with PDF attachment');
        } else {
          Alert.alert('Error', 'Email is not available on this device');
        }

        Alert.alert('Success', 'Estimate PDF generated and email prepared!');
      }

      console.log('[CRM] Estimate send process completed successfully');

    } catch (error: any) {
      console.error('[CRM] Error sending estimate:', error);
      Alert.alert('Error', error.message || 'Failed to send estimate. Please try again.');
    }
  };

  const requestSignature = (estimateId: string) => {
    const estimate = estimates.find(e => e.id === estimateId);
    if (!estimate) return;

    const client = clients.find(c => c.id === selectedClientForEstimate);
    if (!client) return;

    const emailBody = `Hi ${client.name.split(' ')[0]},\n\nWe're ready to move forward with your project!\n\nEstimate: ${estimate.name}\nTotal: ${estimate.total.toFixed(2)}\n\nPlease review and sign the estimate to approve the project. Once approved, we'll convert this to an active project and begin work.\n\nClick here to review and sign: [Digital Signature Link]\n\nBest regards,\nLegacy Prime Construction`;
    const emailUrl = `mailto:${client.email}?subject=${encodeURIComponent(`Signature Required: ${estimate.name}`)}&body=${encodeURIComponent(emailBody)}`;
    
    if (Platform.OS === 'web') {
      window.open(emailUrl, '_blank');
    } else {
      Linking.openURL(emailUrl).catch(() => {
        Alert.alert('Error', 'Unable to open email client');
      });
    }

    Alert.alert('Success', 'Signature request sent!');
    setShowEstimateModal(false);
  };

  const convertToProject = (estimateId: string) => {
    console.log('[CRM] convertToProject called with estimateId:', estimateId);
    console.log('[CRM] Total estimates:', estimates.length);
    console.log('[CRM] selectedClientForEstimate:', selectedClientForEstimate);

    const estimate = estimates.find(e => e.id === estimateId);
    if (!estimate) {
      console.error('[CRM] Estimate not found:', estimateId);
      if (Platform.OS === 'web') {
        alert('Estimate not found');
      } else {
        Alert.alert('Error', 'Estimate not found');
      }
      return;
    }
    console.log('[CRM] Found estimate:', estimate.name);

    const client = clients.find(c => c.id === selectedClientForEstimate);
    if (!client) {
      console.error('[CRM] Client not found. selectedClientForEstimate:', selectedClientForEstimate);
      if (Platform.OS === 'web') {
        alert('Client not found. Please try reopening the estimates modal.');
      } else {
        Alert.alert('Error', 'Client not found. Please try reopening the estimates modal.');
      }
      return;
    }
    console.log('[CRM] Found client:', client.name);

    if (!company?.id) {
      console.error('[CRM] Company not found');
      if (Platform.OS === 'web') {
        alert('Company not found. Please try again.');
      } else {
        Alert.alert('Error', 'Company not found. Please try again.');
      }
      return;
    }
    console.log('[CRM] Company found:', company.id);
    console.log('[CRM] About to show confirmation alert');

    // Use web-compatible confirmation
    const handleConvert = async () => {
      console.log('[CRM] handleConvert called - starting project creation');
            try {
              // Use direct API endpoint (bypassing tRPC due to timeout issue)
              const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
              console.log('[CRM] Making fetch request to:', `${baseUrl}/api/test-insert-project`);
              const response = await fetch(`${baseUrl}/api/test-insert-project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyId: company.id,
                  name: `${client.name} - ${estimate.name}`,
                  budget: estimate.total,
                  estimateId: estimateId,
                }),
              });

              console.log('[CRM] Fetch response status:', response.status);

              if (!response.ok) {
                throw new Error(`Failed to create project: ${response.status}`);
              }

              const data = await response.json();
              console.log('[CRM] Fetch response data:', data);

              if (data.success && data.project) {
                console.log('[CRM] Project created successfully:', data.project.id);
                // Add to local state
                const newProject: Project = {
                  id: data.project.id,
                  name: data.project.name,
                  budget: Number(data.project.budget) || 0,
                  expenses: Number(data.project.expenses) || 0,
                  progress: data.project.progress || 0,
                  status: data.project.status as 'active' | 'completed' | 'on-hold' | 'archived',
                  image: data.project.image || 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
                  hoursWorked: Number(data.project.hours_worked) || 0,
                  startDate: data.project.start_date,
                  endDate: data.project.end_date || undefined,
                  estimateId: data.project.estimate_id || undefined,
                };

                addProject(newProject);
                updateEstimate(estimateId, { status: 'approved' });

                // Success message
                if (Platform.OS === 'web') {
                  alert(`Project created for ${client.name} using estimate "${estimate.name}"!`);
                  setShowEstimateModal(false);
                } else {
                  Alert.alert(
                    'Success',
                    `Project created for ${client.name} using estimate "${estimate.name}"!`,
                    [{ text: 'OK', onPress: () => setShowEstimateModal(false) }]
                  );
                }
              } else {
                throw new Error('Failed to create project');
              }
            } catch (error) {
              console.error('[CRM] Error converting to project:', error);
              if (Platform.OS === 'web') {
                alert('Failed to create project. Please try again.');
              } else {
                Alert.alert('Error', 'Failed to create project. Please try again.');
              }
            }
    };

    // Show confirmation dialog
    console.log('[CRM] Platform:', Platform.OS);
    if (Platform.OS === 'web') {
      console.log('[CRM] Showing web confirm dialog');
      const confirmed = confirm('Has the estimate been approved and signed?\n\nClick OK to convert to project, or Cancel to go back.');
      console.log('[CRM] User confirmed:', confirmed);
      if (confirmed) {
        console.log('[CRM] Calling handleConvert');
        handleConvert();
      }
    } else {
      Alert.alert(
        'Convert to Project',
        'Has the estimate been approved and signed?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Convert', onPress: handleConvert },
        ]
      );
    }
  };

  const getFollowUpStatus = (client: Client): { status: 'followed-up' | 'pending' | 'overdue', color: string, label: string, emoji: string } => {
    const lastContactStr = client.lastContactDate || client.lastContacted;
    const lastContact = new Date(lastContactStr);
    const now = new Date();
    const daysSinceContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceContact <= 3) {
      return { status: 'followed-up', color: '#10B981', label: 'Followed Up', emoji: '🟢' };
    } else if (daysSinceContact <= 7) {
      return { status: 'pending', color: '#F59E0B', label: 'Pending', emoji: '🟡' };
    } else {
      return { status: 'overdue', color: '#EF4444', label: 'Overdue', emoji: '🔴' };
    }
  };

  const getAISuggestions = (client: Client): string[] => {
    const suggestions: string[] = [];
    const lastContactStr = client.lastContactDate || client.lastContacted;
    const lastContact = new Date(lastContactStr);
    const now = new Date();
    const daysSinceContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
    
    const clientEstimates = estimates; // Show all estimates
    const hasSentEstimate = clientEstimates.some(e => e.status === 'sent');
    const hasApprovedEstimate = clientEstimates.some(e => e.status === 'approved');

    if (daysSinceContact > 7) {
      suggestions.push('No response in 7+ days – consider marking cold');
    }

    if (daysSinceContact >= 3 && daysSinceContact <= 7) {
      suggestions.push('Send follow-up email');
    }

    if (hasSentEstimate && daysSinceContact > 3) {
      suggestions.push('Schedule estimate revision');
    }

    if (!clientEstimates.length && client.status === 'Lead') {
      suggestions.push('Create and send initial estimate');
    }

    if (client.source === 'Google' && daysSinceContact > 5) {
      suggestions.push('Google lead needs attention');
    }

    if (hasApprovedEstimate && client.status === 'Lead') {
      suggestions.push('Approved estimate ready – convert to project');
    }

    if (client.nextFollowUpDate) {
      const followUpDate = new Date(client.nextFollowUpDate + 'T00:00:00');
      const daysUntilFollowUp = Math.floor((followUpDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilFollowUp <= 0) {
        suggestions.push('Follow-up date reached – contact client now');
      } else if (daysUntilFollowUp === 1) {
        suggestions.push('Follow-up scheduled for tomorrow');
      }
    }

    if (suggestions.length === 0) {
      if (client.status === 'Lead') {
        suggestions.push('Lead is active – maintain regular contact');
      } else if (client.status === 'Project') {
        suggestions.push('Project is on track');
      }
    }

    return suggestions;
  };

  const openFollowUpDatePicker = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client?.nextFollowUpDate) {
      setSelectedFollowUpDate(client.nextFollowUpDate);
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedFollowUpDate(tomorrow.toISOString().split('T')[0]);
    }
    setSelectedClientForFollowUp(clientId);
    setShowFollowUpModal(true);
  };

  const saveFollowUpDate = () => {
    if (selectedClientForFollowUp && selectedFollowUpDate) {
      updateClient(selectedClientForFollowUp, { nextFollowUpDate: selectedFollowUpDate });
      Alert.alert('Success', 'Next follow-up date set!');
      setShowFollowUpModal(false);
      setSelectedClientForFollowUp(null);
      setSelectedFollowUpDate('');
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startDayOfWeek, year, month };
  };

  const selectDate = (day: number) => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedFollowUpDate(dateStr);
  };

  const changeMonth = (offset: number) => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + offset);
    setCalendarMonth(newMonth);
  };

  const convertLeadToProject = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    // Show modal to select which estimate to use
    setSelectedClientForConversion(clientId);
    setShowConvertToProjectModal(true);
  };

  const handleConvertWithEstimate = async (estimateId: string) => {
    const client = clients.find(c => c.id === selectedClientForConversion);
    if (!client) return;

    const estimate = estimates.find(e => e.id === estimateId);
    if (!estimate) return;

    if (!company?.id) {
      if (Platform.OS === 'web') {
        alert('Company not found. Please try again.');
      } else {
        Alert.alert('Error', 'Company not found. Please try again.');
      }
      return;
    }

    // Close modal immediately for better UX
    setShowConvertToProjectModal(false);
    setSelectedClientForConversion(null);

    try {
      // Save project directly to database using tRPC
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/trpc/projects.addProject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            companyId: company.id,
            name: `${client.name} - ${estimate.name}`,
            budget: estimate.total,
            expenses: 0,
            progress: 0,
            status: 'active',
            image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
            hoursWorked: 0,
            startDate: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status}`);
      }

      const data = await response.json();
      const result = data.result.data.json;

      if (result.success && result.project) {
        // Add to local state
        const newProject: Project = {
          id: result.project.id,
          name: result.project.name,
          budget: result.project.budget,
          expenses: result.project.expenses,
          progress: result.project.progress,
          status: result.project.status,
          image: result.project.image,
          hoursWorked: result.project.hoursWorked,
          startDate: result.project.startDate,
          endDate: result.project.endDate,
        };

        addProject(newProject);

        // Remove the estimate from the list (mark as converted)
        updateEstimate(estimateId, { status: 'approved' });

        // Show success message
        if (Platform.OS === 'web') {
          if (confirm(`Project created for ${client.name} using estimate "${estimate.name}"!\n\nWould you like to view your projects now?`)) {
            router.push('/dashboard');
          }
        } else {
          Alert.alert(
            'Success',
            `Project created for ${client.name} using estimate "${estimate.name}"!`,
            [
              { text: 'View Projects', onPress: () => router.push('/dashboard') },
              { text: 'OK' },
            ]
          );
        }
      } else {
        throw new Error('Failed to create project');
      }
    } catch (error) {
      console.error('[CRM] Error converting to project:', error);
      if (Platform.OS === 'web') {
        alert('Failed to create project. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to create project. Please try again.');
      }
    }
  };

  const requestPayment = (clientId?: string) => {
    // If called from client card, set the client and show modal
    if (clientId) {
      setSelectedClientForPayment(clientId);
      setShowPaymentRequestModal(true);
    } else if (selectedClientForEstimate) {
      // If called from estimate modal
      setSelectedClientForPayment(selectedClientForEstimate);
      setShowPaymentRequestModal(true);
    }
  };

  const createPaymentLinkAndEmail = async (estimateId: string, clientIdOverride?: string) => {
    const clientId = clientIdOverride || selectedClientForPayment;
    const client = clients.find(c => c.id === clientId);
    if (!client) {
      Alert.alert('Error', 'Client not found');
      return;
    }

    const estimate = estimates.find(e => e.id === estimateId);
    if (!estimate) {
      Alert.alert('Error', 'Estimate not found');
      return;
    }

    setIsCreatingPaymentLink(true);

    try {
      console.log('[Payment] Creating payment link for estimate:', estimate.name);

      // Call API to create Stripe payment link
      const response = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: estimate.total,
          description: `${estimate.name} - ${client.name}`,
          clientName: client.name,
          estimateId: estimate.id,
          companyName: company?.name || 'Legacy Prime Construction',
        }),
      });

      const result = await response.json();

      if (!result.success || !result.paymentLink) {
        throw new Error(result.error || 'Failed to create payment link');
      }

      console.log('[Payment] Payment link created:', result.paymentLink);

      // Prepare email
      const emailSubject = encodeURIComponent(`Payment Request: ${estimate.name}`);
      const emailBody = encodeURIComponent(
        `Hi ${client.name.split(' ')[0]},\n\n` +
        `Thank you for your business! We're ready to begin work on your project.\n\n` +
        `Project: ${estimate.name}\n` +
        `Total Amount: $${estimate.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
        `Please click the secure payment link below to complete your payment:\n\n` +
        `${result.paymentLink}\n\n` +
        `This link will take you to our secure Stripe payment portal. You can pay via credit card, debit card, or other available payment methods.\n\n` +
        `Once payment is received, we will begin work immediately.\n\n` +
        `If you have any questions, please don't hesitate to contact us.\n\n` +
        `Best regards,\n` +
        `${company?.name || 'Legacy Prime Construction'}\n` +
        `${company?.phone || '(555) 123-4567'}`
      );

      const mailtoUrl = `mailto:${client.email}?subject=${emailSubject}&body=${emailBody}`;

      // Open email client
      if (Platform.OS === 'web') {
        window.open(mailtoUrl, '_self');
      } else {
        await Linking.openURL(mailtoUrl);
      }

      setShowPaymentRequestModal(false);
      setIsCreatingPaymentLink(false);

      Alert.alert(
        'Success',
        'Payment link created! Your email client should open with the payment link ready to send.'
      );
    } catch (error: any) {
      console.error('[Payment] Error creating payment link:', error);
      setIsCreatingPaymentLink(false);
      Alert.alert('Error', error.message || 'Failed to create payment link. Please try again.');
    }
  };

  const sendInspectionLink = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !company) return;

    try {
      console.log('[CRM] Creating video inspection link for:', client.name);

      // Generate token client-side for immediate use
      const token = crypto.randomUUID();
      const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://legacy-prime-workflow-suite.vercel.app';
      const inspectionUrl = `${baseUrl}/inspection-video/${token}`;

      console.log('[CRM] Generated inspection link:', inspectionUrl);

      // Prepare email content
      const emailSubject = encodeURIComponent('Video Inspection Request - Legacy Prime Construction');
      const emailBody = encodeURIComponent(
        `Hi ${client.name.split(' ')[0]},\n\n` +
        `Thank you for your interest in Legacy Prime Construction!\n\n` +
        `We'd like to gather some information about your project. Please click the link below to record a short video walkthrough:\n\n` +
        `${inspectionUrl}\n\n` +
        `In the video, please show us:\n` +
        `• The project area/room(s)\n` +
        `• Any specific details or concerns\n` +
        `• Relevant measurements if possible\n\n` +
        `This will help us provide you with an accurate estimate quickly.\n\n` +
        `The link expires in 14 days.\n\n` +
        `Best regards,\n` +
        `Legacy Prime Construction Team`
      );

      // Open email client immediately (don't wait for database)
      const recipientEmail = client.email || '';
      const mailtoUrl = `mailto:${recipientEmail}?subject=${emailSubject}&body=${emailBody}`;

      await Linking.openURL(mailtoUrl);

      const message = client.email
        ? `Your email client has been opened with a pre-filled message for ${client.name}.\n\nPlease review and send the email with the inspection link.`
        : `Your email client has been opened with a pre-filled message.\n\nPlease add ${client.name}'s email address and send the inspection link.`;

      Alert.alert(
        'Email Client Opened',
        message,
        [{ text: 'OK' }]
      );

      // Update client's last contacted date
      updateClient(clientId, {
        lastContacted: new Date().toLocaleDateString(),
        lastContactDate: new Date().toISOString()
      });

      // Store in database asynchronously using direct API endpoint (bypasses tRPC timeout issue)
      console.log('[CRM] Storing inspection link in database...');
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

      fetch(`${apiUrl}/api/create-inspection-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          clientId: client.id,
          companyId: company.id,
          projectId: undefined,
          clientName: client.name,
          clientEmail: client.email || null,
          notes: `Video inspection request for ${client.name}`,
        }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to store inspection link');
          }
          console.log('[CRM] Inspection link stored in database successfully');
          console.log('[CRM] Database INSERT took:', data.insertDuration, 'ms');
          getInspectionVideosQuery.refetch();
        })
        .catch((err) => {
          console.warn('[CRM] Failed to store inspection link in database (non-critical):', err);
          // Don't show error to user - link already sent
        });
    } catch (error: any) {
      console.error('[CRM] Error creating inspection link:', error);
      
      let errorMessage = 'Failed to send inspection link. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.message && error.message.includes('HTML instead of JSON')) {
        errorMessage = 'Server configuration error: The API endpoint is not responding correctly. Please check that your backend is running and properly configured.';
      }
      
      if (error.message && error.message.includes('Twilio not configured')) {
        errorMessage = 'Twilio is not configured. Please set up your Twilio credentials in the environment variables:\n\n- EXPO_PUBLIC_TWILIO_ACCOUNT_SID\n- EXPO_PUBLIC_TWILIO_AUTH_TOKEN\n- EXPO_PUBLIC_TWILIO_PHONE_NUMBER';
      }
      
      Alert.alert(
        'Error Sending Inspection Link',
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Legacy Prime CRM</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.callLogsButton}
              onPress={handleOpenCallLogs}
            >
              <PhoneIncoming size={20} color="#FFFFFF" />
              <Text style={styles.callLogsButtonText}>Call Logs ({callLogs.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.callAssistantButton}
              onPress={() => setShowCallAssistantModal(true)}
            >
              <Phone size={20} color="#FFFFFF" />
              <Text style={styles.callAssistantButtonText}>Call Assistant</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={openAddClientModal}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Client</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sidebar}>
          <TouchableOpacity style={styles.sidebarItem}>
            <Text style={styles.sidebarText}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarItem}>
            <Text style={styles.sidebarText}>Clients</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarItem}>
            <Text style={styles.sidebarText}>Projects</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarItem}>
            <Text style={styles.sidebarText}>Settings</Text>
          </TouchableOpacity>

          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>Stats</Text>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Leads by Google</Text>
              <Text style={styles.statValue}>{leadsByGoogle}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Leads by Referral</Text>
              <Text style={styles.statValue}>{leadsByReferral}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Leads by Ad</Text>
              <Text style={styles.statValue}>{leadsByAd}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.clientListHeader}>
            <View style={styles.leftActions}>
              <Text style={styles.sectionTitle}>Client List</Text>
              {selectedClients.size > 0 && (
                <Text style={styles.selectedCount}>{selectedClients.size} selected</Text>
              )}
            </View>
            <View style={styles.rightActions}>
              <TouchableOpacity 
                style={styles.selectAllButton}
                onPress={selectAllClients}
              >
                {selectedClients.size === clients.length ? (
                  <CheckSquare size={20} color="#2563EB" />
                ) : (
                  <Square size={20} color="#6B7280" />
                )}
                <Text style={styles.selectAllText}>Select All</Text>
              </TouchableOpacity>
              {selectedClients.size > 0 && (
                <>
                  <TouchableOpacity 
                    style={styles.bulkActionButton}
                    onPress={() => openMessageModal('email')}
                  >
                    <Mail size={18} color="#FFFFFF" />
                    <Text style={styles.bulkActionText}>Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.bulkActionButton, styles.smsButton]}
                    onPress={() => openMessageModal('sms')}
                  >
                    <MessageSquare size={18} color="#FFFFFF" />
                    <Text style={styles.bulkActionText}>SMS</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          
          {[...clients]
            .filter(client => client.status === 'Lead') // Only show leads, not converted projects
            .sort((a, b) => {
              const dateA = new Date(a.createdAt || a.lastContactDate || a.lastContacted).getTime();
              const dateB = new Date(b.createdAt || b.lastContactDate || b.lastContacted).getTime();
              return dateB - dateA;
            }).map((client) => (
            <View key={client.id} style={styles.clientRow}>
              <View style={styles.clientRowHeader}>
                <TouchableOpacity 
                  style={styles.checkbox}
                  onPress={() => toggleClientSelection(client.id)}
                >
                  {selectedClients.has(client.id) ? (
                    <CheckSquare size={24} color="#2563EB" />
                  ) : (
                    <Square size={24} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
                <View style={styles.clientInfo}>
                  <View style={styles.clientNameRow}>
                    <Text style={styles.clientName}>{client.name}</Text>
                    {(() => {
                      const followUpStatus = getFollowUpStatus(client);
                      return (
                        <View style={[styles.followUpStatusBadge, { backgroundColor: followUpStatus.color }]}>
                          <Text style={styles.followUpStatusText}>{followUpStatus.emoji} {followUpStatus.label}</Text>
                        </View>
                      );
                    })()}
                  </View>
                  {client.address && <Text style={styles.clientAddress}>{client.address}</Text>}
                  <Text style={styles.clientEmail}>{client.email}</Text>
                  <Text style={styles.clientPhone}>{client.phone}</Text>
                  <Text style={styles.clientSource}>{client.source}</Text>
                  <View style={[styles.statusBadge, client.status === 'Lead' ? styles.leadBadge : styles.projectBadge]}>
                    <Text style={styles.statusText}>{client.status}</Text>
                  </View>
                  {(client.lastContactDate || client.lastContacted) && (
                    <Text style={styles.clientDate}>
                      Last contacted: {
                        client.lastContactDate
                          ? new Date(client.lastContactDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : client.lastContacted
                      }
                    </Text>
                  )}
                  {client.createdAt && (
                    <Text style={styles.clientCreatedDate}>Created: {new Date(client.createdAt).toLocaleDateString()}</Text>
                  )}
                  {client.nextFollowUpDate && client.nextFollowUpDate.trim() !== '' && (() => {
                    try {
                      const date = new Date(client.nextFollowUpDate + 'T00:00:00');
                      if (isNaN(date.getTime())) return null;
                      return (
                        <View style={styles.nextFollowUpRow}>
                          <Calendar size={14} color="#2563EB" />
                          <Text style={styles.nextFollowUpText}>Next Follow-Up: {date.toLocaleDateString()}</Text>
                        </View>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}
                  
                  {(() => {
                    const suggestions = getAISuggestions(client);
                    return suggestions.length > 0 ? (
                      <View style={styles.aiSuggestionsContainer}>
                        <View style={styles.aiSuggestionsHeader}>
                          <Sparkles size={14} color="#8B5CF6" />
                          <Text style={styles.aiSuggestionsTitle}>AI Suggestions</Text>
                        </View>
                        {suggestions.map((suggestion, idx) => (
                          <View key={idx} style={styles.aiSuggestionItem}>
                            <View style={styles.aiSuggestionDot} />
                            <Text style={styles.aiClientSuggestionText}>{suggestion}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null;
                  })()}

                  {(() => {
                    const clientVideos = getInspectionVideosQuery.data?.inspections?.filter(
                      v => v.clientId === client.id
                    ) || [];

                    return clientVideos.length > 0 ? (
                      <View style={styles.inspectionVideosContainer}>
                        <View style={styles.inspectionVideosHeader}>
                          <Camera size={14} color="#8B5CF6" />
                          <Text style={styles.inspectionVideosTitle}>
                            Inspection Videos ({clientVideos.length})
                          </Text>
                        </View>
                        {clientVideos.map((video) => (
                          <View key={video.id} style={styles.inspectionVideoItem}>
                            <View style={styles.videoInfo}>
                              <Text style={styles.videoStatus}>
                                {video.status === 'completed' ? '✅' : '⏳'} {video.status === 'completed' ? 'Completed' : 'Pending'}
                              </Text>
                              <Text style={styles.videoDate}>
                                {new Date(video.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </Text>
                              {video.status === 'completed' && video.videoDuration && (
                                <Text style={styles.videoDuration}>
                                  Duration: {Math.floor(video.videoDuration / 60)}:{(video.videoDuration % 60).toString().padStart(2, '0')}
                                </Text>
                              )}
                            </View>
                            {video.status === 'completed' && video.videoUrl && (
                              <TouchableOpacity
                                style={styles.viewVideoButton}
                                onPress={async () => {
                                  try {
                                    console.log('[CRM] Getting video view URL for:', video.videoUrl);
                                    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
                                    const response = await fetch(`${apiUrl}/api/get-video-view-url?videoKey=${encodeURIComponent(video.videoUrl)}`);

                                    if (!response.ok) {
                                      throw new Error('Failed to get video URL');
                                    }

                                    const result = await response.json();
                                    console.log('[CRM] Got video view URL');

                                    if (result.viewUrl) {
                                      Linking.openURL(result.viewUrl);
                                    }
                                  } catch (error: any) {
                                    console.error('[CRM] Error loading video:', error);
                                    Alert.alert('Error', error.message || 'Failed to load video');
                                  }
                                }}
                              >
                                <Text style={styles.viewVideoButtonText}>▶ View Video</Text>
                              </TouchableOpacity>
                            )}
                            {video.status === 'pending' && (
                              <Text style={styles.pendingText}>
                                Expires: {new Date(video.expiresAt).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : null;
                  })()}
                </View>
              </View>
              <View style={styles.clientActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => openMessageModal('email', client.id)}
                >
                  <Mail size={16} color="#2563EB" />
                  <Text style={styles.actionButtonText}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => openMessageModal('sms', client.id)}
                >
                  <MessageSquare size={16} color="#059669" />
                  <Text style={styles.actionButtonText}>SMS</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.followUpButton}
                  onPress={() => {
                    const contactDate = new Date().toISOString();
                    updateClient(client.id, { 
                      lastContacted: new Date().toLocaleDateString(),
                      lastContactDate: contactDate 
                    });
                    Alert.alert('Success', 'Follow-up recorded!');
                  }}
                >
                  <CheckCircle size={16} color="#10B981" />
                  <Text style={styles.followUpButtonText}>Follow Up</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.setFollowUpButton}
                  onPress={() => openFollowUpDatePicker(client.id)}
                >
                  <Calendar size={16} color="#2563EB" />
                  <Text style={styles.setFollowUpButtonText}>Set Follow-Up</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.estimateButton}
                  onPress={() => createEstimateForClient(client.id)}
                >
                  <Calculator size={16} color="#FFFFFF" />
                  <Text style={styles.estimateButtonText}>Create Estimate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.inspectionButton}
                  onPress={() => sendInspectionLink(client.id)}
                  disabled={createInspectionVideoLinkMutation.isPending}
                >
                  <Camera size={16} color="#FFFFFF" />
                  <Text style={styles.inspectionButtonText}>
                    {createInspectionVideoLinkMutation.isPending ? 'Creating Link...' : 'Send Inspection Link'}
                  </Text>
                </TouchableOpacity>
                {client.status === 'Lead' && (
                  <>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => openEstimateActions(client.id)}
                    >
                      <FileText size={16} color="#8B5CF6" />
                      <Text style={styles.actionButtonText}>Estimates</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.convertButton}
                      onPress={() => convertLeadToProject(client.id)}
                    >
                      <CheckCircle size={16} color="#FFFFFF" />
                      <Text style={styles.convertButtonText}>Convert to Project</Text>
                    </TouchableOpacity>
                  </>
                )}
                {(client.status === 'Lead' || client.status === 'Project') && (
                  <TouchableOpacity
                    style={styles.paymentButton}
                    onPress={() => requestPayment(client.id)}
                  >
                    <CreditCard size={16} color="#FFFFFF" />
                    <Text style={styles.paymentButtonText}>Request Payment</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          <View style={styles.metricsWidget}>
            <TouchableOpacity 
              style={styles.metricsHeader}
              onPress={() => setShowMetricsWidget(!showMetricsWidget)}
            >
              <View style={styles.metricsHeaderLeft}>
                <TrendingUp size={20} color="#2563EB" />
                <Text style={styles.metricsHeaderTitle}>CRM Metrics</Text>
              </View>
              {showMetricsWidget ? (
                <ChevronUp size={20} color="#6B7280" />
              ) : (
                <ChevronDown size={20} color="#6B7280" />
              )}
            </TouchableOpacity>

            {showMetricsWidget && (
              <View style={styles.metricsContent}>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <Users size={24} color="#10B981" />
                    </View>
                    <Text style={styles.metricValue}>{conversionRate}%</Text>
                    <Text style={styles.metricLabel}>Conversion Rate</Text>
                    <Text style={styles.metricSubtext}>
                      {totalProjects} of {totalLeads + totalProjects} leads converted
                    </Text>
                  </View>

                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <Clock size={24} color="#F59E0B" />
                    </View>
                    <Text style={styles.metricValue}>{averageResponseTime}d</Text>
                    <Text style={styles.metricLabel}>Avg Response Time</Text>
                    <Text style={styles.metricSubtext}>
                      Days since last contact
                    </Text>
                  </View>

                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <FileCheck size={24} color="#8B5CF6" />
                    </View>
                    <Text style={styles.metricValue}>{totalEstimatesSent}</Text>
                    <Text style={styles.metricLabel}>Estimates Sent</Text>
                    <Text style={styles.metricSubtext}>
                      {estimates.filter(e => e.status === 'approved').length} approved
                    </Text>
                  </View>
                </View>

                <View style={styles.revenueSection}>
                  <Text style={styles.revenueSectionTitle}>Revenue by Lead Source</Text>
                  <View style={styles.revenueGrid}>
                    <View style={styles.revenueCard}>
                      <View style={styles.revenueCardHeader}>
                        <View style={[styles.revenueSourceBadge, { backgroundColor: '#DBEAFE' }]}>
                          <Text style={[styles.revenueSourceText, { color: '#1E40AF' }]}>Google</Text>
                        </View>
                        <DollarSignIcon size={18} color="#2563EB" />
                      </View>
                      <Text style={styles.revenueAmount}>${revenueBySource.Google.toLocaleString()}</Text>
                      <Text style={styles.revenueSubtext}>
                        {leadsByGoogle} active leads
                      </Text>
                    </View>

                    <View style={styles.revenueCard}>
                      <View style={styles.revenueCardHeader}>
                        <View style={[styles.revenueSourceBadge, { backgroundColor: '#D1FAE5' }]}>
                          <Text style={[styles.revenueSourceText, { color: '#047857' }]}>Referral</Text>
                        </View>
                        <DollarSignIcon size={18} color="#10B981" />
                      </View>
                      <Text style={styles.revenueAmount}>${revenueBySource.Referral.toLocaleString()}</Text>
                      <Text style={styles.revenueSubtext}>
                        {leadsByReferral} active leads
                      </Text>
                    </View>

                    <View style={styles.revenueCard}>
                      <View style={styles.revenueCardHeader}>
                        <View style={[styles.revenueSourceBadge, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.revenueSourceText, { color: '#92400E' }]}>Ad</Text>
                        </View>
                        <DollarSignIcon size={18} color="#F59E0B" />
                      </View>
                      <Text style={styles.revenueAmount}>${revenueBySource.Ad.toLocaleString()}</Text>
                      <Text style={styles.revenueSubtext}>
                        {leadsByAd} active leads
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {showAddForm && (
            <View style={styles.addForm}>
              <Text style={styles.formTitle}>Add New Client</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Name" 
                placeholderTextColor="#9CA3AF"
                value={newClientName}
                onChangeText={setNewClientName}
              />
              <TextInput 
                style={styles.input} 
                placeholder="Address" 
                placeholderTextColor="#9CA3AF"
                value={newClientAddress}
                onChangeText={setNewClientAddress}
              />
              <TextInput 
                style={styles.input} 
                placeholder="Email" 
                placeholderTextColor="#9CA3AF"
                value={newClientEmail}
                onChangeText={setNewClientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput 
                style={styles.input} 
                placeholder="Phone" 
                placeholderTextColor="#9CA3AF"
                value={newClientPhone}
                onChangeText={setNewClientPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Source (Google, Referral, Ad, Phone Call)"
                placeholderTextColor="#9CA3AF"
                value={newClientSource}
                onChangeText={setNewClientSource}
              />
              <TouchableOpacity
                style={[styles.submitButton, isAddingClient && styles.submitButtonDisabled]}
                onPress={() => handleAddClient(false)}
                disabled={isAddingClient}
              >
                {isAddingClient ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Client</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Client Modal */}
      <Modal
        visible={showAddClientModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddClientModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Client</Text>
              <TouchableOpacity onPress={() => setShowAddClientModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Client name"
                placeholderTextColor="#9CA3AF"
                value={newClientName}
                onChangeText={setNewClientName}
              />

              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="client@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newClientEmail}
                onChangeText={setNewClientEmail}
              />

              <Text style={styles.inputLabel}>Phone *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="(555) 123-4567"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={newClientPhone}
                onChangeText={setNewClientPhone}
              />

              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="123 Main St, City, State"
                placeholderTextColor="#9CA3AF"
                value={newClientAddress}
                onChangeText={setNewClientAddress}
              />

              <Text style={styles.inputLabel}>Source *</Text>
              <View style={styles.sourceButtonsContainer}>
                {['Google', 'Referral', 'Ad', 'Phone Call'].map((source) => (
                  <TouchableOpacity
                    key={source}
                    style={[
                      styles.sourceButton,
                      newClientSource === source && styles.sourceButtonActive
                    ]}
                    onPress={() => setNewClientSource(source)}
                  >
                    <Text style={[
                      styles.sourceButtonText,
                      newClientSource === source && styles.sourceButtonTextActive
                    ]}>{source}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddClientModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isAddingClient && styles.submitButtonDisabled]}
                onPress={() => handleAddClient(true)}
                disabled={isAddingClient}
              >
                {isAddingClient ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Client</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMessageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {messageType === 'email' ? 'Send Email' : 'Send SMS'}
              </Text>
              <TouchableOpacity onPress={() => setShowMessageModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.recipientInfo}>
              <Text style={styles.recipientLabel}>Recipients:</Text>
              <Text style={styles.recipientText}>
                {singleRecipient 
                  ? clients.find(c => c.id === singleRecipient)?.name
                  : `${selectedClients.size} client${selectedClients.size > 1 ? 's' : ''} selected`}
              </Text>
            </View>

            <View style={styles.templateSection}>
              <Text style={styles.templateLabel}>Quick Templates:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                {promotionTemplates.map(template => (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.templateButton}
                    onPress={() => applyTemplate(template)}
                  >
                    <Text style={styles.templateButtonText}>{template.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {messageType === 'email' && (
              <TextInput
                style={styles.messageInput}
                placeholder="Subject"
                placeholderTextColor="#9CA3AF"
                value={messageSubject}
                onChangeText={setMessageSubject}
              />
            )}

            <TextInput
              style={[styles.messageInput, styles.messageBodyInput]}
              placeholder="Message body (use {name} for personalization)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={8}
              value={messageBody}
              onChangeText={setMessageBody}
              textAlignVertical="top"
            />

            <View style={styles.attachmentSection}>
              <View style={styles.attachmentHeader}>
                <Text style={styles.attachmentLabel}>Attachments</Text>
                <TouchableOpacity 
                  style={styles.addAttachmentButton}
                  onPress={pickDocument}
                >
                  <Paperclip size={16} color="#2563EB" />
                  <Text style={styles.addAttachmentText}>Add Files</Text>
                </TouchableOpacity>
              </View>
              
              {attachments.length > 0 && (
                <View style={styles.attachmentList}>
                  {attachments.map((attachment, index) => (
                    <View key={index} style={styles.attachmentItem}>
                      <FileText size={16} color="#6B7280" />
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {attachment.name}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => removeAttachment(index)}
                        style={styles.removeAttachment}
                      >
                        <X size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.tipText}>
              💡 Tip: Use {'{name}'} in your message to automatically personalize with first name
            </Text>
            {messageType === 'email' && attachments.length > 0 && (
              <Text style={styles.warningText}>
                ⚠️ You&apos;ll need to manually attach files to your email client
              </Text>
            )}
            {messageType === 'sms' && attachments.length > 0 && (
              <Text style={styles.warningText}>
                ⚠️ Note: SMS typically doesn&apos;t support file attachments. Consider using email instead.
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowMessageModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sendButton}
                onPress={sendMessage}
              >
                <Send size={18} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEstimateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEstimateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Estimate Management</Text>
              <TouchableOpacity onPress={() => setShowEstimateModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.estimateModalScroll}>
              {selectedClientForEstimate && (() => {
                const client = clients.find(c => c.id === selectedClientForEstimate);
                if (!client) return null;

                const clientEstimates = estimates; // Show all estimates for now

                if (clientEstimates.length === 0) {
                  return (
                    <View style={styles.emptyState}>
                      <Calculator size={48} color="#D1D5DB" />
                      <Text style={styles.emptyStateTitle}>No Estimates Yet</Text>
                      <Text style={styles.emptyStateText}>
                        Create an estimate for {client.name} to get started.
                      </Text>
                      <TouchableOpacity 
                        style={styles.createEstimateButton}
                        onPress={() => {
                          setShowEstimateModal(false);
                          createEstimateForClient(client.id);
                        }}
                      >
                        <Plus size={20} color="#FFFFFF" />
                        <Text style={styles.createEstimateButtonText}>Create Estimate</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return clientEstimates.map(estimate => (
                  <View key={estimate.id} style={styles.estimateCard}>
                    <View style={styles.estimateHeader}>
                      <TouchableOpacity
                        onPress={() => {
                          setShowEstimateModal(false);
                          router.push(`/project/${estimate.projectId}/estimate?estimateId=${estimate.id}`);
                        }}
                      >
                        <Text style={[styles.estimateName, styles.estimateNameClickable]}>{estimate.name}</Text>
                      </TouchableOpacity>
                      <View style={[
                        styles.estimateStatusBadge,
                        estimate.status === 'draft' && styles.draftBadge,
                        estimate.status === 'sent' && styles.sentBadge,
                        estimate.status === 'approved' && styles.approvedBadge,
                        estimate.status === 'rejected' && styles.rejectedBadge,
                        estimate.status === 'paid' && styles.paidBadge,
                      ]}>
                        <Text style={styles.estimateStatusText}>
                          {estimate.status === 'paid' ? '✓ Paid' : estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.estimateTotal}>${estimate.total.toFixed(2)}</Text>
                    <Text style={styles.estimateDate}>
                      Created: {new Date(estimate.createdDate).toLocaleDateString()}
                    </Text>
                    <Text style={styles.estimateItems}>{estimate.items.length} items</Text>

                    <View style={styles.estimateWorkflow}>
                      <Text style={styles.workflowTitle}>Workflow</Text>
                      
                      <TouchableOpacity
                        style={[
                          styles.workflowButton,
                          estimate.status === 'sent' && styles.workflowButtonCompleted,
                        ]}
                        onPress={() => sendEstimate(estimate.id)}
                      >
                        {estimate.status === 'sent' || estimate.status === 'approved' ? (
                          <CheckCircle size={18} color="#10B981" />
                        ) : (
                          <Send size={18} color="#2563EB" />
                        )}
                        <Text style={[
                          styles.workflowButtonText,
                          estimate.status === 'sent' && styles.workflowButtonTextCompleted,
                        ]}>Send Estimate</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[
                          styles.workflowButton,
                          estimate.status === 'approved' && styles.workflowButtonCompleted,
                        ]}
                        onPress={() => requestSignature(estimate.id)}
                        disabled={estimate.status === 'draft'}
                      >
                        {estimate.status === 'approved' ? (
                          <CheckCircle size={18} color="#10B981" />
                        ) : (
                          <FileSignature size={18} color="#8B5CF6" />
                        )}
                        <Text style={[
                          styles.workflowButtonText,
                          estimate.status === 'approved' && styles.workflowButtonTextCompleted,
                        ]}>Request Signature</Text>
                      </TouchableOpacity>

                      {estimate.status === 'paid' || estimate.status === 'approved' ? (
                        <TouchableOpacity
                          style={[styles.workflowButton, styles.workflowButtonDisabled]}
                          disabled={true}
                        >
                          <CheckCircle size={18} color="#10B981" />
                          <Text style={styles.workflowButtonText}>
                            {estimate.status === 'approved' ? 'Converted to Project' : 'Convert to Project'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.workflowSplit}>
                          <TouchableOpacity
                            style={styles.workflowButtonHalf}
                            onPress={() => {
                              console.log('[CRM] Convert to Project clicked for estimate:', estimate.id, 'status:', estimate.status);
                              convertToProject(estimate.id);
                            }}
                            disabled={estimate.status === 'draft'}
                          >
                            <CheckCircle size={18} color="#10B981" />
                            <Text style={styles.workflowButtonTextSmall}>Convert to Project</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.workflowButtonHalf}
                            onPress={() => createPaymentLinkAndEmail(estimate.id, selectedClientForEstimate || undefined)}
                            disabled={estimate.status !== 'sent' && estimate.status !== 'approved'}
                          >
                            <DollarSign size={18} color="#F59E0B" />
                            <Text style={styles.workflowButtonTextSmall}>Request Payment</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEstimateTypeModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEstimateTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.estimateTypeModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Estimate Type</Text>
              <TouchableOpacity onPress={() => setShowEstimateTypeModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.estimateTypeDescription}>
              Select how you want to create your estimate
            </Text>

            <TouchableOpacity
              style={styles.estimateTypeCard}
              onPress={async () => {
                if (selectedClientForEstimate) {
                  try {
                    await createRegularEstimate(selectedClientForEstimate);
                  } catch (error) {
                    console.error('Error creating regular estimate:', error);
                    Alert.alert('Error', 'Failed to create estimate. Please try again.');
                  }
                }
              }}
            >
              <View style={styles.estimateTypeIconContainer}>
                <Calculator size={32} color="#2563EB" />
              </View>
              <View style={styles.estimateTypeContent}>
                <Text style={styles.estimateTypeTitle}>Regular Estimate</Text>
                <Text style={styles.estimateTypeText}>
                  Create an estimate by selecting items from the price list and entering quantities manually
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.estimateTypeCard}
              onPress={async () => {
                if (selectedClientForEstimate) {
                  try {
                    await createTakeoffEstimate(selectedClientForEstimate);
                  } catch (error) {
                    console.error('Error creating takeoff estimate:', error);
                    Alert.alert('Error', 'Failed to create estimate. Please try again.');
                  }
                }
              }}
            >
              <View style={styles.estimateTypeIconContainer}>
                <ClipboardList size={32} color="#10B981" />
              </View>
              <View style={styles.estimateTypeContent}>
                <Text style={styles.estimateTypeTitle}>Takeoff Estimate</Text>
                <Text style={styles.estimateTypeText}>
                  Upload construction plans and use the takeoff tool to measure areas, count items, and automatically calculate quantities
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAIModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAIModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.aiModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.aiModalTitleContainer}>
                <Sparkles size={24} color="#8B5CF6" />
                <Text style={styles.modalTitle}>CRM AI Assistant</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAIModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.aiDescription}>
              Ask me anything about your CRM data, clients, leads, estimates, and more!
            </Text>

            <ScrollView style={styles.aiMessagesContainer} showsVerticalScrollIndicator={false}>
              {messages.length === 0 && (
                <View style={styles.aiEmptyState}>
                  <Sparkles size={48} color="#D1D5DB" />
                  <Text style={styles.aiEmptyTitle}>How can I help?</Text>
                  <Text style={styles.aiEmptyText}>Try asking:</Text>
                  <View style={styles.aiSuggestions}>
                    <TouchableOpacity
                      style={styles.aiSuggestionChip}
                      onPress={() => sendAIMessage('How many leads do I have?')}
                    >
                      <Text style={styles.aiSuggestionText}>How many leads do I have?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.aiSuggestionChip}
                      onPress={() => sendAIMessage('Show me all clients from Google')}
                    >
                      <Text style={styles.aiSuggestionText}>Show me all clients from Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.aiSuggestionChip}
                      onPress={() => sendAIMessage('What is my total estimate value?')}
                    >
                      <Text style={styles.aiSuggestionText}>What is my total estimate value?</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {messages.map((m) => (
                <View key={m.id} style={styles.aiMessageGroup}>
                  {m.parts.map((part, i) => {
                    switch (part.type) {
                      case 'text':
                        return (
                          <View
                            key={`${m.id}-${i}`}
                            style={[
                              styles.aiMessage,
                              m.role === 'user' ? styles.aiMessageUser : styles.aiMessageAssistant,
                            ]}
                          >
                            <Text
                              style={[
                                styles.aiMessageText,
                                m.role === 'user' ? styles.aiMessageTextUser : styles.aiMessageTextAssistant,
                              ]}
                            >
                              {part.text}
                            </Text>
                          </View>
                        );
                      case 'tool':
                        if (part.state === 'input-streaming' || part.state === 'input-available') {
                          return (
                            <View key={`${m.id}-${i}`} style={styles.aiToolMessage}>
                              <Text style={styles.aiToolText}>🔍 Looking up {part.toolName}...</Text>
                            </View>
                          );
                        }
                        return null;
                    }
                  })}
                </View>
              ))}
            </ScrollView>

            <View style={styles.aiInputContainer}>
              <TextInput
                style={styles.aiInput}
                placeholder="Ask about your CRM data..."
                placeholderTextColor="#9CA3AF"
                value={aiInput}
                onChangeText={setAiInput}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.aiSendButton,
                  !aiInput.trim() && styles.aiSendButtonDisabled,
                ]}
                onPress={() => {
                  if (aiInput.trim()) {
                    sendAIMessage(aiInput);
                    setAiInput('');
                  }
                }}
                disabled={!aiInput.trim()}
              >
                <Send size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCallAssistantModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCallAssistantModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.callAssistantModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.callAssistantTitleContainer}>
                <Phone size={24} color="#10B981" />
                <Text style={styles.modalTitle}>Virtual Call Assistant</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCallAssistantModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.callAssistantScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.callAssistantDescription}>
                <Text style={styles.callAssistantDescText}>
                  Set up an AI-powered virtual assistant to handle incoming calls, qualify leads, gather customer information, and automatically add serious prospects to your CRM with scheduled follow-ups.
                </Text>
              </View>

              <View style={styles.configSection}>
                <View style={styles.configHeader}>
                  <Text style={styles.configTitle}>Assistant Status</Text>
                  <View style={[
                    styles.statusBadge,
                    callAssistantConfig.enabled ? styles.activeStatusBadge : styles.inactiveStatusBadge
                  ]}>
                    <Text style={styles.statusBadgeText}>
                      {callAssistantConfig.enabled ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setCallAssistantConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                >
                  <Text style={styles.toggleButtonText}>
                    {callAssistantConfig.enabled ? 'Disable' : 'Enable'} Call Assistant
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.configSection}>
                <Text style={styles.configTitle}>Business Information</Text>
                <Text style={styles.inputLabel}>Business Name</Text>
                <TextInput
                  style={styles.configInput}
                  value={callAssistantConfig.businessName}
                  onChangeText={(text) => setCallAssistantConfig(prev => ({ ...prev, businessName: text }))}
                  placeholder="Enter business name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.configSection}>
                <Text style={styles.configTitle}>Greeting Message</Text>
                <TextInput
                  style={[styles.configInput, styles.textArea]}
                  value={callAssistantConfig.greeting}
                  onChangeText={(text) => setCallAssistantConfig(prev => ({ ...prev, greeting: text }))}
                  placeholder="Enter greeting message"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.configSection}>
                <Text style={styles.configTitle}>Qualification Questions</Text>
                <Text style={styles.configDescription}>
                  These questions will be asked to qualify leads
                </Text>
                {callAssistantConfig.qualificationQuestions.map((question, index) => (
                  <View key={index} style={styles.questionItem}>
                    <Text style={styles.questionNumber}>{index + 1}.</Text>
                    <Text style={styles.questionText}>{question}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.configSection}>
                <Text style={styles.configTitle}>Lead Criteria</Text>
                <Text style={styles.inputLabel}>Serious Lead Definition</Text>
                <TextInput
                  style={[styles.configInput, styles.textArea]}
                  value={callAssistantConfig.seriousLeadCriteria}
                  onChangeText={(text) => setCallAssistantConfig(prev => ({ ...prev, seriousLeadCriteria: text }))}
                  placeholder="Define what makes a serious lead"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.configSection}>
                <Text style={styles.configTitle}>Automation Settings</Text>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setCallAssistantConfig(prev => ({ ...prev, autoAddToCRM: !prev.autoAddToCRM }))}
                >
                  {callAssistantConfig.autoAddToCRM ? (
                    <CheckSquare size={24} color="#10B981" />
                  ) : (
                    <Square size={24} color="#9CA3AF" />
                  )}
                  <View style={styles.checkboxContent}>
                    <Text style={styles.checkboxLabel}>Auto-add to CRM</Text>
                    <Text style={styles.checkboxDescription}>
                      Automatically add qualified leads to CRM
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setCallAssistantConfig(prev => ({ ...prev, autoSchedule: !prev.autoSchedule }))}
                >
                  {callAssistantConfig.autoSchedule ? (
                    <CheckSquare size={24} color="#10B981" />
                  ) : (
                    <Square size={24} color="#9CA3AF" />
                  )}
                  <View style={styles.checkboxContent}>
                    <Text style={styles.checkboxLabel}>Auto-schedule follow-ups</Text>
                    <Text style={styles.checkboxDescription}>
                      Create follow-up tasks for serious leads
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.featuresList}>
                <Text style={styles.featuresTitle}>What the Assistant Can Do:</Text>
                <View style={styles.featureItem}>
                  <CheckCircle size={18} color="#10B981" />
                  <Text style={styles.featureText}>Answer incoming calls 24/7</Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle size={18} color="#10B981" />
                  <Text style={styles.featureText}>Qualify leads based on your criteria</Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle size={18} color="#10B981" />
                  <Text style={styles.featureText}>Collect customer contact information</Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle size={18} color="#10B981" />
                  <Text style={styles.featureText}>Schedule appointments automatically</Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle size={18} color="#10B981" />
                  <Text style={styles.featureText}>Add serious leads to CRM instantly</Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle size={18} color="#10B981" />
                  <Text style={styles.featureText}>Send SMS/email confirmations</Text>
                </View>
              </View>

              <View style={styles.setupInfo}>
                <Settings size={20} color="#F59E0B" />
                <Text style={styles.setupInfoText}>
                  To complete setup, you&apos;ll need to configure your phone system to forward calls to the AI assistant number. Contact support for integration assistance.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowCallAssistantModal(false)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveConfigButton}
                onPress={() => {
                  Alert.alert('Success', 'Call assistant settings saved successfully!');
                  setShowCallAssistantModal(false);
                }}
              >
                <Text style={styles.saveConfigButtonText}>Save Configuration</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCallLogsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCallLogsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.callLogsModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.callLogsTitleContainer}>
                <PhoneIncoming size={24} color="#2563EB" />
                <Text style={styles.modalTitle}>Recent Call Logs</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCallLogsModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.callLogsHeader}>
              <Text style={styles.callLogsCount}>
                {callLogs.length} total call{callLogs.length !== 1 ? 's' : ''}
              </Text>
              <TouchableOpacity
                style={styles.addCallLogButton}
                onPress={() => {
                  const newCallLog: CallLog = {
                    id: `call-${Date.now()}`,
                    callerName: 'John Smith',
                    callerPhone: '+1 (555) 123-4567',
                    callerEmail: 'john.smith@email.com',
                    callDate: new Date().toISOString(),
                    callDuration: '5:30',
                    callType: 'incoming',
                    status: 'answered',
                    isQualified: true,
                    qualificationScore: 85,
                    notes: 'Customer interested in kitchen remodel. Budget: $50,000. Wants to start in 2 months. Very serious about the project.',
                    transcript: `AI: Thank you for calling Legacy Prime Construction. How can I help you today?

Caller: Hi, I'm looking to get my kitchen remodeled.

AI: That sounds exciting! I'd love to help you with that. And who am I speaking with?

Caller: This is John Smith.

AI: Great to meet you, John! What kind of budget are you working with for this kitchen remodel?

Caller: I'm thinking around $50,000.

AI: Perfect! And when were you hoping to get started on this project?

Caller: Probably in about 2 months.

AI: Wonderful, John! I'm excited about your kitchen remodel project. One of our project managers will give you a call within 24 hours to discuss the details. Thanks so much for calling!`,
                    projectType: 'Kitchen Remodel',
                    budget: '$50,000',
                    startDate: '2 months',
                    propertyType: 'Residential',
                    addedToCRM: true,
                    scheduledFollowUp: new Date(Date.now() + 86400000).toISOString(),
                  };
                  addCallLog(newCallLog);
                  
                  if (newCallLog.addedToCRM && newCallLog.isQualified) {
                    const newClient: Client = {
                      id: `client-${Date.now()}`,
                      name: newCallLog.callerName,
                      email: newCallLog.callerEmail || '',
                      phone: newCallLog.callerPhone,
                      source: 'Phone Call',
                      status: 'Lead',
                      lastContacted: new Date().toLocaleDateString(),
                      lastContactDate: new Date().toISOString(),
                      createdAt: new Date().toISOString(),
                    };
                    addClient(newClient);
                    Alert.alert('Success', `Test call log added! ${newCallLog.callerName} has been added to CRM as a qualified lead.`);
                  } else {
                    Alert.alert('Success', 'Test call log added!');
                  }
                }}
              >
                <Plus size={18} color="#2563EB" />
                <Text style={styles.addCallLogText}>Add Test Call</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.callLogsScroll} showsVerticalScrollIndicator={false}>
              {isLoadingCallLogs ? (
                <View style={styles.emptyCallLogs}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text style={styles.emptyCallLogsTitle}>Loading Call Logs...</Text>
                  <Text style={styles.emptyCallLogsText}>
                    Fetching call history from the database.
                  </Text>
                </View>
              ) : callLogs.length === 0 ? (
                <View style={styles.emptyCallLogs}>
                  <PhoneIncoming size={48} color="#D1D5DB" />
                  <Text style={styles.emptyCallLogsTitle}>No Call Logs Yet</Text>
                  <Text style={styles.emptyCallLogsText}>
                    When your virtual call assistant handles calls, they will appear here with detailed notes and qualifications.
                  </Text>
                </View>
              ) : (
                callLogs.map((log) => (
                  <TouchableOpacity
                    key={log.id}
                    style={styles.callLogCard}
                    onPress={() => setSelectedCallLog(log)}
                  >
                    <View style={styles.callLogHeader}>
                      <View style={styles.callLogIconContainer}>
                        {log.callType === 'incoming' ? (
                          <PhoneIncoming size={20} color="#10B981" />
                        ) : (
                          <PhoneOutgoing size={20} color="#2563EB" />
                        )}
                      </View>
                      <View style={styles.callLogMainInfo}>
                        <Text style={styles.callLogName}>{log.callerName}</Text>
                        <Text style={styles.callLogPhone}>{log.callerPhone}</Text>
                      </View>
                      <View style={[styles.callLogStatusBadge, log.isQualified ? styles.qualifiedBadge : styles.notQualifiedBadge]}>
                        <Text style={styles.callLogStatusText}>
                          {log.isQualified ? 'Qualified' : 'Not Qualified'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.callLogDetails}>
                      <View style={styles.callLogDetailRow}>
                        <Clock size={14} color="#6B7280" />
                        <Text style={styles.callLogDetailText}>
                          {new Date(log.callDate).toLocaleDateString()} at {new Date(log.callDate).toLocaleTimeString()}
                        </Text>
                        <Text style={styles.callLogDuration}>Duration: {log.callDuration}</Text>
                      </View>

                      {log.projectType && (
                        <View style={styles.callLogDetailRow}>
                          <Text style={styles.callLogLabel}>Project:</Text>
                          <Text style={styles.callLogValue}>{log.projectType}</Text>
                        </View>
                      )}

                      {log.budget && (
                        <View style={styles.callLogDetailRow}>
                          <Text style={styles.callLogLabel}>Budget:</Text>
                          <Text style={styles.callLogValue}>{log.budget}</Text>
                        </View>
                      )}

                      {log.notes && (
                        <View style={styles.callLogNotes}>
                          <Text style={styles.callLogNotesLabel}>Notes:</Text>
                          <Text style={styles.callLogNotesText} numberOfLines={2}>{log.notes}</Text>
                        </View>
                      )}

                      <View style={styles.callLogActions}>
                        {log.addedToCRM && (
                          <View style={styles.callLogTag}>
                            <CheckCircle size={14} color="#10B981" />
                            <Text style={styles.callLogTagText}>Added to CRM</Text>
                          </View>
                        )}
                        {log.scheduledFollowUp && (
                          <View style={styles.callLogTag}>
                            <Clock size={14} color="#F59E0B" />
                            <Text style={styles.callLogTagText}>Follow-up scheduled</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.deleteCallLogButton}
                          onPress={() => {
                            Alert.alert(
                              'Delete Call Log',
                              'Are you sure you want to delete this call log?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => deleteCallLog(log.id),
                                },
                              ]
                            );
                          }}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedCallLog !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedCallLog(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedCallLog && (
            <View style={styles.callLogDetailModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Call Details</Text>
                <TouchableOpacity onPress={() => setSelectedCallLog(null)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.callLogDetailScroll}>
                <View style={styles.callLogDetailSection}>
                  <Text style={styles.callLogDetailSectionTitle}>Caller Information</Text>
                  <View style={styles.callLogDetailItem}>
                    <Text style={styles.callLogDetailLabel}>Name:</Text>
                    <Text style={styles.callLogDetailValue}>{selectedCallLog.callerName}</Text>
                  </View>
                  <View style={styles.callLogDetailItem}>
                    <Text style={styles.callLogDetailLabel}>Phone:</Text>
                    <Text style={styles.callLogDetailValue}>{selectedCallLog.callerPhone}</Text>
                  </View>
                  {selectedCallLog.callerEmail && (
                    <View style={styles.callLogDetailItem}>
                      <Text style={styles.callLogDetailLabel}>Email:</Text>
                      <Text style={styles.callLogDetailValue}>{selectedCallLog.callerEmail}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.callLogDetailSection}>
                  <Text style={styles.callLogDetailSectionTitle}>Call Information</Text>
                  <View style={styles.callLogDetailItem}>
                    <Text style={styles.callLogDetailLabel}>Date & Time:</Text>
                    <Text style={styles.callLogDetailValue}>
                      {new Date(selectedCallLog.callDate).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.callLogDetailItem}>
                    <Text style={styles.callLogDetailLabel}>Duration:</Text>
                    <Text style={styles.callLogDetailValue}>{selectedCallLog.callDuration}</Text>
                  </View>
                  <View style={styles.callLogDetailItem}>
                    <Text style={styles.callLogDetailLabel}>Type:</Text>
                    <Text style={styles.callLogDetailValue}>
                      {selectedCallLog.callType === 'incoming' ? 'Incoming' : 'Outgoing'}
                    </Text>
                  </View>
                  <View style={styles.callLogDetailItem}>
                    <Text style={styles.callLogDetailLabel}>Status:</Text>
                    <Text style={styles.callLogDetailValue}>
                      {selectedCallLog.status.charAt(0).toUpperCase() + selectedCallLog.status.slice(1)}
                    </Text>
                  </View>
                </View>

                {selectedCallLog.isQualified && (
                  <View style={styles.callLogDetailSection}>
                    <Text style={styles.callLogDetailSectionTitle}>Project Details</Text>
                    {selectedCallLog.projectType && (
                      <View style={styles.callLogDetailItem}>
                        <Text style={styles.callLogDetailLabel}>Project Type:</Text>
                        <Text style={styles.callLogDetailValue}>{selectedCallLog.projectType}</Text>
                      </View>
                    )}
                    {selectedCallLog.budget && (
                      <View style={styles.callLogDetailItem}>
                        <Text style={styles.callLogDetailLabel}>Budget:</Text>
                        <Text style={styles.callLogDetailValue}>{selectedCallLog.budget}</Text>
                      </View>
                    )}
                    {selectedCallLog.startDate && (
                      <View style={styles.callLogDetailItem}>
                        <Text style={styles.callLogDetailLabel}>Start Date:</Text>
                        <Text style={styles.callLogDetailValue}>{selectedCallLog.startDate}</Text>
                      </View>
                    )}
                    {selectedCallLog.propertyType && (
                      <View style={styles.callLogDetailItem}>
                        <Text style={styles.callLogDetailLabel}>Property Type:</Text>
                        <Text style={styles.callLogDetailValue}>{selectedCallLog.propertyType}</Text>
                      </View>
                    )}
                    {selectedCallLog.qualificationScore && (
                      <View style={styles.callLogDetailItem}>
                        <Text style={styles.callLogDetailLabel}>Qualification Score:</Text>
                        <Text style={[styles.callLogDetailValue, styles.qualificationScoreText]}>
                          {selectedCallLog.qualificationScore}/100
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {selectedCallLog.notes && (
                  <View style={styles.callLogDetailSection}>
                    <Text style={styles.callLogDetailSectionTitle}>Notes</Text>
                    <Text style={styles.callLogFullNotes}>{selectedCallLog.notes}</Text>
                  </View>
                )}

                {selectedCallLog.transcript && (
                  <View style={styles.callLogDetailSection}>
                    <Text style={styles.callLogDetailSectionTitle}>Call Transcript</Text>
                    <Text style={styles.callLogTranscript}>{selectedCallLog.transcript}</Text>
                  </View>
                )}

                <View style={styles.callLogDetailSection}>
                  <Text style={styles.callLogDetailSectionTitle}>Actions Taken</Text>
                  <View style={styles.callLogActionsList}>
                    <View style={styles.callLogActionItem}>
                      {selectedCallLog.addedToCRM ? (
                        <CheckCircle size={20} color="#10B981" />
                      ) : (
                        <X size={20} color="#EF4444" />
                      )}
                      <Text style={styles.callLogActionText}>
                        {selectedCallLog.addedToCRM ? 'Added to CRM' : 'Not added to CRM'}
                      </Text>
                    </View>
                    <View style={styles.callLogActionItem}>
                      {selectedCallLog.scheduledFollowUp ? (
                        <CheckCircle size={20} color="#10B981" />
                      ) : (
                        <X size={20} color="#EF4444" />
                      )}
                      <Text style={styles.callLogActionText}>
                        {selectedCallLog.scheduledFollowUp
                          ? `Follow-up scheduled for ${new Date(selectedCallLog.scheduledFollowUp).toLocaleDateString()}`
                          : 'No follow-up scheduled'}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setSelectedCallLog(null)}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={showFollowUpModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowFollowUpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.followUpModal}>
            <View style={styles.modalHeader}>
              <View style={styles.followUpModalTitleContainer}>
                <Calendar size={24} color="#2563EB" />
                <Text style={styles.modalTitle}>Set Follow-Up Date</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFollowUpModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.followUpModalDescription}>
              Choose the next date to follow up with this client
            </Text>

            {selectedFollowUpDate && (
              <View style={styles.selectedDateDisplay}>
                <Text style={styles.selectedDateLabel}>Selected Date:</Text>
                <Text style={styles.selectedDateValue}>
                  {new Date(selectedFollowUpDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            )}

            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => changeMonth(-1)}
                >
                  <Text style={styles.calendarNavText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.calendarMonthTitle}>
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => changeMonth(1)}
                >
                  <Text style={styles.calendarNavText}>›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.calendarWeekDays}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <Text key={day} style={styles.calendarWeekDay}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarDaysGrid}>
                {(() => {
                  const { daysInMonth, startDayOfWeek, year, month } = getDaysInMonth(calendarMonth);
                  const days = [];
                  const today = new Date();
                  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                  for (let i = 0; i < startDayOfWeek; i++) {
                    days.push(<View key={`empty-${i}`} style={styles.calendarDayEmpty} />);
                  }

                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = dateStr === selectedFollowUpDate;
                    const isToday = dateStr === todayStr;
                    const isPast = new Date(dateStr) < new Date(todayStr);

                    days.push(
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.calendarDay,
                          isSelected && styles.calendarDaySelected,
                          isToday && !isSelected && styles.calendarDayToday,
                        ]}
                        onPress={() => selectDate(day)}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isSelected && styles.calendarDayTextSelected,
                            isToday && !isSelected && styles.calendarDayTextToday,
                            isPast && !isSelected && styles.calendarDayTextPast,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  }

                  return days;
                })()}
              </View>
            </View>

            <View style={styles.quickDateButtons}>
              <TouchableOpacity
                style={styles.quickDateButton}
                onPress={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setSelectedFollowUpDate(tomorrow.toISOString().split('T')[0]);
                  setCalendarMonth(tomorrow);
                }}
              >
                <Text style={styles.quickDateButtonText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateButton}
                onPress={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  setSelectedFollowUpDate(nextWeek.toISOString().split('T')[0]);
                  setCalendarMonth(nextWeek);
                }}
              >
                <Text style={styles.quickDateButtonText}>Next Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateButton}
                onPress={() => {
                  const nextMonth = new Date();
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setSelectedFollowUpDate(nextMonth.toISOString().split('T')[0]);
                  setCalendarMonth(nextMonth);
                }}
              >
                <Text style={styles.quickDateButtonText}>Next Month</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowFollowUpModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveFollowUpButton}
                onPress={saveFollowUpDate}
              >
                <Text style={styles.saveFollowUpButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Request Modal */}
      <Modal
        visible={showPaymentRequestModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPaymentRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.paymentModalTitleContainer}>
                <CreditCard size={24} color="#2563EB" />
                <Text style={styles.modalTitle}>Request Payment</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPaymentRequestModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {(() => {
              const client = clients.find(c => c.id === selectedClientForPayment);
              if (!client) return null;

              // Show all estimates (matching existing estimate modal behavior)
              const clientEstimates = estimates;

              return (
                <ScrollView style={styles.estimateListScroll} showsVerticalScrollIndicator={false}>
                  {clientEstimates.length === 0 ? (
                    <View style={styles.emptyEstimatesContainer}>
                      <Calculator size={48} color="#D1D5DB" />
                      <Text style={styles.emptyEstimatesTitle}>No Estimates Found</Text>
                      <Text style={styles.emptyEstimatesText}>
                        Create an estimate for {client.name} first before requesting payment.
                      </Text>
                      <TouchableOpacity
                        style={styles.createEstimateButton}
                        onPress={() => {
                          setShowPaymentRequestModal(false);
                          setSelectedClientForEstimate(client.id);
                          setShowEstimateTypeModal(true);
                        }}
                      >
                        <Plus size={20} color="#FFFFFF" />
                        <Text style={styles.createEstimateButtonText}>Create Estimate</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.selectEstimateText}>
                        Select an estimate to create a payment link for {client.name}:
                      </Text>
                      {clientEstimates.map((estimate) => (
                        <TouchableOpacity
                          key={estimate.id}
                          style={[
                            styles.estimateCard,
                            estimate.status === 'paid' && styles.estimateCardDisabled,
                          ]}
                          onPress={() => estimate.status !== 'paid' && createPaymentLinkAndEmail(estimate.id)}
                          disabled={isCreatingPaymentLink || estimate.status === 'paid'}
                        >
                          <View style={styles.estimateCardHeader}>
                            <Text style={styles.estimateCardName}>{estimate.name}</Text>
                            <View style={[
                              styles.estimateStatusBadge,
                              estimate.status === 'approved' && styles.estimateStatusApproved,
                              estimate.status === 'sent' && styles.estimateStatusSent,
                              estimate.status === 'draft' && styles.estimateStatusDraft,
                              estimate.status === 'rejected' && styles.estimateStatusRejected,
                              estimate.status === 'paid' && styles.estimateStatusPaid,
                            ]}>
                              <Text style={styles.estimateStatusText}>
                                {estimate.status === 'paid' ? '✓ Paid' : estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.estimateCardDetails}>
                            <View style={styles.estimateDetailRow}>
                              <Text style={styles.estimateDetailLabel}>Total Amount:</Text>
                              <Text style={styles.estimateDetailValue}>
                                ${estimate.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Text>
                            </View>
                            <View style={styles.estimateDetailRow}>
                              <Text style={styles.estimateDetailLabel}>Created:</Text>
                              <Text style={styles.estimateDetailValue}>
                                {new Date(estimate.createdDate).toLocaleDateString()}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.estimateCardActions}>
                            {estimate.status === 'paid' ? (
                              <>
                                <CheckCircle size={16} color="#10B981" />
                                <Text style={[styles.estimateCardActionText, { color: '#6B7280' }]}>Already Paid</Text>
                              </>
                            ) : (
                              <>
                                <DollarSign size={16} color="#10B981" />
                                <Text style={styles.estimateCardActionText}>Create Payment Link</Text>
                              </>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </ScrollView>
              );
            })()}

            {isCreatingPaymentLink && (
              <View style={styles.loadingOverlay}>
                <Text style={styles.loadingText}>Creating payment link...</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPaymentRequestModal(false)}
                disabled={isCreatingPaymentLink}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Convert to Project Modal */}
      <Modal
        visible={showConvertToProjectModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowConvertToProjectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.paymentModalTitleContainer}>
                <CheckCircle size={24} color="#10B981" />
                <Text style={styles.modalTitle}>Convert to Project</Text>
              </View>
              <TouchableOpacity onPress={() => setShowConvertToProjectModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {(() => {
              const client = clients.find(c => c.id === selectedClientForConversion);
              if (!client) return null;

              // Show estimates that haven't been converted to projects yet (exclude approved/paid)
              const clientEstimates = estimates.filter(e =>
                e.status !== 'approved' && e.status !== 'paid'
              );

              return (
                <ScrollView style={styles.estimateListScroll} showsVerticalScrollIndicator={false}>
                  {clientEstimates.length === 0 ? (
                    <View style={styles.emptyEstimatesContainer}>
                      <Calculator size={48} color="#D1D5DB" />
                      <Text style={styles.emptyEstimatesTitle}>No Estimates Found</Text>
                      <Text style={styles.emptyEstimatesText}>
                        Create an estimate for {client.name} first before converting to a project.
                      </Text>
                      <TouchableOpacity
                        style={styles.createEstimateButton}
                        onPress={() => {
                          setShowConvertToProjectModal(false);
                          setSelectedClientForEstimate(client.id);
                          setShowEstimateTypeModal(true);
                        }}
                      >
                        <Plus size={20} color="#FFFFFF" />
                        <Text style={styles.createEstimateButtonText}>Create Estimate</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.selectEstimateText}>
                        Select an estimate to use for converting {client.name} to a project:
                      </Text>
                      {clientEstimates.map((estimate) => (
                        <TouchableOpacity
                          key={estimate.id}
                          style={styles.estimateCard}
                          onPress={() => handleConvertWithEstimate(estimate.id)}
                        >
                          <View style={styles.estimateCardHeader}>
                            <Text style={styles.estimateCardName}>{estimate.name}</Text>
                            <View style={[
                              styles.estimateStatusBadge,
                              estimate.status === 'approved' && styles.estimateStatusApproved,
                              estimate.status === 'sent' && styles.estimateStatusSent,
                              estimate.status === 'draft' && styles.estimateStatusDraft,
                              estimate.status === 'rejected' && styles.estimateStatusRejected,
                              estimate.status === 'paid' && styles.estimateStatusPaid,
                            ]}>
                              <Text style={styles.estimateStatusText}>
                                {estimate.status === 'paid' ? '✓ Paid' : estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.estimateCardDetails}>
                            <View style={styles.estimateDetailRow}>
                              <Text style={styles.estimateDetailLabel}>Total Amount:</Text>
                              <Text style={styles.estimateDetailValue}>
                                ${estimate.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Text>
                            </View>
                            <View style={styles.estimateDetailRow}>
                              <Text style={styles.estimateDetailLabel}>Created:</Text>
                              <Text style={styles.estimateDetailValue}>
                                {new Date(estimate.createdDate).toLocaleDateString()}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.estimateCardActions}>
                            <CheckCircle size={16} color="#10B981" />
                            <Text style={styles.estimateCardActionText}>Use This Estimate</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </ScrollView>
              );
            })()}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConvertToProjectModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 12,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  sidebar: {
    backgroundColor: '#E5E7EB',
    padding: 16,
  },
  sidebarItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#D1D5DB',
    borderRadius: 8,
    marginBottom: 8,
  },
  sidebarText: {
    fontSize: 14,
    color: '#1F2937',
  },
  statsSection: {
    marginTop: 24,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#1F2937',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  clientRow: {
    backgroundColor: '#DBEAFE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  clientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  followUpStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  followUpStatusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  clientEmail: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  clientAddress: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  clientPhone: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  clientSource: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  leadBadge: {
    backgroundColor: '#2563EB',
  },
  projectBadge: {
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  clientDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  clientCreatedDate: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  estimateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  estimateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  followUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  followUpButtonText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  setFollowUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  setFollowUpButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  nextFollowUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  nextFollowUpText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  convertButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  addForm: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginTop: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 12,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  clientListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedCount: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  selectAllText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500' as const,
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  smsButton: {
    backgroundColor: '#059669',
  },
  bulkActionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  clientRowHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  checkbox: {
    paddingTop: 2,
  },
  clientInfo: {
    flex: 1,
  },
  clientActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  recipientInfo: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  recipientLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500' as const,
  },
  recipientText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600' as const,
  },
  templateSection: {
    marginBottom: 16,
  },
  templateLabel: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
    fontWeight: '600' as const,
  },
  templateScroll: {
    flexGrow: 0,
  },
  templateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    marginRight: 8,
  },
  templateButtonText: {
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '500' as const,
  },
  messageInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 12,
  },
  messageBodyInput: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  tipText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontStyle: 'italic' as const,
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    marginBottom: 16,
    fontStyle: 'italic' as const,
  },
  attachmentSection: {
    marginBottom: 16,
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600' as const,
  },
  addAttachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  addAttachmentText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  attachmentList: {
    gap: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachmentName: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
  },
  removeAttachment: {
    padding: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '600' as const,
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  sendButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  estimateModalScroll: {
    maxHeight: 500,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  createEstimateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createEstimateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  estimateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  estimateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  estimateName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  estimateNameClickable: {
    color: '#2563EB',
    textDecorationLine: 'underline' as const,
  },
  estimateStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  draftBadge: {
    backgroundColor: '#E5E7EB',
  },
  sentBadge: {
    backgroundColor: '#DBEAFE',
  },
  approvedBadge: {
    backgroundColor: '#D1FAE5',
  },
  rejectedBadge: {
    backgroundColor: '#FEE2E2',
  },
  paidBadge: {
    backgroundColor: '#D1FAE5',
  },
  estimateStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  estimateTotal: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 4,
  },
  estimateDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  estimateItems: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  estimateWorkflow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  workflowTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  workflowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  workflowButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#F3F4F6',
  },
  workflowButtonCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  workflowButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  workflowButtonTextCompleted: {
    color: '#059669',
  },
  workflowSplit: {
    flexDirection: 'row',
    gap: 8,
  },
  workflowButtonHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  workflowButtonTextSmall: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  estimateTypeModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
  },
  estimateTypeDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  estimateTypeCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  estimateTypeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  estimateTypeContent: {
    flex: 1,
  },
  estimateTypeTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 6,
  },
  estimateTypeText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  aiModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 700,
    maxHeight: '90%',
    height: 600,
  },
  aiModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  aiMessagesContainer: {
    flex: 1,
    marginBottom: 16,
  },
  aiEmptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  aiEmptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  aiEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  aiSuggestions: {
    gap: 8,
    width: '100%',
  },
  aiSuggestionChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  aiSuggestionText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
  aiMessageGroup: {
    marginBottom: 16,
  },
  aiMessage: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
    maxWidth: '85%',
  },
  aiMessageUser: {
    backgroundColor: '#2563EB',
    alignSelf: 'flex-end',
  },
  aiMessageAssistant: {
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
  },
  aiMessageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  aiMessageTextUser: {
    color: '#FFFFFF',
  },
  aiMessageTextAssistant: {
    color: '#1F2937',
  },
  aiToolMessage: {
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  aiToolText: {
    fontSize: 13,
    color: '#92400E',
  },
  aiInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  aiInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
    maxHeight: 100,
  },
  aiSendButton: {
    backgroundColor: '#2563EB',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSendButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.5,
  },
  callAssistantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  callAssistantButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  callAssistantModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 700,
    maxHeight: '90%',
  },
  callAssistantTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callAssistantScroll: {
    flex: 1,
    marginVertical: 16,
  },
  callAssistantDescription: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  callAssistantDescText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  configSection: {
    marginBottom: 24,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  configTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  configDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 6,
    fontWeight: '500' as const,
  },
  configInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  activeStatusBadge: {
    backgroundColor: '#10B981',
  },
  inactiveStatusBadge: {
    backgroundColor: '#6B7280',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  toggleButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  questionItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  checkboxDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  featuresList: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  featuresTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#4B5563',
  },
  setupInfo: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  setupInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  saveConfigButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  saveConfigButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  callLogsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  callLogsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  callLogsModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 900,
    maxHeight: '90%',
    height: 700,
  },
  callLogsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callLogsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  callLogsCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  addCallLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  addCallLogText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  callLogsScroll: {
    flex: 1,
  },
  emptyCallLogs: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyCallLogsTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCallLogsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  callLogCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  callLogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  callLogIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  callLogMainInfo: {
    flex: 1,
  },
  callLogName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  callLogPhone: {
    fontSize: 13,
    color: '#6B7280',
  },
  callLogStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qualifiedBadge: {
    backgroundColor: '#D1FAE5',
  },
  notQualifiedBadge: {
    backgroundColor: '#FEE2E2',
  },
  callLogStatusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  callLogDetails: {
    gap: 8,
  },
  callLogDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  callLogDetailText: {
    fontSize: 13,
    color: '#4B5563',
  },
  callLogDuration: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 'auto',
  },
  callLogLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#4B5563',
  },
  callLogValue: {
    fontSize: 13,
    color: '#1F2937',
  },
  callLogNotes: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  callLogNotesLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#4B5563',
    marginBottom: 4,
  },
  callLogNotesText: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
  },
  callLogActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  callLogTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  callLogTagText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600' as const,
  },
  deleteCallLogButton: {
    marginLeft: 'auto',
    padding: 6,
  },
  callLogDetailModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  callLogDetailScroll: {
    flex: 1,
    marginVertical: 16,
  },
  callLogDetailSection: {
    marginBottom: 24,
  },
  callLogDetailSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  callLogDetailItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  callLogDetailLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    width: 120,
  },
  callLogDetailValue: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  qualificationScoreText: {
    fontWeight: '700' as const,
    color: '#10B981',
  },
  callLogFullNotes: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  callLogTranscript: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  callLogActionsList: {
    gap: 12,
  },
  callLogActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  callLogActionText: {
    fontSize: 14,
    color: '#1F2937',
  },
  followUpModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
  },
  followUpModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followUpModalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  dateInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
  },
  dateFormatHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 20,
    fontStyle: 'italic' as const,
  },
  quickDateButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  quickDateButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickDateButtonText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600' as const,
  },
  saveFollowUpButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  saveFollowUpButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  selectedDateDisplay: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  selectedDateLabel: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  selectedDateValue: {
    fontSize: 16,
    color: '#1E40AF',
    fontWeight: '700' as const,
  },
  calendarContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calendarNavText: {
    fontSize: 24,
    color: '#2563EB',
    fontWeight: '700' as const,
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  calendarDayEmpty: {
    width: '14.28%',
    aspectRatio: 1,
  },
  calendarDaySelected: {
    backgroundColor: '#2563EB',
  },
  calendarDayToday: {
    backgroundColor: '#DBEAFE',
  },
  calendarDayText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500' as const,
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  calendarDayTextToday: {
    color: '#2563EB',
    fontWeight: '700' as const,
  },
  calendarDayTextPast: {
    color: '#9CA3AF',
  },
  aiSuggestionsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FAF5FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  aiSuggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiSuggestionsTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#7C3AED',
  },
  aiSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  aiSuggestionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#8B5CF6',
    marginTop: 5,
  },
  aiClientSuggestionText: {
    flex: 1,
    fontSize: 12,
    color: '#6B21A8',
    lineHeight: 16,
  },
  inspectionVideosContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  inspectionVideosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  inspectionVideosTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1E40AF',
  },
  inspectionVideoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  videoInfo: {
    flex: 1,
    gap: 4,
  },
  videoStatus: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  videoDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  videoDuration: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic' as const,
  },
  viewVideoButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewVideoButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  pendingText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
  },
  metricsWidget: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  metricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  metricsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricsHeaderTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  metricsContent: {
    padding: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4B5563',
    marginBottom: 4,
    textAlign: 'center',
  },
  metricSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  revenueSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
  },
  revenueSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  revenueGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  revenueCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  revenueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  revenueSourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  revenueSourceText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  revenueAmount: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  revenueSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  inspectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#8B5CF6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  inspectionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  paymentModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
  },
  paymentModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  estimateListScroll: {
    marginVertical: 16,
  },
  selectEstimateText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  estimateCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  estimateCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F3F4F6',
  },
  estimateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  estimateCardName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
  },
  estimateStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  estimateStatusApproved: {
    backgroundColor: '#D1FAE5',
  },
  estimateStatusSent: {
    backgroundColor: '#DBEAFE',
  },
  estimateStatusDraft: {
    backgroundColor: '#FEF3C7',
  },
  estimateStatusRejected: {
    backgroundColor: '#FEE2E2',
  },
  estimateStatusPaid: {
    backgroundColor: '#D1FAE5',
  },
  estimateStatusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4B5563',
  },
  estimateCardDetails: {
    marginBottom: 12,
  },
  estimateDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  estimateDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  estimateDetailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  estimateCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  estimateCardActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  emptyEstimatesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEstimatesTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyEstimatesText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  createEstimateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createEstimateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  modalBody: {
    maxHeight: 400,
    paddingBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  sourceButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  sourceButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sourceButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  sourceButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  sourceButtonTextActive: {
    color: '#2563EB',
  },
});
