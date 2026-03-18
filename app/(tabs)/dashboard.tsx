import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { Search, Plus, X, Archive, FileText, CheckSquare, FolderOpen, Sparkles, AlertTriangle, Camera, MoreHorizontal, Pencil, PauseCircle, PlayCircle } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, G } from 'react-native-svg';
import { Project, Report, ProjectReportData } from '@/types';
import DailyTaskCard from '@/components/DailyTasks/DailyTaskCard';
import AddTaskModal from '@/components/DailyTasks/AddTaskModal';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '@/lib/upload-utils';


export default function DashboardScreen() {
  const { t } = useTranslation();
  const { projects, expenses, clockEntries, addProject, updateProject, addReport, reports, clients, updateClient, addClient, dailyLogs = [], company, estimates, updateEstimate, dailyTasks = [], loadDailyTasks, addDailyTask, updateDailyTask, deleteDailyTask, user, refreshReports, isLoading, isCompanyReloading } = useApp();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await Promise.all([refreshReports(), loadDailyTasks()]);
    setRefreshing(false);
  }, [refreshing, refreshReports, loadDailyTasks]);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [projectFilter, setProjectFilter] = useState<'active' | 'delayed' | 'completed' | 'archived'>('active');
  const [showImportOptions, setShowImportOptions] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>('');
  const [projectAddress, setProjectAddress] = useState<string>('');
  const [projectBudget, setProjectBudget] = useState<string>('');
  const [projectEmail, setProjectEmail] = useState<string>('');
  const [projectPhone, setProjectPhone] = useState<string>('');
  const [projectSource, setProjectSource] = useState<string>('');
  const [showReportMenu, setShowReportMenu] = useState<boolean>(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [showReportTypeMenu, setShowReportTypeMenu] = useState<boolean>(false);
  const [reportType, setReportType] = useState<'administrative' | 'expenses' | 'time-tracking' | 'daily-logs' | 'custom-ai'>('administrative');
  const [showAICustomModal, setShowAICustomModal] = useState<boolean>(false);
  const [aiReportPrompt, setAiReportPrompt] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [showProjectPicker, setShowProjectPicker] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);
  const [coverPhotoUri, setCoverPhotoUri] = useState<string>('');
  const [isUploadingCover, setIsUploadingCover] = useState<boolean>(false);
  const [reportGenerationProgress, setReportGenerationProgress] = useState<{ current: number; total: number; projectName: string }>({ current: 0, total: 0, projectName: '' });
  const [showClientPickerModal, setShowClientPickerModal] = useState<boolean>(false);
  const [showEstimatePickerModal, setShowEstimatePickerModal] = useState<boolean>(false);
  const [selectedClientForConversion, setSelectedClientForConversion] = useState<string | null>(null);

  // ===== PROJECT ACTIONS STATE =====
  const [showProjectActionsModal, setShowProjectActionsModal] = useState<boolean>(false);
  const [selectedProjectForActions, setSelectedProjectForActions] = useState<Project | null>(null);

  // ===== EDIT CLIENT STATE (Dashboard) =====
  const [showDashEditClientModal, setShowDashEditClientModal] = useState<boolean>(false);
  const [dashEditClientId, setDashEditClientId] = useState<string | null>(null);
  const [dashEditClientName, setDashEditClientName] = useState<string>('');
  const [dashEditClientEmail, setDashEditClientEmail] = useState<string>('');
  const [dashEditClientPhone, setDashEditClientPhone] = useState<string>('');
  const [dashEditClientAddress, setDashEditClientAddress] = useState<string>('');
  const [dashEditClientSource, setDashEditClientSource] = useState<string>('');
  const [dashEditClientErrors, setDashEditClientErrors] = useState<{ name?: string; email?: string; phone?: string; source?: string }>({});
  const [isUpdatingDashClient, setIsUpdatingDashClient] = useState<boolean>(false);

  // ===== DAILY TASKS STATE =====
  const [showDailyTasksMenu, setShowDailyTasksMenu] = useState<boolean>(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState<boolean>(false);
  const [taskFilter, setTaskFilter] = useState<'today' | 'upcoming' | 'all'>('today');

  const activeProjects = projects.filter(p => p.status === 'active');
  const delayedProjects = projects.filter(p => p.status === 'on-hold');
  const completedProjects = projects.filter(p => p.status === 'completed');
  const archivedProjects = projects.filter(p => p.status === 'archived');

  const filteredActiveProjects = activeProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDelayedProjects = delayedProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCompletedProjects = completedProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredArchivedProjects = archivedProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayProjects =
    projectFilter === 'active' ? filteredActiveProjects :
    projectFilter === 'delayed' ? filteredDelayedProjects :
    projectFilter === 'completed' ? filteredCompletedProjects :
    filteredArchivedProjects;


  const totalBudget = activeProjects.reduce((sum, p) => sum + p.budget, 0);
  const totalSold = activeProjects.reduce((sum, p) => sum + (p.contractAmount ?? 0), 0);
  const totalExpenses = useMemo(() =>
    expenses.filter(e => activeProjects.some(p => p.id === e.projectId))
      .reduce((sum, e) => sum + e.amount, 0),
    [expenses, activeProjects]
  );

  // Monthly revenue for the last 8 months — grouped by project startDate.
  // Each bar = sum of contractAmount for all projects that started in that month.
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const allNonArchived = projects.filter(p => p.status !== 'archived');
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1);
      const monthNum = d.getMonth();
      const year = d.getFullYear();
      const revenue = allNonArchived
        .filter(p => {
          if (!p.startDate || !(p.contractAmount ?? 0)) return false;
          const sd = new Date(p.startDate);
          return sd.getMonth() === monthNum && sd.getFullYear() === year;
        })
        .reduce((sum, p) => sum + (p.contractAmount ?? 0), 0);
      const count = allNonArchived.filter(p => {
        if (!p.startDate || !(p.contractAmount ?? 0)) return false;
        const sd = new Date(p.startDate);
        return sd.getMonth() === monthNum && sd.getFullYear() === year;
      }).length;
      return {
        month: d.toLocaleString('default', { month: 'short' }),
        revenue,
        count,
      };
    });
  }, [projects]);

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1);

  const totalProjectsWithContract = useMemo(() =>
    activeProjects.filter(p => (p.contractAmount ?? 0) > 0).length,
    [activeProjects]
  );

  const projectExpenses = useMemo(() => {
    return activeProjects.map(project => ({
      id: project.id,
      name: project.name,
      amount: expenses.filter((e) => e.projectId === project.id).reduce((sum: number, e) => sum + e.amount, 0),
    }));
  }, [activeProjects, expenses]);

  // Helper for cross-platform alerts
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Validation helpers
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidUSPhone = (phone: string): boolean => {
    // Remove all non-numeric characters for validation
    const digitsOnly = phone.replace(/\D/g, '');
    // US phone should have 10 digits (or 11 with country code 1)
    return digitsOnly.length === 10 || (digitsOnly.length === 11 && digitsOnly.startsWith('1'));
  };

  const formatUSPhone = (value: string): string => {
    // Remove all non-numeric characters
    const digitsOnly = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (digitsOnly.length <= 3) {
      return digitsOnly;
    } else if (digitsOnly.length <= 6) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
    } else {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (value: string) => {
    // Only allow digits and formatting characters
    const formatted = formatUSPhone(value);
    setProjectPhone(formatted);
  };

  const handleBudgetChange = (value: string) => {
    // Only allow numbers and decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      setProjectBudget(parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setProjectBudget(cleaned);
    }
  };

  const handlePickCoverPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverPhotoUri(result.assets[0].uri);
    }
  };

  const uploadCoverPhoto = async (localUri: string): Promise<string> => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
    const urlRes = await fetch(`${apiUrl}/api/get-s3-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: `project-cover-${Date.now()}.jpg`,
        fileType: 'image/jpeg',
        companyId: company?.id,
      }),
    });
    const urlData = await urlRes.json();
    if (!urlData.uploadUrl) throw new Error('Failed to get upload URL');

    const compressed = await compressImage(localUri, { maxWidth: 1200, quality: 0.8 });
    const blob = await fetch(compressed.uri).then(r => r.blob());
    await fetch(urlData.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
    return urlData.fileUrl as string;
  };

  const handleCreateProject = async () => {
    // Validation
    if (!projectName.trim()) {
      showAlert('Error', 'Please enter a client/project name');
      return;
    }
    if (!projectEmail.trim()) {
      showAlert('Error', 'Please enter an email');
      return;
    }
    if (!isValidEmail(projectEmail)) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }
    if (!projectPhone.trim()) {
      showAlert('Error', 'Please enter a phone number');
      return;
    }
    if (!isValidUSPhone(projectPhone)) {
      showAlert('Error', 'Please enter a valid US phone number (10 digits)');
      return;
    }
    if (!projectBudget.trim()) {
      showAlert('Error', 'Please enter a budget');
      return;
    }
    const budgetNum = parseFloat(projectBudget);
    if (isNaN(budgetNum) || budgetNum < 0) {
      showAlert('Error', 'Please enter a valid budget amount');
      return;
    }

    if (!company?.id) {
      showAlert('Error', 'Company information not found. Please try again.');
      return;
    }

    setIsCreatingProject(true);

    try {
      // Upload cover photo if selected
      let coverImageUrl = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400';
      if (coverPhotoUri) {
        setIsUploadingCover(true);
        try {
          coverImageUrl = await uploadCoverPhoto(coverPhotoUri);
        } catch (e) {
          console.warn('[Dashboard] Cover photo upload failed, using default:', e);
        } finally {
          setIsUploadingCover(false);
        }
      }

      // Determine source
      const sourceValue = projectSource.trim() || 'Phone Call';
      const validSources = ['Google', 'Referral', 'Ad', 'Phone Call'];
      const finalSource = validSources.includes(sourceValue) ? sourceValue : 'Phone Call';

      // Check for existing client by email or phone
      const existingClient = clients.find(c =>
        c.email.toLowerCase() === projectEmail.toLowerCase() ||
        c.phone.replace(/\D/g, '') === projectPhone.replace(/\D/g, '')
      );

      let clientId: string;

      if (existingClient) {
        // Use existing client and update status to Project
        clientId = existingClient.id;
        updateClient(existingClient.id, { status: 'Project' });
      } else {
        // Create new client in database
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
        const clientResponse = await fetch(`${apiUrl}/api/add-client`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            name: projectName,
            address: projectAddress || null,
            email: projectEmail,
            phone: projectPhone,
            source: finalSource,
            status: 'Project',
          }),
        });

        if (!clientResponse.ok) {
          const errorData = await clientResponse.json();
          throw new Error(errorData.error || 'Failed to create client');
        }

        const clientResult = await clientResponse.json();
        if (!clientResult.success || !clientResult.client) {
          throw new Error('Failed to create client');
        }

        clientId = clientResult.client.id;

        // Add to local state
        addClient({
          id: clientResult.client.id,
          name: projectName,
          address: projectAddress || '',
          email: projectEmail,
          phone: projectPhone,
          source: finalSource as 'Google' | 'Referral' | 'Ad' | 'Phone Call',
          status: 'Project',
          lastContacted: '',
          notes: [],
        });
      }

      // Create project in database
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
      const projectResponse = await fetch(`${apiUrl}/api/add-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          name: projectName,
          budget: budgetNum,
          expenses: 0,
          progress: 0,
          status: 'active',
          image: coverImageUrl,
          hoursWorked: 0,
          startDate: new Date().toISOString(),
          clientId: clientId,
          address: projectAddress || null,
        }),
      });

      if (!projectResponse.ok) {
        const errorData = await projectResponse.json();
        throw new Error(errorData.error || 'Failed to create project');
      }

      const projectResult = await projectResponse.json();
      if (!projectResult.success || !projectResult.project) {
        throw new Error('Failed to create project');
      }

      // Add to local state
      const newProject: Project = {
        id: projectResult.project.id,
        name: projectResult.project.name,
        budget: projectResult.project.budget,
        expenses: projectResult.project.expenses,
        progress: projectResult.project.progress,
        status: projectResult.project.status,
        image: projectResult.project.image,
        hoursWorked: projectResult.project.hoursWorked,
        startDate: projectResult.project.startDate,
        clientId: projectResult.project.clientId,
        address: projectResult.project.address,
      };

      addProject(newProject);

      // Reset form
      setProjectName('');
      setProjectAddress('');
      setProjectEmail('');
      setProjectPhone('');
      setProjectSource('');
      setProjectBudget('');
      setCoverPhotoUri('');
      setShowCreateModal(false);
      showAlert('Success', 'Project created successfully!');
    } catch (error: any) {
      console.error('[Dashboard] Error creating project:', error);
      showAlert('Error', error.message || 'Failed to create project. Please try again.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  // ===== DAILY TASKS HELPERS =====
  const filteredTasks = useMemo(() => {
    if (!dailyTasks || !Array.isArray(dailyTasks)) return [];
    const today = new Date().toISOString().split('T')[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    switch (taskFilter) {
      case 'today':
        return dailyTasks.filter(t => t.dueDate === today);
      case 'upcoming':
        return dailyTasks.filter(t => t.dueDate >= today && t.dueDate <= weekEnd && !t.completed);
      case 'all':
        return [...dailyTasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      default:
        return dailyTasks;
    }
  }, [dailyTasks, taskFilter]);

  const formatTime = (timeStr: string): string => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleAddTaskSubmit = async (taskData: {
    title: string;
    dueDate: string;
    dueTime: string;
    dueDateTime: string;
    reminder: boolean;
    notes: string;
  }) => {
    await addDailyTask({
      ...taskData,
      completed: false,
      companyId: company?.id || '',
      userId: user?.id || '',
    });
  };

  const handleConvertEstimateToProject = async (estimateId: string) => {
    const client = clients.find(c => c.id === selectedClientForConversion);
    if (!client) return;

    const estimate = estimates.find(e => e.id === estimateId);
    if (!estimate) return;

    if (!company?.id) {
      showAlert('Error', 'Company information not found. Please try again.');
      return;
    }

    // Close modals
    setShowEstimatePickerModal(false);
    setShowClientPickerModal(false);
    setSelectedClientForConversion(null);

    setIsCreatingProject(true);

    try {
      // Create project in database - use direct API instead of tRPC for consistency
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
      const projectResponse = await fetch(`${apiUrl}/api/add-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          name: `${client.name} - ${estimate.name}`,
          budget: estimate.total,
          expenses: 0,
          progress: 0,
          status: 'active',
          image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
          hoursWorked: 0,
          startDate: new Date().toISOString(),
          estimateId: estimateId,
          clientId: client.id,
          address: client.address || null,
        }),
      });

      if (!projectResponse.ok) {
        const errorData = await projectResponse.json();
        throw new Error(errorData.error || 'Failed to create project');
      }

      const projectResult = await projectResponse.json();
      if (!projectResult.success || !projectResult.project) {
        throw new Error('Failed to create project');
      }

      // Add to local state
      const newProject: Project = {
        id: projectResult.project.id,
        name: projectResult.project.name,
        budget: projectResult.project.budget,
        expenses: projectResult.project.expenses,
        progress: projectResult.project.progress,
        status: projectResult.project.status,
        image: projectResult.project.image,
        hoursWorked: projectResult.project.hoursWorked,
        startDate: projectResult.project.startDate,
        endDate: projectResult.project.endDate,
        estimateId: projectResult.project.estimateId,
        clientId: projectResult.project.clientId,
        address: projectResult.project.address,
      };

      addProject(newProject);

      // Update estimate status to approved
      updateEstimate(estimateId, { status: 'approved' });

      // Update client status to Project
      updateClient(client.id, { status: 'Project' });

      // Show success message
      if (Platform.OS === 'web') {
        if (confirm(`Project created for ${client.name} using estimate "${estimate.name}"!\n\nWould you like to view the project now?`)) {
          router.push(`/project/${newProject.id}`);
        }
      } else {
        Alert.alert(
          'Success',
          `Project created for ${client.name} using estimate "${estimate.name}"!`,
          [
            { text: 'View Project', onPress: () => router.push(`/project/${newProject.id}`) },
            { text: 'OK' },
          ]
        );
      }
    } catch (error: any) {
      console.error('[Dashboard] Error converting to project:', error);
      showAlert('Error', error.message || 'Failed to create project. Please try again.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleAIReportGeneration = async (selectionType: 'all' | 'selected') => {
    if (selectionType === 'selected' && selectedProjects.length === 0) {
      showAlert('No Projects Selected', 'Please select at least one project to generate a report.');
      return;
    }

    if (!aiReportPrompt.trim()) {
      showAlert('Missing Instructions', 'Please describe what you want to include in the custom report.');
      return;
    }

    const projectsToReport = selectionType === 'all' 
      ? activeProjects 
      : activeProjects.filter(p => selectedProjects.includes(p.id));

    setIsGeneratingAI(true);

    try {
      const projectsData = projectsToReport.map(project => {
        const projectExpenses = expenses.filter(e => e.projectId === project.id);
        const projectClockEntries = clockEntries.filter(c => c.projectId === project.id);
        const projectLogs = Array.isArray(dailyLogs) ? dailyLogs.filter(log => log.projectId === project.id) : [];

        return {
          name: project.name,
          budget: project.budget,
          expenses: projectExpenses.reduce((sum, e) => sum + e.amount, 0),
          expensesList: projectExpenses.map(e => ({ type: e.type, amount: e.amount, date: e.date, store: e.store })),
          hoursWorked: project.hoursWorked,
          clockEntries: projectClockEntries.length,
          status: project.status,
          progress: project.progress,
          startDate: project.startDate,
          endDate: project.endDate,
          dailyLogsCount: projectLogs.length,
          dailyLogs: projectLogs.map(log => ({
            date: log.logDate,
            workPerformed: log.workPerformed,
            issues: log.issues,
            generalNotes: log.generalNotes,
            equipmentNote: log.equipmentNote,
            materialNote: log.materialNote,
            officialNote: log.officialNote,
            subsNote: log.subsNote,
            employeesNote: log.employeesNote,
            tasksCount: log.tasks?.length || 0,
            photosCount: log.photos?.length || 0,
          })),
        };
      });

      // Call the AI report generation API
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
      const response = await fetch(`${baseUrl}/api/generate-ai-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiReportPrompt,
          projectsData,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate AI report');
      }

      const generatedReport = result.report;

      const report: Report = {
        id: `report-${Date.now()}`,
        name: `Custom AI Report - ${aiReportPrompt.slice(0, 50)}${aiReportPrompt.length > 50 ? '...' : ''}`,
        type: 'custom',
        generatedDate: new Date().toISOString(),
        projectIds: projectsToReport.map(p => p.id),
        projectsCount: projectsToReport.length,
        notes: generatedReport,
      };

      addReport(report);

      console.log('[Report] Custom AI report generated');
      console.log('[Report] Prompt:', aiReportPrompt);
      console.log('[Report] Projects:', projectsToReport.length);

      // Reset state and navigate to reports
      setShowAICustomModal(false);
      setShowReportMenu(false);
      setShowReportTypeMenu(false);
      setIsSelectMode(false);
      setSelectedProjects([]);
      setAiReportPrompt('');
      setShowProjectPicker(false);
      router.push('/reports' as any);
    } catch (error) {
      console.error('[Report] AI generation error:', error);
      showAlert('Error', 'Failed to generate custom report. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleReportRequest = async (selectionType: 'all' | 'selected') => {
    if (selectionType === 'selected' && selectedProjects.length === 0) {
      Alert.alert('No Projects Selected', 'Please select at least one project to generate a report.');
      return;
    }

    const projectsToReport = selectionType === 'all'
      ? activeProjects
      : activeProjects.filter(p => selectedProjects.includes(p.id));

    if (projectsToReport.length === 0) {
      Alert.alert('No Projects', 'There are no active projects to generate a report for.');
      return;
    }

    // Start loading state
    setIsGeneratingReport(true);
    setReportGenerationProgress({ current: 0, total: projectsToReport.length, projectName: 'Initializing...' });

    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300));

    if (reportType === 'expenses') {
      const projectsExpensesData = [];

      for (let i = 0; i < projectsToReport.length; i++) {
        const project = projectsToReport[i];
        setReportGenerationProgress({ current: i + 1, total: projectsToReport.length, projectName: project.name });

        // Small delay to show progress for each project
        await new Promise(resolve => setTimeout(resolve, 100));

        const projectExpenses = expenses.filter(e => e.projectId === project.id);

        const expensesByCategory: { [category: string]: number } = {};
        projectExpenses.forEach(expense => {
          const category = expense.type || 'Uncategorized';
          expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
        });

        projectsExpensesData.push({
          projectId: project.id,
          projectName: project.name,
          budget: project.budget,
          expenses: projectExpenses.reduce((sum, e) => sum + e.amount, 0),
          hoursWorked: project.hoursWorked,
          clockEntries: 0,
          status: project.status,
          progress: project.progress,
          startDate: project.startDate,
          endDate: project.endDate,
          expensesByCategory,
        });
      }

      const overallExpensesByCategory: { [category: string]: number } = {};
      projectsExpensesData.forEach(project => {
        Object.entries(project.expensesByCategory).forEach(([category, amount]) => {
          overallExpensesByCategory[category] = (overallExpensesByCategory[category] || 0) + amount;
        });
      });

      const report: Report = {
        id: `report-${Date.now()}`,
        name: `Expenses Report - ${selectionType === 'all' ? 'All Projects' : `${projectsToReport.length} Selected Projects`}`,
        type: 'expenses',
        generatedDate: new Date().toISOString(),
        projectIds: projectsToReport.map(p => p.id),
        projectsCount: projectsToReport.length,
        totalExpenses: projectsExpensesData.reduce((sum, p) => sum + p.expenses, 0),
        projects: projectsExpensesData,
        expensesByCategory: overallExpensesByCategory,
      };

      await addReport(report);

      console.log('[Report] Generating expenses breakdown report for projects:', projectsToReport.map(p => p.name));

      // Reset state and navigate
      setIsGeneratingReport(false);
      setShowReportMenu(false);
      setShowReportTypeMenu(false);
      setIsSelectMode(false);
      setSelectedProjects([]);
      router.push('/reports' as any);
      return;
    }

    if (reportType === 'time-tracking') {
      setReportGenerationProgress({ current: 0, total: projectsToReport.length, projectName: 'Processing clock entries...' });

      const employeeDataMap: { [employeeId: string]: any } = {};

      for (let i = 0; i < projectsToReport.length; i++) {
        const project = projectsToReport[i];
        setReportGenerationProgress({ current: i + 1, total: projectsToReport.length, projectName: project.name });

        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 100));

        const projectClockEntries = clockEntries.filter(entry => entry.projectId === project.id);

        projectClockEntries.forEach(entry => {
          if (!employeeDataMap[entry.employeeId]) {
            employeeDataMap[entry.employeeId] = {
              employeeId: entry.employeeId,
              employeeName: `Employee ${entry.employeeId.slice(0, 8)}`,
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
      }

      const employeeData = Object.values(employeeDataMap).map((emp: any) => ({
        ...emp,
        totalDays: emp.clockEntries.length,
        averageHoursPerDay: emp.totalHours / (emp.clockEntries.length || 1),
      }));

      const report: Report = {
        id: `report-${Date.now()}`,
        name: `Time Tracking Report - ${selectionType === 'all' ? 'All Projects' : `${projectsToReport.length} Selected Projects`}`,
        type: 'time-tracking',
        generatedDate: new Date().toISOString(),
        projectIds: projectsToReport.map(p => p.id),
        projectsCount: projectsToReport.length,
        totalHours: employeeData.reduce((sum, emp) => sum + emp.totalHours, 0),
        employeeData,
        employeeIds: employeeData.map(emp => emp.employeeId),
      };

      await addReport(report);

      console.log('[Report] Generating time tracking report for projects:', projectsToReport.map(p => p.name));

      // Reset state and navigate
      setIsGeneratingReport(false);
      setShowReportMenu(false);
      setShowReportTypeMenu(false);
      setIsSelectMode(false);
      setSelectedProjects([]);
      router.push('/reports' as any);
      return;
    }

    if (reportType === 'daily-logs') {
      const projectDailyLogs = [];

      for (let i = 0; i < projectsToReport.length; i++) {
        const project = projectsToReport[i];
        setReportGenerationProgress({ current: i + 1, total: projectsToReport.length, projectName: project.name });

        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 100));

        const logs = Array.isArray(dailyLogs) ? dailyLogs.filter(log => log.projectId === project.id) : [];
        if (logs.length > 0) {
          projectDailyLogs.push({
            projectId: project.id,
            projectName: project.name,
            logs: logs,
          });
        }
      }

      const totalLogs = projectDailyLogs.reduce((sum, p) => sum + p.logs.length, 0);

      if (totalLogs === 0) {
        setIsGeneratingReport(false);
        Alert.alert('No Daily Logs', 'The selected project(s) have no daily logs to export.');
        return;
      }

      const report: Report = {
        id: `report-${Date.now()}`,
        name: `Daily Logs Report - ${selectionType === 'all' ? 'All Projects' : `${projectsToReport.length} Selected Projects`}`,
        type: 'custom',
        generatedDate: new Date().toISOString(),
        projectIds: projectsToReport.map(p => p.id),
        projectsCount: projectsToReport.length,
        notes: JSON.stringify({ dailyLogs: projectDailyLogs }),
      };

      await addReport(report);

      console.log('[Report] Generating daily logs report for projects:', projectsToReport.map(p => p.name));

      // Reset state and navigate
      setIsGeneratingReport(false);
      setShowReportMenu(false);
      setShowReportTypeMenu(false);
      setIsSelectMode(false);
      setSelectedProjects([]);
      router.push('/reports' as any);
      return;
    }

    const projectsData: ProjectReportData[] = [];

    for (let i = 0; i < projectsToReport.length; i++) {
      const project = projectsToReport[i];
      setReportGenerationProgress({ current: i + 1, total: projectsToReport.length, projectName: project.name });

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));

      const projectExpenses = expenses.filter(e => e.projectId === project.id);
      const projectClockEntries = clockEntries.filter(c => c.projectId === project.id);

      const expensesByCategory: { [category: string]: number } = {};
      projectExpenses.forEach(expense => {
        const category = expense.type || 'Uncategorized';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
      });

      projectsData.push({
        projectId: project.id,
        projectName: project.name,
        budget: project.budget,
        expenses: projectExpenses.reduce((sum, e) => sum + e.amount, 0),
        hoursWorked: project.hoursWorked,
        clockEntries: projectClockEntries.length,
        status: project.status,
        progress: project.progress,
        startDate: project.startDate,
        endDate: project.endDate,
        expensesByCategory,
      });
    }

    const report: Report = {
      id: `report-${Date.now()}`,
      name: `Administrative Report - ${selectionType === 'all' ? 'All Projects' : `${projectsToReport.length} Selected Projects`}`,
      type: 'administrative',
      generatedDate: new Date().toISOString(),
      projectIds: projectsToReport.map(p => p.id),
      projectsCount: projectsToReport.length,
      totalBudget: projectsToReport.reduce((sum, p) => sum + p.budget, 0),
      totalExpenses: projectsData.reduce((sum, p) => sum + p.expenses, 0),
      totalHours: projectsToReport.reduce((sum, p) => sum + p.hoursWorked, 0),
      projects: projectsData,
    };

    await addReport(report);

    console.log('[Report] Generating administrative report for projects:', projectsToReport.map(p => p.name));

    // Reset state and navigate
    setIsGeneratingReport(false);
    setShowReportMenu(false);
    setShowReportTypeMenu(false);
    setIsSelectMode(false);
    setSelectedProjects([]);
    router.push('/reports' as any);
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      }
      return [...prev, projectId];
    });
  };

  const openDashEditClientModal = (project: Project) => {
    const client = clients.find(c => c.id === project.clientId);
    if (!client) { Alert.alert('No Client', 'No client linked to this project.'); return; }
    setDashEditClientId(client.id);
    setDashEditClientName(client.name);
    setDashEditClientEmail(client.email);
    setDashEditClientPhone(client.phone.replace(/\D/g, '').slice(-10));
    setDashEditClientAddress(client.address || '');
    setDashEditClientSource(client.source);
    setDashEditClientErrors({});
    setShowProjectActionsModal(false);
    setShowDashEditClientModal(true);
  };

  const handleDashUpdateClient = async () => {
    const errors: typeof dashEditClientErrors = {};
    if (!dashEditClientName.trim()) errors.name = 'Name is required';
    if (!dashEditClientEmail.trim()) errors.email = 'Email is required';
    else if (!isValidEmail(dashEditClientEmail)) errors.email = 'Enter a valid email address';
    if (!dashEditClientPhone) errors.phone = 'Phone is required';
    else if (!isValidUSPhone(dashEditClientPhone)) errors.phone = 'Enter a valid 10-digit US phone number';
    if (!dashEditClientSource) errors.source = 'Select how they found you';
    if (Object.keys(errors).length > 0) { setDashEditClientErrors(errors); return; }
    if (!dashEditClientId) return;
    setIsUpdatingDashClient(true);
    try {
      const newName = dashEditClientName.trim();
      const oldName = clients.find(c => c.id === dashEditClientId)?.name ?? '';
      await updateClient(dashEditClientId, {
        name: newName,
        email: dashEditClientEmail.trim().toLowerCase(),
        phone: formatUSPhone(dashEditClientPhone),
        address: dashEditClientAddress.trim() || undefined,
        source: dashEditClientSource as 'Google' | 'Referral' | 'Ad' | 'Phone Call',
      });
      // Rename linked projects whose name starts with the old client name
      if (oldName && oldName !== newName) {
        projects
          .filter(p => p.clientId === dashEditClientId && p.name.startsWith(oldName))
          .forEach(p => updateProject(p.id, { name: newName + p.name.slice(oldName.length) }));
      }
      setShowDashEditClientModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update client.');
    } finally {
      setIsUpdatingDashClient(false);
    }
  };

  const handleDelayProject = (project: Project) => {
    const isOnHold = project.status === 'on-hold';
    updateProject(project.id, { status: isOnHold ? 'active' : 'on-hold' });
    setShowProjectActionsModal(false);
  };

  const pieChartData = useMemo(() => {
    const total = projectExpenses.reduce((sum, p) => sum + p.amount, 0);
    if (total === 0) return [];

    const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    let currentAngle = -90;

    return projectExpenses.map((proj, index) => {
      const percentage = (proj.amount / total) * 100;
      const angle = (proj.amount / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;

      return {
        id: proj.id,
        name: proj.name,
        amount: proj.amount,
        percentage,
        startAngle,
        angle,
        color: colors[index % colors.length],
      };
    });
  }, [projectExpenses]);

  // Check for task reminders every minute
  useEffect(() => {
    const checkReminders = async () => {
      try {
        const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
        const apiUrl = `${baseUrl}/api/check-task-reminders`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          console.error('[dashboard] Failed to check reminders:', response.status, errBody.slice(0, 300));
          return;
        }

        const data = await response.json();

        // Show notifications for reminded tasks
        if (data.remindedTasks && data.remindedTasks.length > 0) {
          for (const task of data.remindedTasks) {
            const timeStr = task.dueTime ? ` at ${formatTime(task.dueTime)}` : '';
            showAlert(
              'Task Reminder',
              `"${task.title}" is due${timeStr}`
            );

            // Update local state to reflect reminder was sent
            if (updateDailyTask) {
              await updateDailyTask(task.id, { reminderSent: true });
            }
          }
        }
      } catch (error) {
        console.error('[dashboard] Error checking reminders:', error);
      }
    };

    // Check immediately on mount
    checkReminders();

    // Then check every 60 seconds
    const intervalId = setInterval(checkReminders, 60000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [updateDailyTask]);

  if (isLoading || isCompanyReloading) {
    return <DashboardSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{t('dashboard.title')}</Text>
              <View style={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[styles.filterChip, projectFilter === 'active' && styles.filterChipActive]}
                  onPress={() => setProjectFilter('active')}
                >
                  <Text style={[styles.filterChipText, projectFilter === 'active' && styles.filterChipTextActive]}>
                    {t('dashboard.activeProjects')} ({activeProjects.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, projectFilter === 'delayed' && styles.filterChipActive, projectFilter === 'delayed' && { backgroundColor: '#F59E0B' }]}
                  onPress={() => setProjectFilter('delayed')}
                >
                  <PauseCircle size={14} color={projectFilter === 'delayed' ? '#FFFFFF' : '#F59E0B'} />
                  <Text style={[styles.filterChipText, projectFilter === 'delayed' && styles.filterChipTextActive]}>
                    Delayed ({delayedProjects.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, projectFilter === 'completed' && styles.filterChipActive]}
                  onPress={() => setProjectFilter('completed')}
                >
                  <Text style={[styles.filterChipText, projectFilter === 'completed' && styles.filterChipTextActive]}>
                    Completed ({completedProjects.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, projectFilter === 'archived' && styles.filterChipActive]}
                  onPress={() => setProjectFilter('archived')}
                >
                  <Archive size={16} color={projectFilter === 'archived' ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[styles.filterChipText, projectFilter === 'archived' && styles.filterChipTextActive]}>
                    {t('dashboard.archivedProjects')} ({archivedProjects.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowSearch(!showSearch)}
              >
                <Search size={20} color="#2563EB" />
              </TouchableOpacity>
              {/* Daily Tasks Button */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  if (loadDailyTasks) loadDailyTasks();
                  setShowDailyTasksMenu(true);
                }}
              >
                <CheckSquare size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowImportOptions(true)}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>{t('dashboard.addProject')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => setShowReportMenu(!showReportMenu)}
              >
                <FileText size={20} color="#2563EB" />
              </TouchableOpacity>

              {reports.length > 0 && (
                <TouchableOpacity
                  style={styles.reportsLibraryButton}
                  onPress={() => router.push('/reports' as any)}
                >
                  <FolderOpen size={20} color="#10B981" />
                  <View style={styles.reportsBadge}>
                    <Text style={styles.reportsBadgeText}>{reports.length}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {showSearch && (
          <View style={styles.searchContainer}>
            <Search size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('dashboard.searchProjects')}
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {showReportMenu && !showReportTypeMenu && (
          <View style={styles.reportMenu}>
            <View style={styles.reportMenuHeader}>
              <FileText size={20} color="#2563EB" />
              <Text style={styles.reportMenuTitle}>{t('dashboard.generateReport')}</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.reportMenuScroll}
              contentContainerStyle={styles.reportMenuScrollContent}
            >
              <TouchableOpacity
                style={styles.reportMenuItemHorizontal}
                onPress={() => {
                  setReportType('administrative');
                  setShowReportTypeMenu(true);
                }}
              >
                <FileText size={18} color="#2563EB" />
                <Text style={styles.reportMenuItemTextHorizontal}>Admin &{"\n"}Financial</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportMenuItemHorizontal}
                onPress={() => {
                  setReportType('expenses');
                  setShowReportTypeMenu(true);
                }}
              >
                <FileText size={18} color="#EF4444" />
                <Text style={styles.reportMenuItemTextHorizontal}>Expenses{"\n"}Breakdown</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportMenuItemHorizontal}
                onPress={() => {
                  setReportType('time-tracking');
                  setShowReportTypeMenu(true);
                }}
              >
                <FileText size={18} color="#F59E0B" />
                <Text style={styles.reportMenuItemTextHorizontal}>Time &{"\n"}Clocking</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportMenuItemHorizontal}
                onPress={() => {
                  setReportType('daily-logs');
                  setShowReportTypeMenu(true);
                }}
              >
                <FileText size={18} color="#8B5CF6" />
                <Text style={styles.reportMenuItemTextHorizontal}>Daily{"\n"}Logs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportMenuItemHorizontal, styles.reportMenuItemAI]}
                onPress={() => {
                  setReportType('custom-ai');
                  setShowAICustomModal(true);
                }}
              >
                <Sparkles size={18} color="#10B981" />
                <Text style={[styles.reportMenuItemTextHorizontal, { color: '#10B981' }]}>Custom AI{"\n"}Report</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {showReportMenu && showReportTypeMenu && (
          <View style={styles.reportMenu}>
            <View style={styles.reportMenuHeader}>
              <FileText size={20} color="#2563EB" />
              <Text style={styles.reportMenuTitle}>
                {reportType === 'administrative' ? 'Administrative & Financial' : 
                 reportType === 'expenses' ? 'Expenses Breakdown' :
                 reportType === 'time-tracking' ? 'Time Tracking & Clocking' : 'Daily Logs'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReportTypeMenu(false);
                  setIsSelectMode(false);
                  setSelectedProjects([]);
                }}
                style={{ marginLeft: 'auto' }}
              >
                <Text style={{ color: '#6B7280', fontSize: 14 }}>Back</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.reportMenuButtons}>
              <TouchableOpacity
                style={styles.reportMenuItem}
                onPress={() => handleReportRequest('all')}
              >
                <Text style={styles.reportMenuItemText}>All Active Projects</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportMenuItem}
                onPress={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) {
                    setSelectedProjects([]);
                  }
                }}
              >
                <Text style={styles.reportMenuItemText}>
                  {isSelectMode ? 'Cancel Selection' : 'Select Projects'}
                </Text>
              </TouchableOpacity>
              {isSelectMode && selectedProjects.length > 0 && (
                <TouchableOpacity
                  style={[styles.reportMenuItem, styles.reportMenuItemPrimary]}
                  onPress={() => handleReportRequest('selected')}
                >
                  <Text style={styles.reportMenuItemTextPrimary}>
                    Generate Report ({selectedProjects.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {displayProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <Archive size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>
              {projectFilter === 'archived'
                ? t('dashboard.noArchivedProjects')
                : projectFilter === 'completed'
                ? 'No completed projects yet'
                : projectFilter === 'delayed'
                ? 'No delayed projects'
                : t('dashboard.noActiveProjects')}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={Platform.OS === 'web'}
            decelerationRate="fast"
            snapToInterval={310}
            snapToAlignment="center"
            contentContainerStyle={styles.projectsCarousel}
            style={[styles.projectsCarouselContainer, Platform.OS === 'web' && styles.projectsCarouselWeb]}
          >
            {displayProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={[
                  styles.projectCard,
                  isSelectMode && selectedProjects.includes(project.id) && styles.projectCardSelected
                ]}
                onPress={() => {
                  if (isSelectMode) {
                    toggleProjectSelection(project.id);
                  } else {
                    router.push(`/project/${project.id}` as any);
                  }
                }}
              >
                {isSelectMode && (
                  <View style={styles.projectCheckbox}>
                    <CheckSquare
                      size={24}
                      color={selectedProjects.includes(project.id) ? '#10B981' : '#FFFFFF'}
                      fill={selectedProjects.includes(project.id) ? '#10B981' : 'transparent'}
                    />
                  </View>
                )}
                <Text style={styles.projectName}>{project.name}</Text>
                {(!project.contractAmount || project.contractAmount === 0) && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: '#FFF7ED', borderRadius: 6,
                    paddingHorizontal: 7, paddingVertical: 3,
                    marginBottom: 5, alignSelf: 'flex-start',
                    borderWidth: 1, borderColor: '#FED7AA',
                  }}>
                    <AlertTriangle size={9} color="#F97316" />
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#F97316' }}>No Contract Amount</Text>
                  </View>
                )}
                <Text style={styles.projectBudget}>Budget: ${project.budget.toLocaleString()}</Text>
                {project.status === 'on-hold' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 5, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FCD34D' }}>
                    <PauseCircle size={9} color="#D97706" />
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#D97706' }}>On Hold</Text>
                  </View>
                )}
                <Image
                  source={{ uri: project.image }}
                  style={styles.projectImage}
                  contentFit="cover"
                />
                {!isSelectMode && (
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16, padding: 5 }}
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedProjectForActions(project);
                      setShowProjectActionsModal(true);
                    }}
                  >
                    <MoreHorizontal size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>{t('dashboard.totalSold')}</Text>
            <Text style={styles.statValue}>${totalSold.toLocaleString()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>Monthly Revenue</Text>
              <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600' }}>
                {totalProjectsWithContract} contract{totalProjectsWithContract !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.chartContainer}>
              {monthlyRevenue.map((item, index) => {
                const height = (item.revenue / maxRevenue) * 100;
                return (
                  <View key={index} style={styles.barWrapper}>
                    {item.count > 0 && (
                      <Text style={{ fontSize: 8, color: '#10B981', fontWeight: '700', marginBottom: 2, textAlign: 'center' }}>
                        ${item.revenue >= 1000 ? `${(item.revenue / 1000).toFixed(0)}k` : item.revenue}
                      </Text>
                    )}
                    <View style={[styles.bar, { height: `${Math.max(height, item.count > 0 ? 4 : 0)}%`, backgroundColor: item.count > 0 ? '#10B981' : '#E5E7EB' }]} />
                    <Text style={styles.barLabel}>{item.month}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.totalBudgetRow}>
              <Text style={styles.totalBudgetLabel}>{t('dashboard.totalBudget')}</Text>
              <Text style={styles.totalBudgetValue}>${totalBudget.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statTitle}>{t('dashboard.expenses')}</Text>
            
            {pieChartData.length > 0 ? (
              <View style={styles.pieChartContainer}>
                <Svg width="180" height="180" viewBox="0 0 200 200">
                  <G>
                    {pieChartData.map((slice) => {
                      return (
                        <G key={slice.id}>
                          <Circle
                            cx="100"
                            cy="100"
                            r="90"
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="180"
                            strokeDasharray={`${(slice.angle / 360) * 565.48} 565.48`}
                            strokeDashoffset={-565.48 * ((slice.startAngle + 90) / 360)}
                            rotation="-90"
                            origin="100, 100"
                          />
                        </G>
                      );
                    })}
                  </G>
                </Svg>
                
                <View style={styles.legendContainer}>
                  {pieChartData.map((slice) => (
                    <View key={slice.id} style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: slice.color }]} />
                      <View style={styles.legendText}>
                        <Text style={styles.legendName} numberOfLines={1}>{slice.name}</Text>
                        <Text style={styles.legendValue}>
                          ${slice.amount.toLocaleString()} ({slice.percentage.toFixed(1)}%)
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyExpenses}>
                <Text style={styles.emptyExpensesText}>{t('dashboard.noExpenses')}</Text>
              </View>
            )}
            
            <View style={styles.expenseTotal}>
              <Text style={styles.expenseTotalLabel}>{t('dashboard.totalExpenses')}</Text>
              <Text style={styles.expenseTotalValue}>${totalExpenses.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showImportOptions}
        animationType="fade"
        transparent
        onRequestClose={() => setShowImportOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.importOptionsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('dashboard.addProject')}</Text>
              <TouchableOpacity onPress={() => setShowImportOptions(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.importDescription}>
              Choose how to add your project
            </Text>

            <TouchableOpacity
              style={styles.importOptionCard}
              onPress={() => {
                setShowImportOptions(false);
                setShowCreateModal(true);
              }}
            >
              <View style={styles.importIconContainer}>
                <Plus size={28} color="#2563EB" />
              </View>
              <View style={styles.importOptionContent}>
                <Text style={styles.importOptionTitle}>Create New Project</Text>
                <Text style={styles.importOptionText}>
                  Start from scratch with all project details
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.importOptionCard}
              onPress={() => {
                // Get clients that have at least one estimate
                const clientsWithEstimates = clients.filter(client =>
                  estimates.some(est => est.clientId === client.id)
                );

                if (clientsWithEstimates.length === 0) {
                  showAlert('No Estimates Available', 'Create estimates for clients in CRM first to import from there.');
                  return;
                }

                setShowImportOptions(false);
                setShowClientPickerModal(true);
              }}
            >
              <View style={styles.importIconContainer}>
                <FileText size={28} color="#10B981" />
              </View>
              <View style={styles.importOptionContent}>
                <Text style={styles.importOptionTitle}>Import from CRM</Text>
                <Text style={styles.importOptionText}>
                  Convert an existing lead to a project
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('projects.createNew')}</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('projects.name')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectName}
                    onChangeText={setProjectName}
                    placeholder="Enter client or project name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('projects.address')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectAddress}
                    onChangeText={setProjectAddress}
                    placeholder="Enter project address"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('forms.email')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectEmail}
                    onChangeText={setProjectEmail}
                    placeholder="Enter client email"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('forms.phone')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectPhone}
                    onChangeText={handlePhoneChange}
                    placeholder="(555) 555-5555"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={14}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('forms.source')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectSource}
                    onChangeText={setProjectSource}
                    placeholder="Google, Referral, Ad, Phone Call"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('projects.budget')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectBudget}
                    onChangeText={handleBudgetChange}
                    placeholder="Enter budget amount"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Cover Photo (optional)</Text>
                  <TouchableOpacity
                    style={styles.coverPhotoPickerButton}
                    onPress={handlePickCoverPhoto}
                  >
                    {coverPhotoUri ? (
                      <Image
                        source={{ uri: coverPhotoUri }}
                        style={styles.coverPhotoPreview}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.coverPhotoPlaceholder}>
                        <Camera size={28} color="#9CA3AF" />
                        <Text style={styles.coverPhotoPlaceholderText}>Tap to add a project photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.createButton, (isCreatingProject || isUploadingCover) && styles.createButtonDisabled]}
                  onPress={handleCreateProject}
                  disabled={isCreatingProject || isUploadingCover}
                >
                  {isCreatingProject || isUploadingCover ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.createButtonText}>{t('projects.createNew')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showAICustomModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAICustomModal(false);
          setShowProjectPicker(false);
          setSelectedProjects([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.aiModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={24} color="#10B981" />
                <Text style={styles.modalTitle}>Custom AI Report</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setShowAICustomModal(false);
                setAiReportPrompt('');
                setShowProjectPicker(false);
                setSelectedProjects([]);
              }}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.aiModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <Text style={styles.aiInstructionText}>
                  Describe what you want in your custom report. AI will analyze your project data and generate a comprehensive report based on your requirements.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Report Instructions</Text>
                  <TextInput
                    style={[styles.formInput, styles.aiTextArea]}
                    value={aiReportPrompt}
                    onChangeText={setAiReportPrompt}
                    placeholder="Example: Generate a summary of budget vs actual expenses with variance analysis and recommendations for cost savings..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </View>

                <Text style={styles.aiExampleTitle}>Quick Examples:</Text>
                <View style={styles.aiExamplesContainer}>
                  <TouchableOpacity
                    style={styles.aiExampleChip}
                    onPress={() => setAiReportPrompt('Analyze budget vs expenses with variance analysis and cost-saving recommendations')}
                  >
                    <Text style={styles.aiExampleText}>Budget variance analysis</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.aiExampleChip}
                    onPress={() => setAiReportPrompt('Provide project timeline analysis with progress insights and schedule recommendations')}
                  >
                    <Text style={styles.aiExampleText}>Timeline & progress analysis</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.aiExampleChip}
                    onPress={() => setAiReportPrompt('Compare project performance metrics across all selected projects')}
                  >
                    <Text style={styles.aiExampleText}>Performance comparison</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.aiExampleChip}
                    onPress={() => setAiReportPrompt('Generate executive summary with key metrics and action items')}
                  >
                    <Text style={styles.aiExampleText}>Executive summary</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.aiButtonsContainer}>
                  <TouchableOpacity
                    style={styles.aiSecondaryButton}
                    onPress={() => {
                      setShowProjectPicker(!showProjectPicker);
                      if (showProjectPicker) {
                        setSelectedProjects([]);
                      }
                    }}
                  >
                    <Text style={styles.aiSecondaryButtonText}>
                      {showProjectPicker ? 'Hide Projects' : 'Select Specific Projects'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.aiGenerateButton, isGeneratingAI && styles.aiGenerateButtonDisabled]}
                    onPress={() => handleAIReportGeneration(selectedProjects.length > 0 ? 'selected' : 'all')}
                    disabled={isGeneratingAI}
                  >
                    {isGeneratingAI ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.aiGenerateButtonText}>Generating...</Text>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} color="#FFFFFF" />
                        <Text style={styles.aiGenerateButtonText}>
                          Generate Report {selectedProjects.length > 0 ? `(${selectedProjects.length} Projects)` : '(All Projects)'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Project Picker List */}
                {showProjectPicker && (
                  <View style={styles.aiProjectPickerContainer}>
                    <Text style={styles.aiProjectPickerTitle}>
                      Select Projects ({selectedProjects.length} selected)
                    </Text>
                    <ScrollView style={styles.aiProjectPickerList} nestedScrollEnabled>
                      {activeProjects.map(project => (
                        <TouchableOpacity
                          key={project.id}
                          style={[
                            styles.aiProjectPickerItem,
                            selectedProjects.includes(project.id) && styles.aiProjectPickerItemSelected
                          ]}
                          onPress={() => {
                            setSelectedProjects(prev =>
                              prev.includes(project.id)
                                ? prev.filter(id => id !== project.id)
                                : [...prev, project.id]
                            );
                          }}
                        >
                          <View style={styles.aiProjectPickerCheckbox}>
                            {selectedProjects.includes(project.id) ? (
                              <CheckSquare size={20} color="#10B981" />
                            ) : (
                              <View style={styles.aiProjectPickerEmptyCheckbox} />
                            )}
                          </View>
                          <View style={styles.aiProjectPickerInfo}>
                            <Text style={styles.aiProjectPickerName}>{project.name}</Text>
                            <Text style={styles.aiProjectPickerDetails}>
                              Budget: ${project.budget.toLocaleString()} • {project.status}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TouchableOpacity
                      style={styles.aiSelectAllButton}
                      onPress={() => {
                        if (selectedProjects.length === activeProjects.length) {
                          setSelectedProjects([]);
                        } else {
                          setSelectedProjects(activeProjects.map(p => p.id));
                        }
                      }}
                    >
                      <Text style={styles.aiSelectAllButtonText}>
                        {selectedProjects.length === activeProjects.length ? 'Deselect All' : 'Select All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                <View style={styles.aiHelpTextContainer}>
                  <Text style={styles.aiHelpText}>
                    ✓ Generated reports will appear in the Reports Library
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Report Generation Loading Modal */}
      <Modal
        visible={isGeneratingReport}
        transparent
        animationType="fade"
      >
        <View style={styles.reportLoadingOverlay}>
          <View style={styles.reportLoadingCard}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.reportLoadingTitle}>Generating Report</Text>
            <Text style={styles.reportLoadingProgress}>
              Processing {reportGenerationProgress.current} of {reportGenerationProgress.total} projects
            </Text>
            <Text style={styles.reportLoadingProject}>
              {reportGenerationProgress.projectName}
            </Text>
            <View style={styles.reportLoadingProgressBar}>
              <View
                style={[
                  styles.reportLoadingProgressFill,
                  {
                    width: `${reportGenerationProgress.total > 0 ? (reportGenerationProgress.current / reportGenerationProgress.total) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Client Picker Modal for Import from CRM */}
      <Modal
        visible={showClientPickerModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowClientPickerModal(false);
          setSelectedClientForConversion(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Client</Text>
              <TouchableOpacity onPress={() => {
                setShowClientPickerModal(false);
                setSelectedClientForConversion(null);
              }}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.importDescription}>
                Select a client with estimates to convert to a project
              </Text>

              <ScrollView style={{ maxHeight: 400 }}>
                {clients
                  .filter(client => estimates.some(est => est.clientId === client.id))
                  .map(client => {
                    const clientEstimates = estimates.filter(est => est.clientId === client.id);
                    return (
                      <TouchableOpacity
                        key={client.id}
                        style={styles.importOptionCard}
                        onPress={() => {
                          setSelectedClientForConversion(client.id);
                          setShowClientPickerModal(false);
                          setShowEstimatePickerModal(true);
                        }}
                      >
                        <View style={styles.importIconContainer}>
                          <FileText size={24} color="#2563EB" />
                        </View>
                        <View style={styles.importOptionContent}>
                          <Text style={styles.importOptionTitle}>{client.name}</Text>
                          <Text style={styles.importOptionText}>
                            {clientEstimates.length} estimate{clientEstimates.length !== 1 ? 's' : ''} available
                          </Text>
                          {client.email && (
                            <Text style={[styles.importOptionText, { fontSize: 12, marginTop: 2 }]}>
                              {client.email}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Estimate Picker Modal */}
      <Modal
        visible={showEstimatePickerModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowEstimatePickerModal(false);
          setSelectedClientForConversion(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowEstimatePickerModal(false);
                  setShowClientPickerModal(true);
                }}
                style={{ marginRight: 12 }}
              >
                <Text style={{ fontSize: 24, color: '#6B7280' }}>←</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Estimate</Text>
              <TouchableOpacity onPress={() => {
                setShowEstimatePickerModal(false);
                setSelectedClientForConversion(null);
              }}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {selectedClientForConversion && (
                <>
                  <Text style={styles.importDescription}>
                    Select an estimate to convert to a project for{' '}
                    {clients.find(c => c.id === selectedClientForConversion)?.name}
                  </Text>

                  <ScrollView style={{ maxHeight: 400 }}>
                    {estimates
                      .filter(est => est.clientId === selectedClientForConversion)
                      .map(estimate => (
                        <TouchableOpacity
                          key={estimate.id}
                          style={styles.importOptionCard}
                          onPress={() => handleConvertEstimateToProject(estimate.id)}
                          disabled={isCreatingProject}
                        >
                          <View style={styles.importIconContainer}>
                            <FileText size={24} color="#10B981" />
                          </View>
                          <View style={styles.importOptionContent}>
                            <Text style={styles.importOptionTitle}>{estimate.name}</Text>
                            <Text style={styles.importOptionText}>
                              Total: ${estimate.total?.toFixed(2) || '0.00'}
                            </Text>
                            <Text style={[styles.importOptionText, { fontSize: 12, marginTop: 2 }]}>
                              {estimate.items?.length || 0} line items • Created {new Date(estimate.createdDate).toLocaleDateString()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== DAILY TASKS SIDE MENU ===== */}
      <Modal visible={showDailyTasksMenu} animationType="slide" transparent={true} onRequestClose={() => setShowDailyTasksMenu(false)}>
        <View style={styles.dailyTasksOverlay}>
          <TouchableOpacity style={styles.dailyTasksBackdrop} activeOpacity={1} onPress={() => setShowDailyTasksMenu(false)} />
          <View style={styles.dailyTasksMenu}>
            {/* Header */}
            <View style={styles.dailyTasksHeader}>
              <View>
                <Text style={styles.dailyTasksTitle}>Daily Tasks</Text>
                <Text style={styles.dailyTasksSubtitle}>
                  {dailyTasks?.length || 0} total • {dailyTasks?.filter(t => !t.completed).length || 0} pending
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addTaskButton}
                onPress={() => {
                  setShowDailyTasksMenu(false);
                  setTimeout(() => setShowAddTaskModal(true), 200);
                }}
              >
                <Plus size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.taskFilters}>
              {(['today', 'upcoming', 'all'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, taskFilter === filter && styles.filterChipActive]}
                  onPress={() => setTaskFilter(filter)}
                >
                  <Text style={[styles.filterText, taskFilter === filter && styles.filterTextActive]}>
                    {filter === 'today' ? 'Today' : filter === 'upcoming' ? 'This Week' : 'All Tasks'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Task List */}
            <ScrollView style={styles.taskList} contentContainerStyle={styles.taskListContent} showsVerticalScrollIndicator={false}>
              {filteredTasks.length === 0 ? (
                <View style={styles.emptyTasks}>
                  <CheckSquare size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTasksTitle}>No tasks</Text>
                  <Text style={styles.emptyTasksText}>
                    {taskFilter === 'today' ? 'No tasks for today' :
                     taskFilter === 'upcoming' ? 'No upcoming tasks this week' :
                     'Add your first task'}
                  </Text>
                </View>
              ) : (
                filteredTasks.map((task) => (
                  <DailyTaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={(task) => updateDailyTask(task.id, { completed: !task.completed })}
                    onDelete={(taskId) => deleteDailyTask(taskId)}
                  />
                ))
              )}
            </ScrollView>

            <TouchableOpacity style={styles.closeTasksButton} onPress={() => setShowDailyTasksMenu(false)}>
              <X size={20} color="#6B7280" />
              <Text style={styles.closeTasksText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== ADD TASK MODAL ===== */}
      <AddTaskModal
        visible={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onSubmit={handleAddTaskSubmit}
      />

      {/* ===== PROJECT ACTIONS MODAL ===== */}
      <Modal
        visible={showProjectActionsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProjectActionsModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowProjectActionsModal(false)}
        >
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingHorizontal: 20, paddingTop: 12 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
            {selectedProjectForActions && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 4 }}>
                  {selectedProjectForActions.name}
                </Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                  Status: {selectedProjectForActions.status === 'on-hold' ? 'On Hold' : selectedProjectForActions.status.charAt(0).toUpperCase() + selectedProjectForActions.status.slice(1)}
                </Text>

                {selectedProjectForActions.clientId && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}
                    onPress={() => openDashEditClientModal(selectedProjectForActions)}
                  >
                    <Pencil size={20} color="#2563EB" />
                    <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>Edit Client Info</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}
                  onPress={() => handleDelayProject(selectedProjectForActions)}
                >
                  {selectedProjectForActions.status === 'on-hold' ? (
                    <PlayCircle size={20} color="#10B981" />
                  ) : (
                    <PauseCircle size={20} color="#F59E0B" />
                  )}
                  <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>
                    {selectedProjectForActions.status === 'on-hold' ? 'Resume Project' : 'Delay Project'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}
                  onPress={() => { setShowProjectActionsModal(false); router.push(`/project/${selectedProjectForActions.id}` as any); }}
                >
                  <FolderOpen size={20} color="#6B7280" />
                  <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>View Project</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== EDIT CLIENT MODAL (Dashboard) ===== */}
      <Modal
        visible={showDashEditClientModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDashEditClientModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Client Info</Text>
              <TouchableOpacity onPress={() => setShowDashEditClientModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={[styles.modalInput, dashEditClientErrors.name ? styles.modalInputError : undefined]}
                placeholder="e.g. John Smith"
                placeholderTextColor="#9CA3AF"
                value={dashEditClientName}
                onChangeText={(text) => { setDashEditClientName(text); if (dashEditClientErrors.name) setDashEditClientErrors(e => ({ ...e, name: undefined })); }}
              />
              {dashEditClientErrors.name && <Text style={styles.fieldErrorText}>{dashEditClientErrors.name}</Text>}

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={[styles.modalInput, dashEditClientErrors.email ? styles.modalInputError : undefined]}
                placeholder="e.g. john@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={dashEditClientEmail}
                onChangeText={(text) => { setDashEditClientEmail(text); if (dashEditClientErrors.email) setDashEditClientErrors(e => ({ ...e, email: undefined })); }}
              />
              {dashEditClientErrors.email && <Text style={styles.fieldErrorText}>{dashEditClientErrors.email}</Text>}

              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                style={[styles.modalInput, dashEditClientErrors.phone ? styles.modalInputError : undefined]}
                placeholder="e.g. 5551234567"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={10}
                value={dashEditClientPhone}
                onChangeText={(text) => { setDashEditClientPhone(text.replace(/\D/g, '')); if (dashEditClientErrors.phone) setDashEditClientErrors(e => ({ ...e, phone: undefined })); }}
              />
              {dashEditClientErrors.phone && <Text style={styles.fieldErrorText}>{dashEditClientErrors.phone}</Text>}

              <Text style={styles.inputLabel}>Address (optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 123 Main St, Dallas, TX"
                placeholderTextColor="#9CA3AF"
                value={dashEditClientAddress}
                onChangeText={setDashEditClientAddress}
              />

              <Text style={styles.inputLabel}>How did they find you? *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {['Google', 'Referral', 'Ad', 'Phone Call'].map((source) => (
                  <TouchableOpacity
                    key={source}
                    style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: dashEditClientSource === source ? '#2563EB' : '#E5E7EB', backgroundColor: dashEditClientSource === source ? '#EFF6FF' : '#FFFFFF' }}
                    onPress={() => { setDashEditClientSource(source); if (dashEditClientErrors.source) setDashEditClientErrors(e => ({ ...e, source: undefined })); }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '500', color: dashEditClientSource === source ? '#2563EB' : '#6B7280' }}>{source}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {dashEditClientErrors.source && <Text style={styles.fieldErrorText}>{dashEditClientErrors.source}</Text>}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDashEditClientModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isUpdatingDashClient ? { opacity: 0.6 } : undefined]}
                onPress={handleDashUpdateClient}
                disabled={isUpdatingDashClient}
              >
                {isUpdatingDashClient ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Changes</Text>
                )}
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
    backgroundColor: '#F3F4F6',
  },
  reportLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportLoadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  reportLoadingTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  reportLoadingProgress: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  reportLoadingProject: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2563EB',
    marginBottom: 16,
    textAlign: 'center',
  },
  reportLoadingProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  reportLoadingProgressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'column',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    flexWrap: 'wrap',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  reportButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportsLibraryButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  reportsBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  reportsBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  reportMenu: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reportMenuTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  reportMenuButtons: {
    gap: 8,
  },
  reportMenuItem: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportMenuItemPrimary: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  reportMenuItemText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    textAlign: 'center',
  },
  reportMenuItemTextPrimary: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  reportMenuScroll: {
    maxHeight: 140,
  },
  reportMenuScrollContent: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  reportMenuItemHorizontal: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    gap: 8,
  },
  reportMenuItemAI: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  reportMenuItemTextHorizontal: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 16,
  },

  projectsCarouselContainer: {
    height: 280,
  },
  projectsCarouselWeb: {
    // @ts-ignore - Web-only CSS properties
    overflowX: 'auto',
    // @ts-ignore
    scrollbarWidth: 'thin',
    // @ts-ignore
    scrollbarColor: '#2563EB #F3F4F6',
    // @ts-ignore - WebKit browsers (Chrome, Safari, Edge)
    '::-webkit-scrollbar': {
      height: '8px',
    },
    // @ts-ignore
    '::-webkit-scrollbar-track': {
      background: '#F3F4F6',
      borderRadius: '4px',
    },
    // @ts-ignore
    '::-webkit-scrollbar-thumb': {
      background: '#2563EB',
      borderRadius: '4px',
    },
    // @ts-ignore
    '::-webkit-scrollbar-thumb:hover': {
      background: '#1E40AF',
    },
  },
  projectsCarousel: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  projectCard: {
    width: 280,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 16,
    height: 240,
    position: 'relative' as const,
  },
  projectCardSelected: {
    borderWidth: 3,
    borderColor: '#10B981',
  },
  projectCheckbox: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    zIndex: 10,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  projectBudget: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  projectImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  statsContainer: {
    flexDirection: 'column',
    padding: 16,
    gap: 16,
  },
  statCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  bar: {
    width: '80%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 6,
  },
  totalBudgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalBudgetLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  totalBudgetValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  pieChartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  legendContainer: {
    width: '100%',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    flex: 1,
  },
  legendName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  legendValue: {
    fontSize: 11,
    color: '#6B7280',
  },
  emptyExpenses: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyExpensesText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  expenseTotal: {
    alignItems: 'center',
  },
  expenseTotalLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  expenseTotalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalScrollView: {
    flex: 1,
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
  },
  importOptionsModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
  },
  importDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  importOptionCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  importIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  importOptionContent: {
    flex: 1,
  },
  importOptionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 6,
  },
  importOptionText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  createButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  aiModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '95%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  aiModalScroll: {
    flex: 1,
  },
  aiInstructionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  aiTextArea: {
    height: 120,
    paddingTop: 12,
  },
  aiExampleTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 8,
  },
  aiExamplesContainer: {
    marginBottom: 20,
  },
  aiExampleChip: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  aiExampleText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500' as const,
  },
  aiButtonsContainer: {
    gap: 12,
  },
  aiSecondaryButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  aiSecondaryButtonText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  aiGenerateButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  aiGenerateButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  aiGenerateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  aiHelpTextContainer: {
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  aiHelpText: {
    fontSize: 12,
    color: '#059669',
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  aiProjectPickerContainer: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  aiProjectPickerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  aiProjectPickerList: {
    maxHeight: 200,
  },
  aiProjectPickerItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  aiProjectPickerItemSelected: {
    backgroundColor: '#ECFDF5',
  },
  aiProjectPickerCheckbox: {
    width: 24,
    height: 24,
    marginRight: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  aiProjectPickerEmptyCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
  },
  aiProjectPickerInfo: {
    flex: 1,
  },
  aiProjectPickerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  aiProjectPickerDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  aiSelectAllButton: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center' as const,
  },
  aiSelectAllButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingVertical: 4,
  },
  // Daily Tasks Styles
  dailyTasksOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  dailyTasksBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dailyTasksMenu: {
    width: 340,
    maxWidth: '85%',
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  dailyTasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  dailyTasksTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  dailyTasksSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  addTaskButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskFilters: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  taskList: {
    flex: 1,
  },
  taskListContent: {
    padding: 16,
  },
  emptyTasks: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTasksTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptyTasksText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskCardCompleted: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
  },
  taskCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  taskNotes: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  deleteTaskButton: {
    padding: 8,
  },
  closeTasksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  closeTasksText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Add Task Modal Styles
  addTaskOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addTaskModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  addTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  addTaskTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  addTaskCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTaskForm: {
    padding: 20,
  },
  addTaskField: {
    marginBottom: 20,
  },
  addTaskLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  optional: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  addTaskInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  dateInputPlaceholder: {
    color: '#9CA3AF',
  },
  dateHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  reminderToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reminderIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reminderTextWrapper: {
    flex: 1,
  },
  reminderToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  reminderToggleHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  toggleSwitch: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D1D5DB',
    padding: 3,
  },
  toggleSwitchActive: {
    backgroundColor: '#10B981',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  addTaskTextArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  addTaskFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  addTaskCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTaskCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  addTaskSubmitBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addTaskSubmitBtnDisabled: {
    opacity: 0.5,
  },
  addTaskSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  timeInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
    minWidth: 60,
  },
  timePresets: {
    flexDirection: 'row',
    gap: 8,
  },
  timePresetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
  },
  timePresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  coverPhotoPickerButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverPhotoPreview: {
    width: '100%',
    height: 140,
  },
  coverPhotoPlaceholder: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
  },
  coverPhotoPlaceholderText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 4,
  },
  modalInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 4,
  },
  modalFooter: {
    flexDirection: 'row' as const,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
});
