import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Linking, Alert, Platform } from 'react-native';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Plus, Mail, MessageSquare, Send, X, CheckSquare, Square, Paperclip, FileText, Calculator, FileSignature, DollarSign, CheckCircle, CreditCard, ClipboardList, Sparkles, Phone, Settings, PhoneIncoming, PhoneOutgoing, Clock, Trash2, Calendar, ChevronDown, ChevronUp, TrendingUp, Users, FileCheck, DollarSign as DollarSignIcon, Camera } from 'lucide-react-native';
import { Project, Client, CallLog } from '@/types';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { useTwilioSMS, useTwilioCalls } from '@/components/TwilioIntegration';
import { trpc } from '@/lib/trpc';

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
  const { clients, addClient, addProject, updateClient, estimates, updateEstimate, callLogs, addCallLog, deleteCallLog } = useApp();
  const router = useRouter();
  const { sendSingleSMS, sendBulkSMSMessages, isLoading: isSendingSMS } = useTwilioSMS();
  const { initiateCall, isLoadingCall } = useTwilioCalls();
  const sendInspectionLinkMutation = trpc.crm.sendInspectionLink.useMutation();
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
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
  const [showFollowUpModal, setShowFollowUpModal] = useState<boolean>(false);
  const [selectedClientForFollowUp, setSelectedClientForFollowUp] = useState<string | null>(null);
  const [selectedFollowUpDate, setSelectedFollowUpDate] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [showMetricsWidget, setShowMetricsWidget] = useState<boolean>(false);
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
            leadsByOther: clients.filter(c => c.source === 'Other' && c.status === 'Lead').length,
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
          
          const clientEstimates = estimates.filter(est =>
            est.projectId.includes(client.name) || est.name.includes(client.name)
          );
          
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
          source: z.enum(['Google', 'Referral', 'Ad', 'Other', 'All']).optional().describe('Filter by lead source'),
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
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
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

  const createRegularEstimate = (clientId: string) => {
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

    addProject(newProject);
    setShowEstimateTypeModal(false);
    router.push(`/project/${newProject.id}/estimate`);
  };

  const createTakeoffEstimate = (clientId: string) => {
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

    addProject(newProject);
    setShowEstimateTypeModal(false);
    router.push(`/project/${newProject.id}/takeoff`);
  };



  const openEstimateActions = (clientId: string) => {
    setSelectedClientForEstimate(clientId);
    setShowEstimateModal(true);
  };

  const sendEstimate = (estimateId: string) => {
    const estimate = estimates.find(e => e.id === estimateId);
    if (!estimate) return;

    updateEstimate(estimateId, { status: 'sent' });
    const client = clients.find(c => c.id === selectedClientForEstimate);
    if (!client) return;

    const emailBody = `Hi ${client.name.split(' ')[0]},\n\nPlease find attached your estimate for ${estimate.name}.\n\nEstimate Total: ${estimate.total.toFixed(2)}\n\nPlease review and let us know if you have any questions.\n\nBest regards,\nLegacy Prime Construction`;
    const emailUrl = `mailto:${client.email}?subject=${encodeURIComponent(`Estimate: ${estimate.name}`)}&body=${encodeURIComponent(emailBody)}`;
    
    if (Platform.OS === 'web') {
      window.open(emailUrl, '_blank');
    } else {
      Linking.openURL(emailUrl).catch(() => {
        Alert.alert('Error', 'Unable to open email client');
      });
    }

    Alert.alert('Success', 'Estimate email prepared. Status updated to "Sent".');
    setShowEstimateModal(false);
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
    const estimate = estimates.find(e => e.id === estimateId);
    if (!estimate) return;

    const client = clients.find(c => c.id === selectedClientForEstimate);
    if (!client) return;

    Alert.alert(
      'Convert to Project',
      'Has the estimate been approved and signed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Convert',
          onPress: () => {
            const newProject: Project = {
              id: `project-${Date.now()}`,
              name: `${client.name} - ${estimate.name}`,
              budget: estimate.total,
              expenses: 0,
              progress: 0,
              status: 'active',
              image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
              hoursWorked: 0,
              startDate: new Date().toISOString(),
            };

            addProject(newProject);
            updateClient(client.id, { status: 'Project' });
            updateEstimate(estimateId, { status: 'approved' });

            Alert.alert(
              'Success',
              `${client.name} has been converted to a project and added to your dashboard!`,
              [{ text: 'OK', onPress: () => setShowEstimateModal(false) }]
            );
          },
        },
      ]
    );
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
    
    const clientEstimates = estimates.filter(est => 
      est.projectId.includes(client.name) || est.name.includes(client.name)
    );
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
      const followUpDate = new Date(client.nextFollowUpDate);
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

    Alert.alert(
      'Convert to Project',
      `Convert ${client.name} from Lead to Project?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: () => {
            const newProject: Project = {
              id: `project-${Date.now()}`,
              name: client.name,
              budget: 0,
              expenses: 0,
              progress: 0,
              status: 'active',
              image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
              hoursWorked: 0,
              startDate: new Date().toISOString(),
            };

            addProject(newProject);
            updateClient(client.id, { status: 'Project' });

            Alert.alert(
              'Success',
              `${client.name} has been converted to a project and added to your dashboard!`,
              [
                { text: 'View Projects', onPress: () => router.push('/dashboard') },
                { text: 'OK' },
              ]
            );
          },
        },
      ]
    );
  };

  const requestPayment = (estimateId?: string) => {
    const client = clients.find(c => c.id === selectedClientForEstimate);
    if (!client) return;

    let emailBody = '';
    let emailSubject = '';

    if (estimateId) {
      const estimate = estimates.find(e => e.id === estimateId);
      if (!estimate) return;

      emailSubject = `Payment Required: ${estimate.name}`;
      emailBody = `Hi ${client.name.split(' ')[0]},\n\nThank you for approving the estimate!\n\nProject: ${estimate.name}\nTotal Amount: ${estimate.total.toFixed(2)}\n\nTo begin work, we require payment. You can pay via:\n- Check\n- Wire Transfer\n- Credit Card\n\nPlease contact us to arrange payment.\n\nBest regards,\nLegacy Prime Construction\nPhone: (555) 123-4567`;
    } else {
      emailSubject = `Payment Request from Legacy Prime Construction`;
      emailBody = `Hi ${client.name.split(' ')[0]},\n\nWe are requesting payment for your project with Legacy Prime Construction.\n\nYou can pay via:\n- Check\n- Wire Transfer\n- Credit Card\n\nPlease contact us at (555) 123-4567 to arrange payment or if you have any questions.\n\nBest regards,\nLegacy Prime Construction`;
    }

    const emailUrl = `mailto:${client.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    if (Platform.OS === 'web') {
      window.open(emailUrl, '_blank');
    } else {
      Linking.openURL(emailUrl).catch(() => {
        Alert.alert('Error', 'Unable to open email client');
      });
    }

    Alert.alert('Success', 'Payment request sent!');
    if (estimateId) {
      setShowEstimateModal(false);
    }
  };

  const sendInspectionLink = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    try {
      console.log('[CRM] Sending inspection link to:', client.name, client.phone);
      
      const result = await sendInspectionLinkMutation.mutateAsync({
        clientName: client.name,
        clientPhone: client.phone,
        projectId: clientId,
      });

      if (result.success) {
        Alert.alert(
          'Inspection Link Sent',
          `We've sent an inspection link to ${client.name} at ${client.phone}.\n\nThe client will be able to record videos, take photos, and provide measurements. All data will be stored in their project folder and AI will generate a preliminary Scope of Work and estimate.`,
          [{ text: 'OK' }]
        );

        updateClient(clientId, { 
          lastContacted: new Date().toLocaleDateString(),
          lastContactDate: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error('[CRM] Error sending inspection link:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to send inspection link. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Legacy Prime CRM</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.callLogsButton}
              onPress={() => setShowCallLogsModal(true)}
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
              onPress={() => setShowAddForm(!showAddForm)}
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
          
          {clients.map((client) => (
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
                  <Text style={styles.clientDate}>Last contacted: {client.lastContactDate || client.lastContacted}</Text>
                  {client.nextFollowUpDate && (
                    <View style={styles.nextFollowUpRow}>
                      <Calendar size={14} color="#2563EB" />
                      <Text style={styles.nextFollowUpText}>Next Follow-Up: {new Date(client.nextFollowUpDate).toLocaleDateString()}</Text>
                    </View>
                  )}
                  
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
                  disabled={sendInspectionLinkMutation.isPending}
                >
                  <Camera size={16} color="#FFFFFF" />
                  <Text style={styles.inspectionButtonText}>
                    {sendInspectionLinkMutation.isPending ? 'Sending...' : 'Send Inspection Link'}
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
                    onPress={() => {
                      setSelectedClientForEstimate(client.id);
                      requestPayment();
                    }}
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
                placeholder="Source (Google, Referral, Ad, Other)" 
                placeholderTextColor="#9CA3AF"
                value={newClientSource}
                onChangeText={setNewClientSource}
              />
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={() => {
                  if (!newClientName || !newClientEmail || !newClientPhone || !newClientSource) {
                    Alert.alert('Error', 'Please fill in all required fields');
                    return;
                  }

                  const sourceValue = newClientSource as 'Google' | 'Referral' | 'Ad' | 'Other';
                  if (!['Google', 'Referral', 'Ad', 'Other'].includes(sourceValue)) {
                    Alert.alert('Error', 'Source must be one of: Google, Referral, Ad, Other');
                    return;
                  }

                  const newClient: Client = {
                    id: `client-${Date.now()}`,
                    name: newClientName,
                    address: newClientAddress || undefined,
                    email: newClientEmail,
                    phone: newClientPhone,
                    source: sourceValue,
                    status: 'Lead',
                    lastContacted: new Date().toLocaleDateString(),
                  };

                  addClient(newClient);
                  setNewClientName('');
                  setNewClientAddress('');
                  setNewClientEmail('');
                  setNewClientPhone('');
                  setNewClientSource('');
                  setShowAddForm(false);
                  Alert.alert('Success', 'Client added successfully!');
                }}
              >
                <Text style={styles.submitButtonText}>Add Client</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

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

                const clientEstimates = estimates.filter(est => 
                  est.projectId.includes(client.name) || est.name.includes(client.name)
                );

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
                      <Text style={styles.estimateName}>{estimate.name}</Text>
                      <View style={[
                        styles.estimateStatusBadge,
                        estimate.status === 'draft' && styles.draftBadge,
                        estimate.status === 'sent' && styles.sentBadge,
                        estimate.status === 'approved' && styles.approvedBadge,
                        estimate.status === 'rejected' && styles.rejectedBadge,
                      ]}>
                        <Text style={styles.estimateStatusText}>
                          {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
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
                        disabled={estimate.status !== 'draft'}
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

                      <View style={styles.workflowSplit}>
                        <TouchableOpacity 
                          style={styles.workflowButtonHalf}
                          onPress={() => convertToProject(estimate.id)}
                          disabled={estimate.status !== 'sent' && estimate.status !== 'approved'}
                        >
                          <CheckCircle size={18} color="#10B981" />
                          <Text style={styles.workflowButtonTextSmall}>Convert to Project</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.workflowButtonHalf}
                          onPress={() => requestPayment(estimate.id)}
                          disabled={estimate.status !== 'sent' && estimate.status !== 'approved'}
                        >
                          <DollarSign size={18} color="#F59E0B" />
                          <Text style={styles.workflowButtonTextSmall}>Request Payment</Text>
                        </TouchableOpacity>
                      </View>
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
              onPress={() => selectedClientForEstimate && createRegularEstimate(selectedClientForEstimate)}
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
              onPress={() => selectedClientForEstimate && createTakeoffEstimate(selectedClientForEstimate)}
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
                    callerName: 'Test Caller',
                    callerPhone: '+1234567890',
                    callerEmail: 'test@example.com',
                    callDate: new Date().toISOString(),
                    callDuration: '5:30',
                    callType: 'incoming',
                    status: 'answered',
                    isQualified: true,
                    qualificationScore: 85,
                    notes: 'Customer interested in kitchen remodel. Budget: $50,000. Wants to start in 2 months. Very serious about the project.',
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
                      source: 'Other',
                      status: 'Lead',
                      lastContacted: new Date().toLocaleDateString(),
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
              {callLogs.length === 0 ? (
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
});
