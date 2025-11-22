import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Project, Client, Expense, Photo, Task, ClockEntry, Subscription, Estimate, CallLog, ChatConversation, ChatMessage, Report, ProjectFile, DailyLog, Payment, ChangeOrder, Company, Subcontractor, SubcontractorProposal, Notification } from '@/types';
import { PriceListItem, CustomPriceListItem, CustomCategory } from '@/mocks/priceList';
import { mockProjects, mockClients, mockExpenses, mockPhotos, mockTasks } from '@/mocks/data';
import { checkAndSeedData, getDefaultCompany, getDefaultUser } from '@/lib/seed-data';
import { fixtureClockEntries } from '@/mocks/fixtures';

interface AppState {
  user: User | null;
  company: Company | null;
  subscription: Subscription | null;
  projects: Project[];
  clients: Client[];
  expenses: Expense[];
  photos: Photo[];
  tasks: Task[];
  clockEntries: ClockEntry[];
  estimates: Estimate[];
  customPriceListItems: CustomPriceListItem[];
  customCategories: CustomCategory[];
  photoCategories: string[];
  callLogs: CallLog[];
  conversations: ChatConversation[];
  reports: Report[];
  projectFiles: ProjectFile[];
  dailyLogs: DailyLog[];
  payments: Payment[];
  changeOrders: ChangeOrder[];
  subcontractors: Subcontractor[];
  proposals: SubcontractorProposal[];
  notifications: Notification[];
  isLoading: boolean;
  
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setSubscription: (subscription: Subscription) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  archiveProject: (id: string) => Promise<void>;
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  addExpense: (expense: Expense) => void;
  addPhoto: (photo: Photo) => void;
  updatePhoto: (id: string, updates: Partial<Photo>) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  addClockEntry: (entry: ClockEntry) => void;
  updateClockEntry: (id: string, updates: Partial<ClockEntry>) => void;
  addEstimate: (estimate: Estimate) => void;
  updateEstimate: (id: string, updates: Partial<Estimate>) => void;
  deleteEstimate: (id: string) => void;
  addCustomPriceListItem: (item: CustomPriceListItem) => void;
  deleteCustomPriceListItem: (id: string) => void;
  addCustomCategory: (category: CustomCategory) => void;
  deleteCustomCategory: (id: string) => void;
  addPhotoCategory: (category: string) => void;
  updatePhotoCategory: (oldName: string, newName: string) => void;
  deletePhotoCategory: (category: string) => void;
  addCallLog: (log: CallLog) => void;
  updateCallLog: (id: string, updates: Partial<CallLog>) => void;
  deleteCallLog: (id: string) => void;
  addConversation: (conversation: ChatConversation) => void;
  addMessageToConversation: (conversationId: string, message: ChatMessage) => void;
  addReport: (report: Report) => void;
  deleteReport: (id: string) => void;
  addProjectFile: (file: ProjectFile) => void;
  updateProjectFile: (id: string, updates: Partial<ProjectFile>) => void;
  deleteProjectFile: (id: string) => void;
  addDailyLog: (log: DailyLog) => void;
  updateDailyLog: (id: string, updates: Partial<DailyLog>) => void;
  deleteDailyLog: (id: string) => void;
  addPayment: (payment: Payment) => Promise<void>;
  getPayments: (projectId?: string) => Payment[];
  addChangeOrder: (changeOrder: ChangeOrder) => Promise<void>;
  updateChangeOrder: (id: string, updates: Partial<ChangeOrder>) => Promise<void>;
  getChangeOrders: (projectId?: string) => ChangeOrder[];
  addSubcontractor: (subcontractor: Subcontractor) => Promise<void>;
  updateSubcontractor: (id: string, updates: Partial<Subcontractor>) => Promise<void>;
  getSubcontractors: () => Subcontractor[];
  addProposal: (proposal: SubcontractorProposal) => Promise<void>;
  getProposals: (projectId?: string) => SubcontractorProposal[];
  addNotification: (notification: Notification) => Promise<void>;
  getNotifications: (unreadOnly?: boolean) => Notification[];
  markNotificationRead: (id: string) => Promise<void>;
  logout: () => void;
}

export const [AppProvider, useApp] = createContextHook<AppState>(() => {
  const [user, setUserState] = useState<User | null>(null);
  const [company, setCompanyState] = useState<Company | null>(null);
  const [subscription, setSubscriptionState] = useState<Subscription | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [customPriceListItems, setCustomPriceListItems] = useState<CustomPriceListItem[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [photoCategories, setPhotoCategories] = useState<string[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [proposals, setProposals] = useState<SubcontractorProposal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (company && company.subscriptionStatus !== 'active' && company.subscriptionStatus !== 'trial') {
      console.warn('[Subscription] Company subscription is not active:', company.subscriptionStatus);
    }
  }, [company]);

  const safeJsonParse = <T,>(data: string | null, key: string, fallback: T): T => {
    if (!data || data === 'undefined' || data === 'null') {
      return fallback;
    }
    try {
      const parsed = JSON.parse(data);
      return parsed;
    } catch (error) {
      console.error(`Error parsing ${key}:`, error, 'Raw data:', data?.substring(0, 100));
      AsyncStorage.removeItem(key).catch(e => console.error(`Failed to remove ${key}:`, e));
      return fallback;
    }
  };

  const loadData = async () => {   try {
      await checkAndSeedData();
      
      const storedUser = await AsyncStorage.getItem('user');
      const storedCompany = await AsyncStorage.getItem('company');
      const storedSubscription = await AsyncStorage.getItem('subscription');
      const storedCustomItems = await AsyncStorage.getItem('customPriceListItems');
      const storedCustomCategories = await AsyncStorage.getItem('customCategories');
      const storedPhotoCategories = await AsyncStorage.getItem('photoCategories');
      const storedExpenses = await AsyncStorage.getItem('expenses');
      const storedConversations = await AsyncStorage.getItem('conversations');
      const storedReports = await AsyncStorage.getItem('reports');
      const storedProjectFiles = await AsyncStorage.getItem('projectFiles');
      const storedDailyLogs = await AsyncStorage.getItem('dailyLogs');
      const storedPayments = await AsyncStorage.getItem('payments');
      const storedChangeOrders = await AsyncStorage.getItem('changeOrders');
      const storedSubcontractors = await AsyncStorage.getItem('subcontractors');
      const storedProposals = await AsyncStorage.getItem('proposals');
      const storedNotifications = await AsyncStorage.getItem('notifications');
      
      const parsedUser = safeJsonParse<User | null>(storedUser, 'user', null);
      if (parsedUser && typeof parsedUser === 'object') {
        setUserState(parsedUser);
      }
      
      const parsedCompany = safeJsonParse<Company | null>(storedCompany, 'company', null);
      if (parsedCompany && typeof parsedCompany === 'object') {
        setCompanyState(parsedCompany);
      }
      
      const parsedSubscription = safeJsonParse<Subscription | null>(storedSubscription, 'subscription', null);
      if (parsedSubscription && typeof parsedSubscription === 'object') {
        setSubscriptionState(parsedSubscription);
      }
      
      const parsedCustomItems = safeJsonParse<CustomPriceListItem[]>(storedCustomItems, 'customPriceListItems', []);
      if (Array.isArray(parsedCustomItems)) {
        setCustomPriceListItems(parsedCustomItems);
      }

      const parsedCustomCategories = safeJsonParse<CustomCategory[]>(storedCustomCategories, 'customCategories', []);
      if (Array.isArray(parsedCustomCategories)) {
        setCustomCategories(parsedCustomCategories);
      }

      const defaultPhotoCategories = [
        'Foundation',
        'Framing',
        'Electrical',
        'Plumbing',
        'HVAC',
        'Drywall',
        'Painting',
        'Flooring',
        'Exterior',
        'Landscaping',
        'Other',
      ];
      const parsedPhotoCategories = safeJsonParse<string[]>(storedPhotoCategories, 'photoCategories', defaultPhotoCategories);
      if (Array.isArray(parsedPhotoCategories)) {
        setPhotoCategories(parsedPhotoCategories);
      }

      const parsedExpenses = safeJsonParse<Expense[]>(storedExpenses, 'expenses', mockExpenses);
      if (Array.isArray(parsedExpenses)) {
        setExpenses(parsedExpenses);
      } else {
        setExpenses(mockExpenses);
      }

      const parsedConversations = safeJsonParse<ChatConversation[]>(storedConversations, 'conversations', []);
      if (Array.isArray(parsedConversations)) {
        setConversations(parsedConversations);
      }

      const parsedReports = safeJsonParse<Report[]>(storedReports, 'reports', []);
      if (Array.isArray(parsedReports)) {
        setReports(parsedReports);
      }

      const parsedProjectFiles = safeJsonParse<ProjectFile[]>(storedProjectFiles, 'projectFiles', []);
      if (Array.isArray(parsedProjectFiles)) {
        setProjectFiles(parsedProjectFiles);
      }

      const parsedDailyLogs = safeJsonParse<DailyLog[]>(storedDailyLogs, 'dailyLogs', []);
      if (Array.isArray(parsedDailyLogs)) {
        setDailyLogs(parsedDailyLogs);
      }

      const parsedPayments = safeJsonParse<Payment[]>(storedPayments, 'payments', []);
      if (Array.isArray(parsedPayments)) {
        setPayments(parsedPayments);
      }

      const parsedChangeOrders = safeJsonParse<ChangeOrder[]>(storedChangeOrders, 'changeOrders', []);
      if (Array.isArray(parsedChangeOrders)) {
        setChangeOrders(parsedChangeOrders);
      }

      const parsedSubcontractors = safeJsonParse<Subcontractor[]>(storedSubcontractors, 'subcontractors', []);
      if (Array.isArray(parsedSubcontractors)) {
        setSubcontractors(parsedSubcontractors);
      }

      const parsedProposals = safeJsonParse<SubcontractorProposal[]>(storedProposals, 'proposals', []);
      if (Array.isArray(parsedProposals)) {
        setProposals(parsedProposals);
      }

      const parsedNotifications = safeJsonParse<Notification[]>(storedNotifications, 'notifications', []);
      if (Array.isArray(parsedNotifications)) {
        setNotifications(parsedNotifications);
      }
      
      setProjects(mockProjects);
      setClients(mockClients);
      setPhotos(mockPhotos);
      setTasks(mockTasks);
      setClockEntries(fixtureClockEntries);

      if (!storedUser) {
        const defaultUser = await getDefaultUser();
        setUserState(defaultUser);
        await AsyncStorage.setItem('user', JSON.stringify(defaultUser));
        console.log('[App] Loaded default user:', defaultUser.name);
      }

      if (!storedCompany) {
        const defaultCompany = await getDefaultCompany();
        setCompanyState(defaultCompany);
        await AsyncStorage.setItem('company', JSON.stringify(defaultCompany));
        console.log('[App] Loaded default company:', defaultCompany.name);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setUser = useCallback(async (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
    } else {
      await AsyncStorage.removeItem('user');
    }
  }, []);

  const setCompany = useCallback(async (newCompany: Company | null) => {
    setCompanyState(newCompany);
    if (newCompany) {
      await AsyncStorage.setItem('company', JSON.stringify(newCompany));
    } else {
      await AsyncStorage.removeItem('company');
    }
  }, []);

  const setSubscription = useCallback(async (newSubscription: Subscription) => {
    setSubscriptionState(newSubscription);
    await AsyncStorage.setItem('subscription', JSON.stringify(newSubscription));
  }, []);

  const addProject = useCallback((project: Project) => {
    setProjects(prev => [...prev, project]);
  }, []);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const archiveProject = useCallback(async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    console.log(`[Cloud Storage] Archiving project: ${project.name}`);
    console.log('[Cloud Storage] Collecting project data...');
    
    const projectData = {
      project,
      expenses: expenses.filter(e => e.projectId === id),
      photos: photos.filter(p => p.projectId === id),
      tasks: tasks.filter(t => t.projectId === id),
      clockEntries: clockEntries.filter(c => c.projectId === id),
      estimates: estimates.filter(e => e.projectId === id),
      archivedDate: new Date().toISOString(),
    };

    console.log(`[Cloud Storage] Archived ${projectData.expenses.length} expenses`);
    console.log(`[Cloud Storage] Archived ${projectData.photos.length} photos`);
    console.log(`[Cloud Storage] Archived ${projectData.tasks.length} tasks`);
    console.log(`[Cloud Storage] Archived ${projectData.clockEntries.length} clock entries`);
    console.log(`[Cloud Storage] Archived ${projectData.estimates.length} estimates`);
    
    await AsyncStorage.setItem(`archived_project_${id}`, JSON.stringify(projectData));
    console.log('[Cloud Storage] Project successfully archived to cloud storage');
    
    setProjects(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'archived' as const, endDate: new Date().toISOString() } : p
    ));
  }, [projects, expenses, photos, tasks, clockEntries, estimates]);

  const addClient = useCallback((client: Client) => {
    setClients(prev => [...prev, client]);
  }, []);

  const updateClient = useCallback((id: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const addExpense = useCallback(async (expense: Expense) => {
    const updated = [...expenses, expense];
    setExpenses(updated);
    await AsyncStorage.setItem('expenses', JSON.stringify(updated));
    console.log('[Expense] Added expense:', expense.amount, 'to project:', expense.projectId);
  }, [expenses]);

  const addPhoto = useCallback((photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
  }, []);

  const updatePhoto = useCallback((id: string, updates: Partial<Photo>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    console.log('[Photo] Updated photo:', id, 'with updates:', updates);
  }, []);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => [...prev, task]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const addClockEntry = useCallback((entry: ClockEntry) => {
    setClockEntries(prev => [...prev, entry]);
  }, []);

  const updateClockEntry = useCallback((id: string, updates: Partial<ClockEntry>) => {
    setClockEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const addEstimate = useCallback((estimate: Estimate) => {
    setEstimates(prev => [...prev, estimate]);
  }, []);

  const updateEstimate = useCallback((id: string, updates: Partial<Estimate>) => {
    setEstimates(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const deleteEstimate = useCallback((id: string) => {
    setEstimates(prev => prev.filter(e => e.id !== id));
  }, []);

  const addCustomPriceListItem = useCallback(async (item: CustomPriceListItem) => {
    const updated = [...customPriceListItems, item];
    setCustomPriceListItems(updated);
    await AsyncStorage.setItem('customPriceListItems', JSON.stringify(updated));
  }, [customPriceListItems]);

  const deleteCustomPriceListItem = useCallback(async (id: string) => {
    const updated = customPriceListItems.filter(item => item.id !== id);
    setCustomPriceListItems(updated);
    await AsyncStorage.setItem('customPriceListItems', JSON.stringify(updated));
  }, [customPriceListItems]);

  const addCustomCategory = useCallback(async (category: CustomCategory) => {
    const updated = [...customCategories, category];
    setCustomCategories(updated);
    await AsyncStorage.setItem('customCategories', JSON.stringify(updated));
  }, [customCategories]);

  const deleteCustomCategory = useCallback(async (id: string) => {
    const updated = customCategories.filter(cat => cat.id !== id);
    setCustomCategories(updated);
    await AsyncStorage.setItem('customCategories', JSON.stringify(updated));
    
    const updatedItems = customPriceListItems.filter(item => {
      const category = customCategories.find(cat => cat.id === id);
      return item.category !== category?.name;
    });
    setCustomPriceListItems(updatedItems);
    await AsyncStorage.setItem('customPriceListItems', JSON.stringify(updatedItems));
  }, [customCategories, customPriceListItems]);

  const addPhotoCategory = useCallback(async (category: string) => {
    if (photoCategories.includes(category)) {
      console.log('[PhotoCategory] Category already exists:', category);
      return;
    }
    const updated = [...photoCategories, category];
    setPhotoCategories(updated);
    await AsyncStorage.setItem('photoCategories', JSON.stringify(updated));
    console.log('[PhotoCategory] Added category:', category);
  }, [photoCategories]);

  const updatePhotoCategory = useCallback(async (oldName: string, newName: string) => {
    const updated = photoCategories.map(cat => cat === oldName ? newName : cat);
    setPhotoCategories(updated);
    await AsyncStorage.setItem('photoCategories', JSON.stringify(updated));
    
    const updatedPhotos = photos.map(p => p.category === oldName ? { ...p, category: newName } : p);
    setPhotos(updatedPhotos);
    console.log('[PhotoCategory] Updated category:', oldName, 'to', newName);
  }, [photoCategories, photos]);

  const deletePhotoCategory = useCallback(async (category: string) => {
    const updated = photoCategories.filter(cat => cat !== category);
    setPhotoCategories(updated);
    await AsyncStorage.setItem('photoCategories', JSON.stringify(updated));
    console.log('[PhotoCategory] Deleted category:', category);
  }, [photoCategories]);

  const addCallLog = useCallback((log: CallLog) => {
    setCallLogs(prev => [log, ...prev]);
  }, []);

  const updateCallLog = useCallback((id: string, updates: Partial<CallLog>) => {
    setCallLogs(prev => prev.map(log => log.id === id ? { ...log, ...updates } : log));
  }, []);

  const deleteCallLog = useCallback((id: string) => {
    setCallLogs(prev => prev.filter(log => log.id !== id));
  }, []);

  const addConversation = useCallback(async (conversation: ChatConversation) => {
    const updated = [...conversations, conversation];
    setConversations(updated);
    await AsyncStorage.setItem('conversations', JSON.stringify(updated));
  }, [conversations]);

  const addMessageToConversation = useCallback(async (conversationId: string, message: ChatMessage) => {
    const updated = conversations.map(conv => {
      if (conv.id === conversationId) {
        return {
          ...conv,
          messages: [...conv.messages, message],
          lastMessage: message,
        };
      }
      return conv;
    });
    setConversations(updated);
    await AsyncStorage.setItem('conversations', JSON.stringify(updated));
  }, [conversations]);

  const addReport = useCallback(async (report: Report) => {
    const updated = [report, ...reports];
    setReports(updated);
    await AsyncStorage.setItem('reports', JSON.stringify(updated));
    console.log('[Storage] Report saved successfully:', report.name);
  }, [reports]);

  const deleteReport = useCallback(async (id: string) => {
    const updated = reports.filter(r => r.id !== id);
    setReports(updated);
    await AsyncStorage.setItem('reports', JSON.stringify(updated));
    console.log('[Storage] Report deleted successfully');
  }, [reports]);

  const addProjectFile = useCallback(async (file: ProjectFile) => {
    const updated = [file, ...projectFiles];
    setProjectFiles(updated);
    await AsyncStorage.setItem('projectFiles', JSON.stringify(updated));
    console.log('[Storage] File saved successfully:', file.name);
  }, [projectFiles]);

  const updateProjectFile = useCallback(async (id: string, updates: Partial<ProjectFile>) => {
    const updated = projectFiles.map(f => f.id === id ? { ...f, ...updates } : f);
    setProjectFiles(updated);
    await AsyncStorage.setItem('projectFiles', JSON.stringify(updated));
    console.log('[Storage] File updated successfully');
  }, [projectFiles]);

  const deleteProjectFile = useCallback(async (id: string) => {
    const updated = projectFiles.filter(f => f.id !== id);
    setProjectFiles(updated);
    await AsyncStorage.setItem('projectFiles', JSON.stringify(updated));
    console.log('[Storage] File deleted successfully');
  }, [projectFiles]);

  const addDailyLog = useCallback(async (log: DailyLog) => {
    const updated = [log, ...dailyLogs];
    setDailyLogs(updated);
    await AsyncStorage.setItem('dailyLogs', JSON.stringify(updated));
    console.log('[Storage] Daily log saved successfully');
  }, [dailyLogs]);

  const updateDailyLog = useCallback(async (id: string, updates: Partial<DailyLog>) => {
    const updated = dailyLogs.map(log => log.id === id ? { ...log, ...updates } : log);
    setDailyLogs(updated);
    await AsyncStorage.setItem('dailyLogs', JSON.stringify(updated));
    console.log('[Storage] Daily log updated successfully');
  }, [dailyLogs]);

  const deleteDailyLog = useCallback(async (id: string) => {
    const updated = dailyLogs.filter(log => log.id !== id);
    setDailyLogs(updated);
    await AsyncStorage.setItem('dailyLogs', JSON.stringify(updated));
    console.log('[Storage] Daily log deleted successfully');
  }, [dailyLogs]);

  const addPayment = useCallback(async (payment: Payment) => {
    const updated = [payment, ...payments];
    setPayments(updated);
    await AsyncStorage.setItem('payments', JSON.stringify(updated));
    console.log('[Storage] Payment saved successfully:', payment.amount);

    const project = projects.find(p => p.id === payment.projectId);
    if (project) {
      const newExpenses = project.expenses + payment.amount;
      setProjects(prev => prev.map(p => 
        p.id === payment.projectId ? { ...p, expenses: newExpenses } : p
      ));
      console.log('[Project] Balance updated after payment');
    }
  }, [payments, projects]);

  const getPayments = useCallback((projectId?: string) => {
    if (!projectId) return payments;
    return payments.filter(p => p.projectId === projectId);
  }, [payments]);

  const addChangeOrder = useCallback(async (changeOrder: ChangeOrder) => {
    const updated = [changeOrder, ...changeOrders];
    setChangeOrders(updated);
    await AsyncStorage.setItem('changeOrders', JSON.stringify(updated));
    console.log('[Storage] Change order saved successfully:', changeOrder.description);

    if (changeOrder.status === 'approved') {
      const project = projects.find(p => p.id === changeOrder.projectId);
      if (project) {
        const newBudget = project.budget + changeOrder.amount;
        setProjects(prev => prev.map(p => 
          p.id === changeOrder.projectId ? { ...p, budget: newBudget } : p
        ));
        console.log('[Project] Budget increased by change order:', changeOrder.amount);
      }
    }
  }, [changeOrders, projects]);

  const updateChangeOrder = useCallback(async (id: string, updates: Partial<ChangeOrder>) => {
    const changeOrder = changeOrders.find(co => co.id === id);
    if (!changeOrder) return;

    const wasApproved = changeOrder.status === 'approved';
    const isBeingApproved = updates.status === 'approved' && !wasApproved;
    const isBeingRejected = updates.status === 'rejected' && wasApproved;

    const updated = changeOrders.map(co => co.id === id ? { ...co, ...updates } : co);
    setChangeOrders(updated);
    await AsyncStorage.setItem('changeOrders', JSON.stringify(updated));
    console.log('[Storage] Change order updated:', id);

    if (isBeingApproved) {
      const project = projects.find(p => p.id === changeOrder.projectId);
      if (project) {
        const newBudget = project.budget + changeOrder.amount;
        setProjects(prev => prev.map(p => 
          p.id === changeOrder.projectId ? { ...p, budget: newBudget } : p
        ));
        console.log('[Project] Budget increased by approved change order:', changeOrder.amount);
      }
    } else if (isBeingRejected) {
      const project = projects.find(p => p.id === changeOrder.projectId);
      if (project) {
        const newBudget = project.budget - changeOrder.amount;
        setProjects(prev => prev.map(p => 
          p.id === changeOrder.projectId ? { ...p, budget: newBudget } : p
        ));
        console.log('[Project] Budget decreased by rejected change order:', changeOrder.amount);
      }
    }
  }, [changeOrders, projects]);

  const getChangeOrders = useCallback((projectId?: string) => {
    if (!projectId) return changeOrders;
    return changeOrders.filter(co => co.projectId === projectId);
  }, [changeOrders]);

  const addSubcontractor = useCallback(async (subcontractor: Subcontractor) => {
    const updated = [subcontractor, ...subcontractors];
    setSubcontractors(updated);
    await AsyncStorage.setItem('subcontractors', JSON.stringify(updated));
    console.log('[Storage] Subcontractor saved successfully:', subcontractor.name);
  }, [subcontractors]);

  const updateSubcontractor = useCallback(async (id: string, updates: Partial<Subcontractor>) => {
    const updated = subcontractors.map(sub => sub.id === id ? { ...sub, ...updates } : sub);
    setSubcontractors(updated);
    await AsyncStorage.setItem('subcontractors', JSON.stringify(updated));
    console.log('[Storage] Subcontractor updated successfully');
  }, [subcontractors]);

  const getSubcontractors = useCallback(() => {
    return subcontractors;
  }, [subcontractors]);

  const addProposal = useCallback(async (proposal: SubcontractorProposal) => {
    const updated = [proposal, ...proposals];
    setProposals(updated);
    await AsyncStorage.setItem('proposals', JSON.stringify(updated));
    console.log('[Storage] Proposal saved successfully');

    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user?.id || 'user_current',
      type: 'proposal-submitted',
      title: 'New Proposal Received',
      message: `A subcontractor has submitted a proposal for ${proposal.amount}`,
      data: { proposalId: proposal.id, projectId: proposal.projectId },
      read: false,
      createdAt: new Date().toISOString(),
    };
    await addNotification(notification);
  }, [proposals, user]);

  const getProposals = useCallback((projectId?: string) => {
    if (!projectId) return proposals;
    return proposals.filter(p => p.projectId === projectId);
  }, [proposals]);

  const addNotification = useCallback(async (notification: Notification) => {
    const updated = [notification, ...notifications];
    setNotifications(updated);
    await AsyncStorage.setItem('notifications', JSON.stringify(updated));
    console.log('[Storage] Notification saved successfully');
  }, [notifications]);

  const getNotifications = useCallback((unreadOnly?: boolean) => {
    if (unreadOnly) {
      return notifications.filter(n => !n.read);
    }
    return notifications;
  }, [notifications]);

  const markNotificationRead = useCallback(async (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    await AsyncStorage.setItem('notifications', JSON.stringify(updated));
    console.log('[Storage] Notification marked as read');
  }, [notifications]);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(['user', 'company', 'subscription', 'conversations', 'reports', 'projectFiles', 'dailyLogs', 'payments', 'changeOrders', 'subcontractors', 'proposals', 'notifications']);
    setUserState(null);
    setCompanyState(null);
    setSubscriptionState(null);
    setConversations([]);
    setReports([]);
    setProjectFiles([]);
    setDailyLogs([]);
    setPayments([]);
    setChangeOrders([]);
    setSubcontractors([]);
    setProposals([]);
    setNotifications([]);
  }, []);

  return useMemo(() => ({
    user,
    company,
    subscription,
    projects,
    clients,
    expenses,
    photos,
    tasks,
    clockEntries,
    estimates,
    customPriceListItems,
    customCategories,
    photoCategories,
    callLogs,
    conversations,
    reports,
    projectFiles,
    dailyLogs,
    payments,
    changeOrders,
    subcontractors,
    proposals,
    notifications,
    isLoading,
    setUser,
    setCompany,
    setSubscription,
    addProject,
    updateProject,
    archiveProject,
    addClient,
    updateClient,
    addExpense,
    addPhoto,
    updatePhoto,
    addTask,
    updateTask,
    addClockEntry,
    updateClockEntry,
    addEstimate,
    updateEstimate,
    deleteEstimate,
    addCustomPriceListItem,
    deleteCustomPriceListItem,
    addCustomCategory,
    deleteCustomCategory,
    addPhotoCategory,
    updatePhotoCategory,
    deletePhotoCategory,
    addCallLog,
    updateCallLog,
    deleteCallLog,
    addConversation,
    addMessageToConversation,
    addReport,
    deleteReport,
    addProjectFile,
    updateProjectFile,
    deleteProjectFile,
    addDailyLog,
    updateDailyLog,
    deleteDailyLog,
    addPayment,
    getPayments,
    addChangeOrder,
    updateChangeOrder,
    getChangeOrders,
    addSubcontractor,
    updateSubcontractor,
    getSubcontractors,
    addProposal,
    getProposals,
    addNotification,
    getNotifications,
    markNotificationRead,
    logout,
  }), [
    user,
    company,
    subscription,
    projects,
    clients,
    expenses,
    photos,
    tasks,
    clockEntries,
    estimates,
    customPriceListItems,
    customCategories,
    photoCategories,
    callLogs,
    conversations,
    reports,
    projectFiles,
    dailyLogs,
    payments,
    changeOrders,
    subcontractors,
    proposals,
    notifications,
    isLoading,
    setUser,
    setCompany,
    setSubscription,
    addProject,
    updateProject,
    archiveProject,
    addClient,
    updateClient,
    addExpense,
    addPhoto,
    updatePhoto,
    addTask,
    updateTask,
    addClockEntry,
    updateClockEntry,
    addEstimate,
    updateEstimate,
    deleteEstimate,
    addCustomPriceListItem,
    deleteCustomPriceListItem,
    addCustomCategory,
    deleteCustomCategory,
    addPhotoCategory,
    updatePhotoCategory,
    deletePhotoCategory,
    addCallLog,
    updateCallLog,
    deleteCallLog,
    addConversation,
    addMessageToConversation,
    addReport,
    deleteReport,
    addProjectFile,
    updateProjectFile,
    deleteProjectFile,
    addDailyLog,
    updateDailyLog,
    deleteDailyLog,
    addPayment,
    getPayments,
    addChangeOrder,
    updateChangeOrder,
    getChangeOrders,
    addSubcontractor,
    updateSubcontractor,
    getSubcontractors,
    addProposal,
    getProposals,
    addNotification,
    getNotifications,
    markNotificationRead,
    logout,
  ]);
});
