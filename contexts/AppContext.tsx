import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform, AppState as RNAppState } from 'react-native';
import { User, Project, Client, Expense, Photo, Task, DailyTask, ClockEntry, Subscription, Estimate, CallLog, ChatConversation, ChatMessage, Report, ProjectFile, DailyLog, Payment, ChangeOrder, Company, Subcontractor, SubcontractorProposal, Notification, ScheduledTask, DailyTaskReminder, ScheduleShareLink } from '@/types';
import { PriceListItem, CustomPriceListItem, CustomCategory } from '@/mocks/priceList';
import { mockProjects, mockClients, mockExpenses, mockPhotos, mockTasks } from '@/mocks/data';
import { checkAndSeedData, getDefaultCompany, getDefaultUser } from '@/lib/seed-data';
import { fixtureClockEntries } from '@/mocks/fixtures';
import { supabase } from '@/lib/supabase';

/**
 * Get the correct API base URL
 * Prioritizes environment variable over window.location.origin
 */
const PRODUCTION_URL = 'https://legacy-prime-workflow-suite.vercel.app';

const getApiBaseUrl = (): string => {
  const rorkApi = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (rorkApi) {
    return rorkApi;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return PRODUCTION_URL;
};

// Snake_case → camelCase mappers for Supabase rows
const mapClient = (row: any) => ({
  id: row.id, name: row.name, address: row.address, email: row.email,
  phone: row.phone, source: row.source, status: row.status,
  lastContacted: row.last_contacted ?? row.lastContacted ?? '',
  lastContactDate: row.last_contact_date ?? row.lastContactDate,
  nextFollowUpDate: row.next_follow_up_date ?? row.nextFollowUpDate,
  createdAt: row.created_at ?? row.createdAt,
});

const mapProject = (row: any) => ({
  id: row.id, name: row.name, budget: row.budget ?? 0, expenses: row.expenses ?? 0,
  progress: row.progress ?? 0, status: row.status, image: row.image ?? '',
  hoursWorked: row.hours_worked ?? row.hoursWorked ?? 0,
  startDate: row.start_date ?? row.startDate ?? '',
  endDate: row.end_date ?? row.endDate,
  estimateId: row.estimate_id ?? row.estimateId,
  clientId: row.client_id ?? row.clientId,
  contractAmount: row.contract_amount ?? row.contractAmount,
  address: row.address,
});

const mapPhoto = (row: any) => ({
  id: row.id, category: row.category ?? '', notes: row.notes ?? '', url: row.url ?? '',
  date: row.date ?? row.created_at ?? '',
  projectId: row.project_id ?? row.projectId ?? '',
  fileSize: row.file_size ?? row.fileSize,
  fileType: row.file_type ?? row.fileType,
  s3Key: row.s3_key ?? row.s3Key,
  compressed: row.compressed,
  uploadedBy: row.uploaded_by ?? row.uploadedBy,
});

const mapTask = (row: any) => ({
  id: row.id, name: row.name ?? '', date: row.date ?? '',
  reminder: row.reminder ?? '', completed: row.completed ?? false,
  projectId: row.project_id ?? row.projectId ?? '',
});

const mapClockEntry = (row: any) => ({
  id: row.id,
  employeeId: row.employee_id ?? row.employeeId ?? '',
  projectId: row.project_id ?? row.projectId ?? '',
  clockIn: row.clock_in ?? row.clockIn ?? '',
  clockOut: row.clock_out ?? row.clockOut,
  location: row.location ?? { latitude: 0, longitude: 0 },
  workPerformed: row.work_performed ?? row.workPerformed,
  category: row.category,
  lunchBreaks: row.lunch_breaks ?? row.lunchBreaks,
});

const mapPriceListItem = (row: any) => ({
  id: row.id, category: row.category ?? '', name: row.name ?? '',
  description: row.description ?? '', unit: row.unit ?? '',
  unitPrice: row.unit_price ?? row.unitPrice ?? 0,
  laborCost: row.labor_cost ?? row.laborCost,
  materialCost: row.material_cost ?? row.materialCost,
});

const mapNotification = (row: any) => ({
  id: row.id, type: row.type, title: row.title ?? '', message: row.message ?? '',
  data: row.data, read: row.read ?? false,
  userId: row.user_id ?? row.userId ?? '',
  companyId: row.company_id ?? row.companyId ?? '',
  createdAt: row.created_at ?? row.createdAt ?? '',
});

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
  priceListItems: PriceListItem[];
  priceListCategories: string[];
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
  dailyTasks: DailyTask[];
  scheduledTasks: ScheduledTask[];
  scheduleShareLinks: ScheduleShareLink[];
  dailyTaskReminders: DailyTaskReminder[];
  isLoading: boolean;

  loadScheduledTasks: (projectId: string) => Promise<void>;
  updateScheduledTasks: (tasks: ScheduledTask[]) => Promise<void>;
  addDailyTaskReminder: (task: Omit<DailyTaskReminder, 'id' | 'createdAt'>) => Promise<void>;
  updateDailyTaskReminder: (id: string, updates: Partial<DailyTaskReminder>) => Promise<void>;
  deleteDailyTaskReminder: (id: string) => Promise<void>;
  getDailyTaskReminders: (projectId?: string) => DailyTaskReminder[];
  generateShareLink: (projectId: string, password?: string, expiresAt?: string) => Promise<ScheduleShareLink>;
  disableShareLink: (token: string) => Promise<boolean>;
  regenerateShareLink: (projectId: string, password?: string, expiresAt?: string) => Promise<ScheduleShareLink>;
  getShareLinkByToken: (token: string) => ScheduleShareLink | undefined;
  getShareLinkByProject: (projectId: string) => ScheduleShareLink | undefined;

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
  updateCustomPriceListItem: (id: string, updates: Partial<PriceListItem>) => void;
  addCustomCategory: (category: CustomCategory) => void;
  deleteCustomCategory: (id: string) => void;
  addPhotoCategory: (category: string) => void;
  updatePhotoCategory: (oldName: string, newName: string) => void;
  deletePhotoCategory: (category: string) => void;
  addCallLog: (log: CallLog) => void;
  updateCallLog: (id: string, updates: Partial<CallLog>) => void;
  deleteCallLog: (id: string) => void;
  setCallLogs: (logs: CallLog[]) => void;
  addConversation: (conversation: ChatConversation) => void;
  addMessageToConversation: (conversationId: string, message: ChatMessage) => void;
  addReport: (report: Report) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  refreshReports: () => Promise<void>;
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
  deleteClient: (clientId: string) => Promise<void>;
  updateExpense: (expenseId: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  refreshClients: () => Promise<void>;
  refreshEstimates: () => Promise<void>;
  refreshExpenses: () => Promise<void>;
  refreshDailyLogs: () => Promise<void>;
  refreshPhotos: () => Promise<void>;
  refreshSubcontractors: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  loadDailyTasks: () => Promise<void>;
  addDailyTask: (task: Omit<DailyTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<DailyTask | undefined>;
  updateDailyTask: (taskId: string, updates: Partial<DailyTask>) => Promise<void>;
  deleteDailyTask: (taskId: string) => Promise<void>;
  logout: () => void;
}

/**
 * Helper function to convert local image URI to base64
 */
async function fetchLocalImageAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // Web: fetch blob and convert to base64
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Return base64 string (strip data URL prefix if present)
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // React Native: use expo-file-system
    const FileSystem = require('expo-file-system/legacy');
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
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
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([]);
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
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [scheduleShareLinks, setScheduleShareLinks] = useState<ScheduleShareLink[]>([]);
  const [dailyTaskReminders, setDailyTaskReminders] = useState<DailyTaskReminder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Compute categories dynamically from price list items
  const priceListCategories = useMemo(() => {
    // Preserve the original order from priceListItems (matches database sort_order)
    const categoryOrder: string[] = [];
    const seen = new Set<string>();

    // Add categories in the order they appear in priceListItems
    priceListItems.forEach(item => {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        categoryOrder.push(item.category);
      }
    });

    // Add custom categories at the end
    customCategories.forEach(cat => {
      if (!seen.has(cat.name)) {
        seen.add(cat.name);
        categoryOrder.push(cat.name);
      }
    });

    return categoryOrder;
  }, [priceListItems, customCategories]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (company && company.subscriptionStatus !== 'active' && company.subscriptionStatus !== 'trial') {
      console.warn('[Subscription] Company subscription is not active:', company.subscriptionStatus);
    }
  }, [company]);

  // Reload data when company changes (e.g., after login)
  useEffect(() => {
    if (company?.id && !isLoading) {
      console.log('[App] 🔄 Company changed, reloading data for:', company.id);

      // Call loadData again to reload all data from backend
      // We need to re-run the data loading logic after login
      (async () => {
        try {
          console.log('[App] Loading data from backend for company:', company.id);
          // Use direct HTTP fetch instead of tRPC dynamic import (which breaks in production)
          const baseUrl = getApiBaseUrl();

          // Load clients
          try {
            const { data: clientRows } = await supabase.from('clients').select('*').eq('company_id', company.id).order('name');
            setClients((clientRows ?? []).map(mapClient));
            console.log('[App] ✅ Loaded', clientRows?.length ?? 0, 'clients');
          } catch (error: any) {
            console.error('[App] ❌ Error loading clients:', error?.message || error);
            setClients([]);
          }

          // Load projects
          try {
            const { data: projectRows } = await supabase.from('projects').select('*').eq('company_id', company.id);
            setProjects((projectRows ?? []).map(mapProject));
            console.log('[App] ✅ Loaded', projectRows?.length ?? 0, 'projects');
          } catch (error: any) {
            console.error('[App] Error loading projects:', error?.message || error);
            setProjects([]);
          }

          // Load expenses
          try {
            const { data: expenseRows } = await supabase.from('expenses').select('*').eq('company_id', company.id).order('date', { ascending: false });
            setExpenses(expenseRows ?? []);
            console.log('[App] ✅ Loaded', expenseRows?.length ?? 0, 'expenses');
          } catch (error: any) {
            console.error('[App] Error loading expenses:', error?.message || error);
            setExpenses([]);
          }

          // Load photos
          try {
            const { data: photoRows } = await supabase.from('photos').select('*').eq('company_id', company.id).order('created_at', { ascending: false });
            setPhotos((photoRows ?? []).map(mapPhoto));
            console.log('[App] ✅ Loaded', photoRows?.length ?? 0, 'photos');
          } catch (error: any) {
            console.error('[App] Error loading photos:', error?.message || error);
            setPhotos([]);
          }

          // Load photo categories from database
          try {
            const { data: catRows } = await supabase.from('photo_categories').select('name').eq('company_id', company.id).order('name');
            setPhotoCategories((catRows ?? []).map((r: any) => r.name));
            console.log('[App] ✅ Loaded', catRows?.length ?? 0, 'photo categories');
          } catch (error: any) {
            console.error('[App] Error loading photo categories:', error?.message || error);
            setPhotoCategories([]);
          }

          // Load tasks
          try {
            const { data: taskRows } = await supabase.from('tasks').select('*').eq('company_id', company.id);
            setTasks((taskRows ?? []).map(mapTask));
            console.log('[App] ✅ Loaded', taskRows?.length ?? 0, 'tasks');
          } catch (error: any) {
            console.error('[App] Error loading tasks:', error?.message || error);
            setTasks([]);
          }

          // Load clock entries
          try {
            const { data: clockRows } = await supabase.from('clock_entries').select('*').eq('company_id', company.id).order('clock_in', { ascending: false });
            setClockEntries((clockRows ?? []).map(mapClockEntry));
            console.log('[App] ✅ Loaded', clockRows?.length ?? 0, 'clock entries');
          } catch (error: any) {
            console.error('[App] Error loading clock entries:', error?.message || error);
            setClockEntries([]);
          }

          // Load ALL price list items (master + custom)
          try {
            const { data: plRows } = await supabase.from('price_list_items').select('*').or(`is_custom.eq.false,company_id.eq.${company.id}`);
            setPriceListItems((plRows ?? []).map(mapPriceListItem));
            console.log('[App] ✅ Loaded', plRows?.length ?? 0, 'price list items');
          } catch (error: any) {
            console.error('[App] Error loading price list items:', error?.message || error);
            setPriceListItems([]);
          }

          // Load estimates
          try {
            const estimatesResponse = await fetch(`${baseUrl}/api/get-estimates?companyId=${company.id}`);
            if (estimatesResponse.ok) {
              const estimatesData = await estimatesResponse.json();
              if (estimatesData.success && estimatesData.estimates) {
                setEstimates(estimatesData.estimates);
                console.log('[App] ✅ Loaded', estimatesData.estimates.length, 'estimates');
              } else {
                setEstimates([]);
              }
            } else {
              setEstimates([]);
            }
          } catch (error: any) {
            console.error('[App] Error loading estimates:', error?.message || error);
            setEstimates([]);
          }

          // Load subcontractors
          try {
            const subcontractorsResponse = await fetch(
              `${baseUrl}/api/get-subcontractors?companyId=${company.id}`
            );
            if (subcontractorsResponse.ok) {
              const subcontractorsResult = await subcontractorsResponse.json();
              if (subcontractorsResult.subcontractors) {
                setSubcontractors(subcontractorsResult.subcontractors);
                console.log('[App] ✅ Loaded', subcontractorsResult.subcontractors.length, 'subcontractors');
              } else {
                setSubcontractors([]);
              }
            } else {
              console.error('[App] Error loading subcontractors:', subcontractorsResponse.status);
              setSubcontractors([]);
            }
          } catch (error: any) {
            console.error('[App] Error loading subcontractors:', error?.message || error);
            setSubcontractors([]);
          }

          // Load notifications
          try {
            const { data: notifRows, error: notifErr } = await supabase
              .from('notifications').select('*')
              .eq('user_id', user?.id ?? '')
              .eq('company_id', company.id)
              .order('created_at', { ascending: false }).limit(50);
            if (notifErr) {
              console.warn('[App] Notifications load error:', notifErr.message);
            } else {
              setNotifications(prev => {
                const dbIds = new Set((notifRows ?? []).map((n: any) => n.id));
                const localOnly = prev.filter((n: any) => !dbIds.has(n.id));
                return [...(notifRows ?? []).map(mapNotification), ...localOnly];
              });
              console.log('[App] ✅ Loaded', notifRows?.length ?? 0, 'notifications');
            }
          } catch (error: any) {
            console.error('[App] Error loading notifications:', error?.message || error);
          }

          console.log('[App] ✅ Finished reloading data after company change');
        } catch (error: any) {
          console.error('[App] ❌ Fatal error reloading data after company change:', error?.message || error);
        }
      })();
    }
  }, [company?.id, isLoading]);

  // Re-hydrate notifications from DB when the app returns to the foreground
  useEffect(() => {
    if (!user?.id || !company?.id) return;

    const baseUrl = getApiBaseUrl();

    const handleAppStateChange = (nextState: string) => {
      if (nextState === 'active') {
        supabase.from('notifications').select('*')
          .eq('user_id', user.id!).eq('company_id', company.id!)
          .order('created_at', { ascending: false }).limit(50)
          .then(({ data }) => {
            if (data?.length) {
              setNotifications(prev => {
                const dbIds = new Set(data.map((n: any) => n.id));
                const localOnly = prev.filter((n: any) => !dbIds.has(n.id));
                return [...data.map(mapNotification), ...localOnly];
              });
            }
          })
          .catch((err: any) => console.warn('[Notifications] AppState re-hydration failed:', err));
      }
    };

    const subscription = RNAppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user?.id, company?.id]);

  // Hydrate notifications from DB whenever user + company become available
  useEffect(() => {
    if (!user?.id || !company?.id) return;

    supabase.from('notifications').select('*')
      .eq('user_id', user.id!).eq('company_id', company.id!)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (data?.length) {
          setNotifications(prev => {
            const dbIds = new Set(data.map((n: any) => n.id));
            const localOnly = prev.filter((n: any) => !dbIds.has(n.id));
            return [...data.map(mapNotification), ...localOnly];
          });
          console.log('[App] ✅ Hydrated', data.length, 'notifications from DB');
        }
      })
      .catch((err: any) => console.warn('[Notifications] DB hydration failed (non-fatal):', err));
  }, [user?.id, company?.id]);

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
      const storedPriceListItems = await AsyncStorage.getItem('priceListItems');
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
      
      const parsedPriceListItems = safeJsonParse<PriceListItem[]>(storedPriceListItems, 'priceListItems', []);
      if (Array.isArray(parsedPriceListItems)) {
        setPriceListItems(parsedPriceListItems);
      }

      const parsedCustomCategories = safeJsonParse<CustomCategory[]>(storedCustomCategories, 'customCategories', []);
      if (Array.isArray(parsedCustomCategories)) {
        setCustomCategories(parsedCustomCategories);
      }

      // Photo categories are now loaded from database via loadPhotoCategories()
      // This will be called when company is loaded

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

      // Load all data from backend if company exists (reusing parsedCompany from above)
      if (parsedCompany && parsedCompany.id) {
        console.log('[App] Loading data from backend for company:', parsedCompany.id);
        try {
          // Use direct HTTP fetch instead of tRPC dynamic import (which breaks in production)
          const baseUrl = getApiBaseUrl();

          // Load clients
          try {
            const { data: clientRows } = await supabase.from('clients').select('*').eq('company_id', parsedCompany.id).order('name');
            setClients(clientRows?.length ? clientRows.map(mapClient) : mockClients);
            console.log('[App] Loaded', clientRows?.length ?? 0, 'clients');
          } catch (error) {
            console.error('[App] Error loading clients:', error);
            setClients(mockClients);
          }

          // Load projects
          try {
            const { data: projectRows } = await supabase.from('projects').select('*').eq('company_id', parsedCompany.id);
            setProjects(projectRows?.length ? projectRows.map(mapProject) : mockProjects);
            console.log('[App] Loaded', projectRows?.length ?? 0, 'projects');
          } catch (error) {
            console.error('[App] Error loading projects:', error);
            setProjects(mockProjects);
          }

          // Load expenses
          try {
            const { data: expenseRows } = await supabase.from('expenses').select('*').eq('company_id', parsedCompany.id).order('date', { ascending: false });
            setExpenses(expenseRows?.length ? expenseRows : mockExpenses);
            console.log('[App] Loaded', expenseRows?.length ?? 0, 'expenses');
          } catch (error) {
            console.error('[App] Error loading expenses:', error);
            setExpenses(mockExpenses);
          }

          // Load photos from database
          try {
            const { data: photoRows } = await supabase.from('photos').select('*').eq('company_id', parsedCompany.id).order('created_at', { ascending: false });
            setPhotos((photoRows ?? []).map(mapPhoto));
            console.log('[App] Loaded', photoRows?.length ?? 0, 'photos from database');
          } catch (error) {
            console.error('[App] Error loading photos:', error);
            setPhotos([]);
          }

          // Load photo categories from database
          try {
            const { data: catRows } = await supabase.from('photo_categories').select('name').eq('company_id', parsedCompany.id).order('name');
            setPhotoCategories((catRows ?? []).map((r: any) => r.name));
            console.log('[App] Loaded', catRows?.length ?? 0, 'photo categories from database');
          } catch (error) {
            console.error('[App] Error loading photo categories:', error);
            setPhotoCategories([]);
          }

          // Load clock entries from database
          try {
            const { data: clockRows } = await supabase.from('clock_entries').select('*').eq('company_id', parsedCompany.id).order('clock_in', { ascending: false });
            setClockEntries((clockRows ?? []).map(mapClockEntry));
            console.log('[App] Loaded', clockRows?.length ?? 0, 'clock entries from database');
          } catch (error) {
            console.error('[App] Error loading clock entries:', error);
            setClockEntries([]);
          }

          // Load tasks from database
          try {
            const { data: taskRows } = await supabase.from('tasks').select('*').eq('company_id', parsedCompany.id);
            setTasks((taskRows ?? []).map(mapTask));
            console.log('[App] Loaded', taskRows?.length ?? 0, 'tasks from database');
          } catch (error) {
            console.error('[App] Error loading tasks:', error);
            setTasks([]);
          }

          // Load ALL price list items from database (master + custom)
          try {
            const { data: plRows } = await supabase.from('price_list_items').select('*').or(`is_custom.eq.false,company_id.eq.${parsedCompany.id}`);
            if (plRows?.length) {
              setPriceListItems(plRows.map(mapPriceListItem));
              console.log('[App] Loaded', plRows.length, 'price list items from database');
            } else {
              const parsedPriceListItems = safeJsonParse<PriceListItem[]>(storedPriceListItems, 'priceListItems', []);
              if (Array.isArray(parsedPriceListItems)) setPriceListItems(parsedPriceListItems);
            }
          } catch (error) {
            console.error('[App] Error loading price list items:', error);
            const parsedPriceListItems = safeJsonParse<PriceListItem[]>(storedPriceListItems, 'priceListItems', []);
            if (Array.isArray(parsedPriceListItems)) setPriceListItems(parsedPriceListItems);
          }

          // Load subcontractors from database
          try {
            const subcontractorsResponse = await fetch(
              `${baseUrl}/api/get-subcontractors?companyId=${parsedCompany.id}`
            );
            if (subcontractorsResponse.ok) {
              const subcontractorsResult = await subcontractorsResponse.json();
              if (subcontractorsResult.subcontractors) {
                setSubcontractors(subcontractorsResult.subcontractors);
                console.log('[App] Loaded', subcontractorsResult.subcontractors.length, 'subcontractors from database');
              } else {
                // Fallback to AsyncStorage data
                const parsedSubcontractors = safeJsonParse<Subcontractor[]>(storedSubcontractors, 'subcontractors', []);
                if (Array.isArray(parsedSubcontractors)) {
                  setSubcontractors(parsedSubcontractors);
                }
              }
            } else {
              console.error('[App] Error loading subcontractors:', subcontractorsResponse.status);
              // Fallback to AsyncStorage data
              const parsedSubcontractors = safeJsonParse<Subcontractor[]>(storedSubcontractors, 'subcontractors', []);
              if (Array.isArray(parsedSubcontractors)) {
                setSubcontractors(parsedSubcontractors);
              }
            }
          } catch (error) {
            console.error('[App] Error loading subcontractors:', error);
            // Fallback to AsyncStorage data
            const parsedSubcontractors = safeJsonParse<Subcontractor[]>(storedSubcontractors, 'subcontractors', []);
            if (Array.isArray(parsedSubcontractors)) {
              setSubcontractors(parsedSubcontractors);
            }
          }

          // Load schedule share links for this company
          try {
            const slRes = await fetch(`${baseUrl}/api/get-schedule-share-link?companyId=${parsedCompany.id}`);
            if (slRes.ok) {
              const slData = await slRes.json();
              setScheduleShareLinks(slData.links ?? []);
              console.log('[App] Loaded', (slData.links ?? []).length, 'schedule share links');
            }
          } catch (error) {
            console.error('[App] Error loading schedule share links:', error);
          }

          // Load daily task reminders (all for company; filter applied in getDailyTaskReminders)
          try {
            const drRes = await fetch(`${baseUrl}/api/get-daily-tasks?companyId=${parsedCompany.id}`);
            if (drRes.ok) {
              const drData = await drRes.json();
              const reminders: DailyTaskReminder[] = (drData.tasks ?? []).map((t: any) => ({
                id: t.id,
                projectId: t.projectId ?? undefined,
                title: t.title,
                dueDate: t.dueDate,
                isReminder: t.reminder,
                completed: t.completed,
                createdAt: t.createdAt,
                completedAt: t.completedAt ?? undefined,
              }));
              setDailyTaskReminders(reminders);
              console.log('[App] Loaded', reminders.length, 'daily task reminders');
            }
          } catch (error) {
            console.error('[App] Error loading daily task reminders:', error);
          }

          // Load notifications for the current user
          if (parsedUser?.id) {
            try {
              const { data: notifRows, error: notifErr } = await supabase
                .from('notifications').select('*')
                .eq('user_id', parsedUser.id)
                .eq('company_id', parsedCompany.id)
                .order('created_at', { ascending: false }).limit(50);
              if (notifErr) {
                console.warn('[App] Notifications load error:', notifErr.message);
              } else {
                setNotifications(prev => {
                const dbIds = new Set((notifRows ?? []).map((n: any) => n.id));
                const localOnly = prev.filter((n: any) => !dbIds.has(n.id));
                return [...(notifRows ?? []).map(mapNotification), ...localOnly];
              });
                console.log('[App] Loaded', notifRows?.length ?? 0, 'notifications');
              }
            } catch (error) {
              console.error('[App] Error loading notifications:', error);
            }
          }

        } catch (error) {
          console.error('[App] Error loading data from backend:', error);
          // Set empty arrays on error
          setClients([]);
          setProjects([]);
          setExpenses([]);
          setPhotos([]);
          setTasks([]);
          setClockEntries([]);
        }
      } else {
        console.log('[App] No company found, setting empty data');
        // Set empty arrays when no company
        setClients([]);
        setProjects([]);
        setExpenses([]);
        setPhotos([]);
        setTasks([]);
        setClockEntries([]);
      }

      console.log('[App] User loaded:', storedUser ? 'Found' : 'Not found');
      console.log('[App] Company loaded:', storedCompany ? 'Found' : 'Not found');
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

  const addProject = useCallback(async (project: Project) => {
    // Optimistically update UI
    setProjects(prev => [...prev, project]);

    // Save to backend asynchronously (don't block UI)
    // Only sync if the project has a non-UUID ID (temporary frontend-only projects)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project.id);

    if (company?.id && !isUUID) {
      // This is a temporary project that needs to be synced to backend
      // Use direct fetch instead of tRPC to avoid client issues
      (async () => {
        try {
          console.log('[App] 🔄 Syncing temporary project to backend:', project.name);

          const baseUrl = getApiBaseUrl();
          const response = await fetch(`${baseUrl}/api/add-project`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: company.id,
              name: project.name,
              budget: project.budget,
              expenses: project.expenses,
              progress: project.progress,
              status: project.status,
              image: project.image,
              hoursWorked: project.hoursWorked,
              startDate: project.startDate,
              endDate: project.endDate,
            }),
          });

          if (!response.ok) {
            throw new Error(`Backend sync failed: ${response.status}`);
          }

          const data = await response.json();

          if (data.success && data.project) {
            console.log('[App] ✓ Project synced to backend with UUID:', data.project.id);
            setProjects(prev => prev.map(p =>
              p.id === project.id ? { ...p, id: data.project.id } : p
            ));
          }
        } catch (error: any) {
          console.warn('[App] ⚠️ Backend sync failed (continuing offline):', error.message);
          // Don't rollback - keep the optimistic update
        }
      })();
    } else if (isUUID) {
      console.log('[App] ✓ Project already has UUID, skipping backend sync:', project.name);
    }
  }, [company]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    // Optimistically update UI
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

    // Save to backend via direct REST endpoint (bypasses @hono/node-server/vercel POST body bug)
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/update-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      console.log('[App] Project updated in backend:', id);
    } catch (error) {
      console.error('[App] Error updating project in backend:', error);
    }
  }, []);

  const archiveProject = useCallback(async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    console.log(`[Cloud Storage] Archiving project: ${project.name}`);
    console.log('[Cloud Storage] Collecting project data...');
    
    // Find estimate linked to this project (if any)
    const linkedEstimate = project.estimateId ? estimates.find(e => e.id === project.estimateId) : null;

    const projectData = {
      project,
      expenses: expenses.filter(e => e.projectId === id),
      photos: photos.filter(p => p.projectId === id),
      tasks: tasks.filter(t => t.projectId === id),
      clockEntries: clockEntries.filter(c => c.projectId === id),
      linkedEstimate: linkedEstimate || null,
      archivedDate: new Date().toISOString(),
    };

    console.log(`[Cloud Storage] Archived ${projectData.expenses.length} expenses`);
    console.log(`[Cloud Storage] Archived ${projectData.photos.length} photos`);
    console.log(`[Cloud Storage] Archived ${projectData.tasks.length} tasks`);
    console.log(`[Cloud Storage] Archived ${projectData.clockEntries.length} clock entries`);
    console.log(`[Cloud Storage] Archived linked estimate:`, linkedEstimate ? linkedEstimate.id : 'none');
    
    await AsyncStorage.setItem(`archived_project_${id}`, JSON.stringify(projectData));
    console.log('[Cloud Storage] Project successfully archived to cloud storage');
    
    setProjects(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'archived' as const, endDate: new Date().toISOString() } : p
    ));
  }, [projects, expenses, photos, tasks, clockEntries, estimates]);

  const addClient = useCallback(async (client: Client) => {
    // Optimistically update UI
    setClients(prev => [...prev, client]);

    // Save to backend if company exists
    if (company?.id) {
      try {
        // Use direct API endpoint instead of tRPC (tRPC was timing out)
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/api/add-client`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            name: client.name,
            address: client.address || null,
            email: client.email,
            phone: client.phone,
            source: client.source,
            status: client.status || 'Lead',
            lastContacted: client.lastContacted || null,
            lastContactDate: client.lastContactDate || new Date().toISOString(),
            nextFollowUpDate: client.nextFollowUpDate || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add client');
        }

        const data = await response.json();
        console.log('[App] Client saved to backend:', client.name, data.client?.id);
      } catch (error) {
        console.error('[App] Error saving client to backend:', error);
        // Rollback on error
        setClients(prev => prev.filter(c => c.id !== client.id));
        throw error;
      }
    }
  }, [company]);

  const refreshClients = useCallback(async () => {
    if (!company?.id) {
      console.log('[App] ❌ No company found, cannot refresh clients');
      console.log('[App] Company state:', company);
      return;
    }

    console.log('[App] 🔄 Refreshing clients for company:', company.id);
    console.log('[App] Company name:', company.name);
    try {
      const { data: clientRows, error } = await supabase.from('clients').select('*').eq('company_id', company.id).order('name');
      if (error) throw error;
      const mapped = (clientRows ?? []).map(mapClient);
      setClients(mapped);
      console.log('[App] ✅ Refreshed', mapped.length, 'clients');
      console.log('[App] 📋 Client names:', mapped.map((c: any) => c.name).join(', '));
    } catch (error) {
      console.error('[App] ❌ Error refreshing clients:', error);
    }
  }, [company]);

  const updateClient = useCallback(async (id: string, updates: Partial<Client>) => {
    // Update local state immediately for responsive UI
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    // Save to database
    try {
      const updatePayload: Record<string, any> = {};
      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.address !== undefined) updatePayload.address = updates.address;
      if (updates.email !== undefined) updatePayload.email = updates.email;
      if (updates.phone !== undefined) updatePayload.phone = updates.phone;
      if (updates.source !== undefined) updatePayload.source = updates.source;
      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.lastContacted !== undefined) updatePayload.last_contacted = updates.lastContacted;
      if (updates.lastContactDate !== undefined) updatePayload.last_contact_date = updates.lastContactDate;
      if (updates.nextFollowUpDate !== undefined) updatePayload.next_follow_up_date = updates.nextFollowUpDate;
      const { error } = await supabase.from('clients').update(updatePayload).eq('id', id);
      if (error) {
        console.error('[App] Error updating client:', error);
        await refreshClients();
      } else {
        console.log('[App] Client updated successfully');
      }
    } catch (error) {
      console.error('[App] Error updating client:', error);
      await refreshClients();
    }
  }, [refreshClients]);

  const refreshEstimates = useCallback(async () => {
    if (!company?.id) {
      console.log('[App] ⚠️ Cannot refresh estimates - no company ID');
      return;
    }

    console.log('[App] 🔄 Refreshing estimates...');
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-estimates?companyId=${company.id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[App] 📦 Estimates result:', data);

      if (data.success && data.estimates) {
        setEstimates(data.estimates);
        console.log('[App] ✅ Refreshed', data.estimates.length, 'estimates');
      } else {
        console.log('[App] ⚠️ Query succeeded but no estimates returned');
      }
    } catch (error) {
      console.error('[App] ❌ Error refreshing estimates:', error);
    }
  }, [company?.id]);

  const refreshExpenses = useCallback(async () => {
    if (!company?.id) {
      console.log('[App] ⚠️ Cannot refresh expenses - no company ID');
      return;
    }

    console.log('[App] 🔄 Refreshing expenses...');
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-expenses?companyId=${company.id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[App] 📦 Expenses result:', data);

      if (data.success && data.expenses) {
        setExpenses(data.expenses);
        console.log('[App] ✅ Refreshed', data.expenses.length, 'expenses');
      } else {
        console.log('[App] ⚠️ Query succeeded but no expenses returned');
      }
    } catch (error) {
      console.error('[App] ❌ Error refreshing expenses:', error);
    }
  }, [company?.id]);

  const refreshDailyLogs = useCallback(async () => {
    if (!company?.id) {
      console.log('[App] ⚠️ Cannot refresh daily logs - no company ID');
      return;
    }

    console.log('[App] 🔄 Refreshing daily logs...');
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-daily-logs?companyId=${company.id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[App] 📦 Daily logs result:', data);

      if (data.success && data.dailyLogs) {
        setDailyLogs(data.dailyLogs);
        console.log('[App] ✅ Refreshed', data.dailyLogs.length, 'daily logs');
      } else {
        console.log('[App] ⚠️ Query succeeded but no daily logs returned');
      }
    } catch (error) {
      console.error('[App] ❌ Error refreshing daily logs:', error);
    }
  }, [company?.id]);

  const refreshPhotos = useCallback(async () => {
    if (!company?.id) return;
    try {
      const { data: photoRows } = await supabase.from('photos').select('*').eq('company_id', company.id).order('created_at', { ascending: false });
      setPhotos((photoRows ?? []).map(mapPhoto));
      console.log('[App] ✅ Refreshed', photoRows?.length ?? 0, 'photos');
    } catch (error) {
      console.error('[App] ❌ Error refreshing photos:', error);
    }
  }, [company?.id]);

  const refreshSubcontractors = useCallback(async () => {
    if (!company?.id) return;
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/get-subcontractors?companyId=${company.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.subcontractors) {
        setSubcontractors(data.subcontractors);
        console.log('[App] ✅ Refreshed', data.subcontractors.length, 'subcontractors');
      }
    } catch (error) {
      console.error('[App] ❌ Error refreshing subcontractors:', error);
    }
  }, [company?.id]);

  const refreshNotifications = useCallback(async () => {
    if (!user?.id || !company?.id) return;
    try {
      const { data, error } = await supabase.from('notifications').select('*')
        .eq('user_id', user.id!).eq('company_id', company.id!)
        .order('created_at', { ascending: false }).limit(50);
      if (error) {
        console.warn('[Notifications] Refresh query error:', error.message, error.code);
        return;
      }
      const rows = data ?? [];
      setNotifications(prev => {
        const dbIds = new Set(rows.map((n: any) => n.id));
        const localOnly = prev.filter((n: any) => !dbIds.has(n.id));
        return [...rows.map(mapNotification), ...localOnly];
      });
      console.log('[App] ✅ Refreshed', rows.length, 'notifications');
    } catch (error) {
      console.warn('[Notifications] Refresh failed (non-fatal):', error);
    }
  }, [user?.id, company?.id]);

  // ─── Supabase Realtime subscription ──────────────────────────────────────────
  // Listens for INSERT events on the notifications table filtered to this user.
  // New rows are prepended to state instantly — no polling delay on any platform.
  // The channel is torn down on logout or user/company switch.
  useEffect(() => {
    if (!user?.id || !company?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const incoming = mapNotification(payload.new);
          console.log('[Realtime] New notification received:', incoming.title);
          setNotifications(prev => {
            // Deduplicate — the optimistic addNotification may have already added it
            if (prev.some(n => n.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Notifications channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, company?.id]);

  // ─── Realtime: permission sync ────────────────────────────────────────────────
  // When an admin updates this user's custom_permissions in Supabase, the change
  // is pushed immediately to the active session without requiring a re-login.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-permissions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, any>;
          if (!('custom_permissions' in updated)) return;
          const newPerms: Record<string, boolean> | undefined =
            updated.custom_permissions ?? undefined;
          console.log('[Realtime] Permission update received:', newPerms);
          setUserState(prev => {
            if (!prev) return prev;
            const next = { ...prev, customPermissions: newPerms };
            // Persist to AsyncStorage so the update survives an app restart
            AsyncStorage.setItem('user', JSON.stringify(next)).catch(() => {});
            return next;
          });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] User-permissions channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Load daily logs when company is available
  useEffect(() => {
    if (company?.id) {
      refreshDailyLogs();
    }
  }, [company?.id, refreshDailyLogs]);

  const addExpense = useCallback(async (expense: Expense) => {
    // Optimistically update UI
    setExpenses(prev => [...prev, expense]);

    // Save to backend if company exists
    if (company?.id) {
      try {
        // Use direct API endpoint (bypasses tRPC for reliability)
        const apiUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');

        console.log('[App] Saving expense to:', `${apiUrl}/api/add-expense`);

        // 🎯 PHASE 2B: Get JWT token from Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          console.warn('[App] No auth token available for expense upload');
        }

        const response = await fetch(`${apiUrl}/api/add-expense`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 🎯 PHASE 2B: Attach Authorization header
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            // 🎯 SECURITY: Remove companyId from body - comes from JWT now
            projectId: expense.projectId,
            type: expense.type,
            subcategory: expense.subcategory,
            amount: expense.amount,
            store: expense.store,
            date: expense.date,
            receiptUrl: expense.receiptUrl,
            imageHash: expense.imageHash,
            ocrFingerprint: expense.ocrFingerprint,
            imageSizeBytes: expense.imageSizeBytes,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
          throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('[App] Expense saved to backend:', result.expense?.id);

        // Update the expense with the database ID
        if (result.expense?.id) {
          setExpenses(prev => prev.map(e =>
            e.id === expense.id ? { ...e, id: result.expense.id } : e
          ));
        }
      } catch (error) {
        console.error('[App] Error saving expense to backend:', error);
        // Remove the expense from state since backend save failed
        setExpenses(prev => prev.filter(e => e.id !== expense.id));
        // Re-throw so the UI can show an error to the user
        throw error;
      }
    } else {
      // Fallback to AsyncStorage if no company
      const updated = [...expenses, expense];
      await AsyncStorage.setItem('expenses', JSON.stringify(updated));
    }
  }, [company, expenses]);

  const addPhoto = useCallback(async (photo: Photo) => {
    // Optimistically update UI
    setPhotos(prev => [...prev, photo]);

    // Save to backend if company exists
    if (company?.id) {
      try {
        // Use direct API endpoint (bypasses tRPC for reliability)
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';

        // 🎯 PHASE 2B: Get JWT token from Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          console.warn('[App] No auth token available for photo upload');
        }

        const response = await fetch(`${apiUrl}/api/save-photo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 🎯 PHASE 2B: Attach Authorization header
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            // 🎯 SECURITY: Remove companyId from body - comes from JWT now
            projectId: photo.projectId,
            category: photo.category,
            notes: photo.notes,
            url: photo.url,
            date: photo.date,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save photo');
        }

        console.log('[App] Photo saved to backend');
      } catch (error) {
        console.error('[App] Error saving photo to backend:', error);
        setPhotos(prev => prev.filter(p => p.id !== photo.id));
        throw error;
      }
    }
  }, [company]);

  const updatePhoto = useCallback((id: string, updates: Partial<Photo>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    console.log('[Photo] Updated photo:', id, 'with updates:', updates);
  }, []);

  const addTask = useCallback(async (task: Task) => {
    // Optimistically update UI
    setTasks(prev => [...prev, task]);

    // Save to backend if company exists
    if (company?.id) {
      try {
        const { error } = await supabase.from('tasks').insert({
          id: task.id,
          company_id: company.id,
          project_id: task.projectId,
          name: task.name,
          date: task.date,
          reminder: task.reminder,
          completed: task.completed || false,
        });
        if (error) throw new Error(error.message);
        console.log('[App] Task saved to backend:', task.name);
      } catch (error) {
        console.error('[App] Error saving task to backend:', error);
        setTasks(prev => prev.filter(t => t.id !== task.id));
        throw error;
      }
    }
  }, [company]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    // Optimistically update UI
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    // Save to backend
    try {
      const updatePayload: Record<string, any> = {};
      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.date !== undefined) updatePayload.date = updates.date;
      if (updates.reminder !== undefined) updatePayload.reminder = updates.reminder;
      if (updates.completed !== undefined) updatePayload.completed = updates.completed;
      if (updates.projectId !== undefined) updatePayload.project_id = updates.projectId;
      const { error } = await supabase.from('tasks').update(updatePayload).eq('id', id);
      if (error) throw new Error(error.message);
      console.log('[App] Task updated in backend:', id);
    } catch (error) {
      console.error('[App] Error updating task in backend:', error);
    }
  }, [company, user]);

  const addClockEntry = useCallback(async (entry: ClockEntry): Promise<ClockEntry> => {
    console.log('[App] addClockEntry called with:', { entryId: entry.id, projectId: entry.projectId });
    console.log('[App] company:', company?.id, 'user:', user?.id);

    // Optimistically update UI with temporary entry
    setClockEntries(prev => [...prev, entry]);

    // Clock in on backend if company and user exist
    if (company?.id && user?.id) {
      try {
        console.log('[App] Calling /api/clock-in...');
        const apiUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');

        const response = await fetch(`${apiUrl}/api/clock-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            employeeId: user.id,
            projectId: entry.projectId,
            location: entry.location,
            workPerformed: entry.workPerformed,
            category: entry.category,
          }),
        });

        const result = await response.json();
        console.log('[App] clock-in result:', result);

        if (!response.ok) {
          throw new Error(result.error || 'Failed to clock in');
        }

        // Update local entry with database ID so clock-out works correctly
        if (result.success && result.clockEntry) {
          const dbId = result.clockEntry.id;
          console.log('[App] Clocked in successfully, updating ID:', entry.id, '->', dbId);
          const updatedEntry = { ...entry, id: dbId };
          setClockEntries(prev => prev.map(e =>
            e.id === entry.id ? updatedEntry : e
          ));
          return updatedEntry;
        }
      } catch (error) {
        console.error('[App] Error clocking in:', error);
        setClockEntries(prev => prev.filter(e => e.id !== entry.id));
        throw error;
      }
    } else {
      console.warn('[App] Cannot save clock entry - company or user not available');
    }
    return entry;
  }, [company, user]);

  const updateClockEntry = useCallback(async (id: string, updates: Partial<ClockEntry>) => {
    console.log('[App] updateClockEntry called with id:', id, 'updates:', updates);

    // Optimistically update UI
    setClockEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));

    // If clocking out (clockOut is being set), call backend
    if (updates.clockOut) {
      try {
        console.log('[App] Calling /api/clock-out...');
        const apiUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');

        // Transform lunchBreaks to match backend schema (startTime/endTime -> start/end)
        const transformedLunchBreaks = updates.lunchBreaks?.map(lb => ({
          start: lb.startTime,
          end: lb.endTime || '',
        })).filter(lb => lb.start && lb.end);

        console.log('[App] Clock out data:', { entryId: id, workPerformed: updates.workPerformed, lunchBreaks: transformedLunchBreaks });

        const response = await fetch(`${apiUrl}/api/clock-out`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryId: id,
            workPerformed: updates.workPerformed,
            lunchBreaks: transformedLunchBreaks,
            category: updates.category,
          }),
        });

        const result = await response.json();
        console.log('[App] Clocked out result:', result);

        if (!response.ok) {
          throw new Error(result.error || 'Failed to clock out');
        }
      } catch (error) {
        console.error('[App] Error clocking out:', error);
      }
    }
  }, []);

  const addEstimate = useCallback((estimate: Estimate) => {
    setEstimates(prev => [...prev, estimate]);
  }, []);

  const updateEstimate = useCallback(async (id: string, updates: Partial<Estimate>) => {
    // Update local state immediately for responsive UI
    setEstimates(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));

    // Save to database if status is being updated
    if (updates.status) {
      try {
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/api/update-estimate-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estimateId: id,
            status: updates.status,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          console.error('[App] Error updating estimate status:', data.error);
          // Could revert local state here if needed
        } else {
          console.log('[App] Estimate status updated successfully');
        }
      } catch (error) {
        console.error('[App] Error updating estimate status:', error);
      }
    }
  }, []);

  const deleteEstimate = useCallback((id: string) => {
    setEstimates(prev => prev.filter(e => e.id !== id));
  }, []);

  const addCustomPriceListItem = useCallback(async (item: CustomPriceListItem) => {
    // Optimistically update UI
    setPriceListItems(prev => [...prev, item]);

    // Save to AsyncStorage immediately
    const updated = [...priceListItems, item];
    await AsyncStorage.setItem('priceListItems', JSON.stringify(updated));

    // Save to backend if company exists (fire-and-forget, non-blocking)
    if (company?.id) {
      // Don't await - run in background
      (async () => {
        try {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

          console.log('[App] Saving to database via direct API...');
          const startTime = Date.now();

          const response = await fetch(`${apiUrl}/api/add-price-item-direct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: company.id,
              category: item.category,
              name: item.name,
              unit: item.unit,
              unitPrice: item.unitPrice,
            }),
            signal: AbortSignal.timeout(8000), // 8 second timeout
          });

          const totalTime = Date.now() - startTime;

          if (response.ok) {
            const result = await response.json();
            console.log('[App] ✅ Saved to database in', result.timing, 'ms');

            // Update the item with the database ID
            setPriceListItems(prev =>
              prev.map(i => i.id === item.id ? { ...i, id: result.item.id } : i)
            );
          } else {
            throw new Error(`API returned ${response.status}`);
          }
        } catch (error: any) {
          // Silently log - item is already saved locally
          if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            console.warn('[App] ⚠️ Database save timed out after 8s (item saved locally)');
          } else {
            console.warn('[App] ⚠️ Database save failed:', error.message, '(item saved locally)');
          }
        }
      })();
    }
  }, [company, priceListItems]);

  const deleteCustomPriceListItem = useCallback(async (id: string) => {
    const updated = priceListItems.filter(item => item.id !== id);
    setPriceListItems(updated);
    await AsyncStorage.setItem('priceListItems', JSON.stringify(updated));
  }, [priceListItems]);

  const updateCustomPriceListItem = useCallback(async (id: string, updates: Partial<PriceListItem>) => {
    const updated = priceListItems.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    setPriceListItems(updated);
    await AsyncStorage.setItem('priceListItems', JSON.stringify(updated));
  }, [priceListItems]);

  const addCustomCategory = useCallback(async (category: CustomCategory) => {
    const updated = [...customCategories, category];
    setCustomCategories(updated);
    await AsyncStorage.setItem('customCategories', JSON.stringify(updated));
  }, [customCategories]);

  const deleteCustomCategory = useCallback(async (id: string) => {
    const updated = customCategories.filter(cat => cat.id !== id);
    setCustomCategories(updated);
    await AsyncStorage.setItem('customCategories', JSON.stringify(updated));

    const updatedItems = priceListItems.filter(item => {
      const category = customCategories.find(cat => cat.id === id);
      return item.category !== category?.name;
    });
    setPriceListItems(updatedItems);
    await AsyncStorage.setItem('priceListItems', JSON.stringify(updatedItems));
  }, [customCategories, priceListItems]);

  const addPhotoCategory = useCallback(async (category: string) => {
    if (!company?.id) {
      console.error('[PhotoCategory] No company ID available');
      return;
    }

    if (photoCategories.includes(category)) {
      console.log('[PhotoCategory] Category already exists:', category);
      return;
    }

    try {
      const { error } = await supabase.from('photo_categories').insert({ company_id: company.id, name: category });
      if (error) throw error;
      setPhotoCategories([...photoCategories, category]);
      console.log('[PhotoCategory] Added category:', category);
    } catch (error: any) {
      console.error('[PhotoCategory] Error adding category:', error?.message || error);
    }
  }, [photoCategories, company]);

  const updatePhotoCategory = useCallback(async (oldName: string, newName: string) => {
    if (!company?.id) {
      console.error('[PhotoCategory] No company ID available');
      return;
    }

    try {
      const { error } = await supabase.from('photo_categories').update({ name: newName }).eq('company_id', company.id).eq('name', oldName);
      if (error) throw error;
      setPhotoCategories(photoCategories.map(cat => cat === oldName ? newName : cat));
      setPhotos(photos.map(p => p.category === oldName ? { ...p, category: newName } : p));
      console.log('[PhotoCategory] Updated category:', oldName, 'to', newName);
    } catch (error: any) {
      console.error('[PhotoCategory] Error updating category:', error?.message || error);
    }
  }, [photoCategories, photos, company]);

  const deletePhotoCategory = useCallback(async (category: string) => {
    if (!company?.id) {
      console.error('[PhotoCategory] No company ID available');
      return;
    }

    try {
      const { error } = await supabase.from('photo_categories').delete().eq('company_id', company.id).eq('name', category);
      if (error) throw error;
      setPhotoCategories(photoCategories.filter(cat => cat !== category));
      console.log('[PhotoCategory] Deleted category:', category);
    } catch (error: any) {
      console.error('[PhotoCategory] Error deleting category:', error?.message || error);
    }
  }, [photoCategories, company]);

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
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id === conversationId) {
          // Check if message already exists to prevent duplicates
          const messageExists = conv.messages.some(m => m.id === message.id);
          if (messageExists) {
            return conv;
          }
          return {
            ...conv,
            messages: [...conv.messages, message],
            lastMessage: message,
          };
        }
        return conv;
      });

      // Save to AsyncStorage asynchronously without blocking state update
      AsyncStorage.setItem('conversations', JSON.stringify(updated)).catch(err =>
        console.error('[AppContext] Failed to save conversations:', err)
      );

      return updated;
    });
  }, []);

  const addReport = useCallback(async (report: Report) => {
    // Save to database
    if (company?.id) {
      try {
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/api/save-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            name: report.name,
            type: report.type,
            projectIds: report.projectIds,
            projectsCount: report.projectsCount,
            totalBudget: report.totalBudget,
            totalExpenses: report.totalExpenses,
            totalHours: report.totalHours,
            fileUrl: report.fileUrl,
            notes: report.notes,
            dateRange: report.dateRange,
            employeeIds: report.employeeIds,
            employeeData: report.employeeData,
            expensesByCategory: report.expensesByCategory,
            projects: report.projects,
          }),
        });

        const data = await response.json();
        if (data.success && data.report) {
          // Use the returned report with database ID
          const updated = [data.report, ...reports];
          setReports(updated);
          await AsyncStorage.setItem('reports', JSON.stringify(updated));
          console.log('[Storage] Report saved to database successfully:', report.name);
          return;
        } else {
          console.error('[Storage] Failed to save report to database:', data.error);
        }
      } catch (error) {
        console.error('[Storage] Error saving report to database:', error);
      }
    }

    // Fallback to local storage only
    const updated = [report, ...reports];
    setReports(updated);
    await AsyncStorage.setItem('reports', JSON.stringify(updated));
    console.log('[Storage] Report saved locally:', report.name);
  }, [reports, company?.id]);

  const deleteReport = useCallback(async (id: string) => {
    // Delete from database
    if (company?.id) {
      try {
        const baseUrl = getApiBaseUrl();
        await fetch(`${baseUrl}/api/delete-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId: id,
            companyId: company.id,
          }),
        });
        console.log('[Storage] Report deleted from database');
      } catch (error) {
        console.error('[Storage] Error deleting report from database:', error);
      }
    }

    // Update local state
    const updated = reports.filter(r => r.id !== id);
    setReports(updated);
    await AsyncStorage.setItem('reports', JSON.stringify(updated));
    console.log('[Storage] Report deleted successfully');
  }, [reports, company?.id]);

  const refreshReports = useCallback(async () => {
    if (!company?.id) {
      console.log('[Storage] No company ID, skipping reports refresh');
      return;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-reports?companyId=${company.id}`);
      const data = await response.json();

      if (data.success && data.reports) {
        setReports(data.reports);
        await AsyncStorage.setItem('reports', JSON.stringify(data.reports));
        console.log('[Storage] Reports refreshed from database:', data.reports.length);
      }
    } catch (error) {
      console.error('[Storage] Error refreshing reports:', error);
    }
  }, [company?.id]);

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
    // Optimistic update to UI
    const updated = [log, ...dailyLogs];
    setDailyLogs(updated);
    await AsyncStorage.setItem('dailyLogs', JSON.stringify(updated));
    console.log('[Storage] Daily log saved locally');

    // Save to backend if company and user exist
    if (!company?.id || !user?.id) {
      console.log('[Storage] No company/user - saved locally only');
      return;
    }

    try {
      // Upload photos to S3 first to avoid payload size limits
      const uploadedPhotoUrls = await Promise.all(
        (log.photos || []).map(async (photo) => {
          // Skip if already uploaded to S3 (HTTP URL)
          if (photo.uri.startsWith('http')) {
            return {
              id: photo.id,
              url: photo.uri,
              author: photo.author,
              notes: photo.notes,
            };
          }

          // Upload local photo to S3
          try {
            // For now, skip uploading and just save reference
            // This prevents payload too large error
            // TODO: Implement S3 upload for daily log photos
            console.log('[Storage] Skipping photo upload (too large for serverless):', photo.id);
            return null;
          } catch (error) {
            console.error('[Storage] Failed to upload photo:', error);
            return null;
          }
        })
      );

      const baseUrl = getApiBaseUrl();
      console.log('[Storage] Saving daily log to:', `${baseUrl}/api/save-daily-log`);

      const response = await fetch(`${baseUrl}/api/save-daily-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          projectId: log.projectId,
          logDate: log.logDate,
          createdBy: user.id, // Use user UUID instead of name
          equipmentNote: log.equipmentNote,
          materialNote: log.materialNote,
          officialNote: log.officialNote,
          subsNote: log.subsNote,
          employeesNote: log.employeesNote,
          workPerformed: log.workPerformed,
          issues: log.issues,
          generalNotes: log.generalNotes,
          tasks: log.tasks || [],
          photos: uploadedPhotoUrls.filter(p => p !== null), // Send URLs instead of base64
          sharedWith: log.sharedWith || [], // Emails (will be converted to UUIDs)
        }),
      });

      console.log('[Storage] Response status:', response.status);
      console.log('[Storage] Response content-type:', response.headers.get('content-type'));

      if (!response.ok) {
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || `Failed to save daily log (${response.status})`);
        } else {
          // Got HTML or plain text instead of JSON
          const text = await response.text();
          console.error('[Storage] Non-JSON response:', text.substring(0, 200));
          throw new Error(`Server error (${response.status}): API endpoint may not exist`);
        }
      }

      const result = await response.json();
      console.log('[Storage] Daily log saved to database:', result.dailyLog?.id);

      // Update local state with database UUID
      if (result.dailyLog?.id) {
        const updatedWithDbId = updated.map(l =>
          l.id === log.id ? { ...l, id: result.dailyLog.id } : l
        );
        setDailyLogs(updatedWithDbId);
        await AsyncStorage.setItem('dailyLogs', JSON.stringify(updatedWithDbId));
      }
    } catch (error: any) {
      console.error('[Storage] Error saving to backend:', error?.message || error);
      // Keep optimistic update - log saved locally and can be synced later
    }
  }, [dailyLogs, company, user]);

  const updateDailyLog = useCallback(async (id: string, updates: Partial<DailyLog>) => {
    const updated = dailyLogs.map(log => log.id === id ? { ...log, ...updates } : log);
    setDailyLogs(updated);
    await AsyncStorage.setItem('dailyLogs', JSON.stringify(updated));
    console.log('[Storage] Daily log updated successfully');
  }, [dailyLogs]);

  const deleteDailyLog = useCallback(async (id: string) => {
    // Optimistic update - remove from UI immediately
    const updated = dailyLogs.filter(log => log.id !== id);
    setDailyLogs(updated);
    await AsyncStorage.setItem('dailyLogs', JSON.stringify(updated));
    console.log('[Storage] Daily log deleted from local storage');

    // Delete from backend if company exists
    if (!company?.id) {
      console.log('[Storage] No company - deleted locally only');
      return;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/delete-daily-log`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLogId: id,
          companyId: company.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete from database');
      }

      console.log('[Storage] ✅ Daily log deleted from database');
    } catch (error: any) {
      console.error('[Storage] Error deleting from backend:', error?.message || error);
      // Keep optimistic update - log removed from UI even if backend fails
    }
  }, [dailyLogs, company]);

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

    addNotification({
      id:        crypto.randomUUID(),
      userId:    user?.id || '',
      companyId: company?.id || '',
      type:      'payment-received',
      title:     'Payment Recorded',
      message:   `$${payment.amount.toLocaleString()} payment recorded${project ? ` for ${project.name}` : ''}`,
      data:      { paymentId: payment.id, projectId: payment.projectId },
      read:      false,
      createdAt: new Date().toISOString(),
    });
  }, [payments, projects, user, company]);

  const getPayments = useCallback((projectId?: string) => {
    if (!projectId) return payments;
    return payments.filter(p => p.projectId === projectId);
  }, [payments]);

  const sendPaymentRequest = useCallback(async (data: {
    clientId: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    amount: number;
    method: string;
    dueDate?: string;
    message?: string;
  }) => {
    try {
      const response = await fetch('/api/send-payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId: company?.id }),
      });
      if (!response.ok) {
        throw new Error('Failed to send payment request');
      }
      console.log('[AppContext] Payment request sent successfully');
    } catch (error) {
      console.error('[AppContext] Error sending payment request:', error);
      throw error;
    }
  }, [company?.id]);

  const sendSMS = useCallback(async (data: {
    clientId: string;
    clientName: string;
    phone: string;
    message: string;
  }) => {
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId: company?.id }),
      });
      if (!response.ok) {
        throw new Error('Failed to send SMS');
      }
      console.log('[AppContext] SMS sent successfully');
    } catch (error) {
      console.error('[AppContext] Error sending SMS:', error);
      throw error;
    }
  }, [company?.id]);

  const sendEmail = useCallback(async (data: {
    clientId: string;
    clientName: string;
    email: string;
    subject: string;
    message: string;
    projectData?: any;
  }) => {
    try {
      let htmlMessage = `<p>${data.message.replace(/\n/g, '<br>')}</p>`;

      if (data.projectData) {
        htmlMessage += `
          <hr>
          <p><strong>Related Project:</strong> ${data.projectData.projectName}</p>
        `;
      }

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: data.email,
          subject: data.subject,
          html: htmlMessage,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to send email');
      }
      console.log('[AppContext] Email sent successfully');
    } catch (error) {
      console.error('[AppContext] Error sending email:', error);
      throw error;
    }
  }, [company?.id]);

  const sendBulkSMS = useCallback(async (data: {
    recipients: Array<{ clientId: string; clientName: string; phone: string }>;
    message: string;
  }) => {
    try {
      const response = await fetch('/api/send-bulk-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId: company?.id }),
      });
      if (!response.ok) {
        throw new Error('Failed to send bulk SMS');
      }
      console.log('[AppContext] Bulk SMS sent successfully');
    } catch (error) {
      console.error('[AppContext] Error sending bulk SMS:', error);
      throw error;
    }
  }, [company?.id]);

  const initiateCall = useCallback(async (data: {
    clientId: string;
    clientName: string;
    phone: string;
    purpose?: string;
  }) => {
    try {
      // On web, use tel: protocol
      if (Platform.OS === 'web') {
        window.location.href = `tel:${data.phone}`;
      } else {
        // On mobile, use Linking API - inline require to avoid declaration issues
        await require('react-native').Linking.openURL(`tel:${data.phone}`);
      }
      console.log('[AppContext] Call initiated to:', data.phone);
    } catch (error) {
      console.error('[AppContext] Error initiating call:', error);
      throw error;
    }
  }, []);

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

    addNotification({
      id:        crypto.randomUUID(),
      userId:    user?.id || '',
      companyId: company?.id || '',
      type:      'change-order',
      title:     'Change Order Added',
      message:   changeOrder.description,
      data:      { changeOrderId: changeOrder.id, projectId: changeOrder.projectId },
      read:      false,
      createdAt: new Date().toISOString(),
    });
  }, [changeOrders, projects, user, company]);

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

    if (isBeingApproved) {
      addNotification({
        id:        crypto.randomUUID(),
        userId:    user?.id || '',
        companyId: company?.id || '',
        type:      'change-order',
        title:     'Change Order Approved',
        message:   `Change order for $${changeOrder.amount.toLocaleString()} has been approved`,
        data:      { changeOrderId: id, projectId: changeOrder.projectId },
        read:      false,
        createdAt: new Date().toISOString(),
      });
    } else if (isBeingRejected) {
      addNotification({
        id:        crypto.randomUUID(),
        userId:    user?.id || '',
        companyId: company?.id || '',
        type:      'change-order',
        title:     'Change Order Rejected',
        message:   `Change order for $${changeOrder.amount.toLocaleString()} has been rejected`,
        data:      { changeOrderId: id, projectId: changeOrder.projectId },
        read:      false,
        createdAt: new Date().toISOString(),
      });
    }
  }, [changeOrders, projects, user, company]);

  const getChangeOrders = useCallback((projectId?: string) => {
    if (!projectId) return changeOrders;
    return changeOrders.filter(co => co.projectId === projectId);
  }, [changeOrders]);

  const addSubcontractor = useCallback(async (subcontractor: Subcontractor) => {
    // Try to save to database first
    if (company?.id) {
      try {
        console.log('[Subcontractor] Saving to database for company:', company.id);
        const baseUrl = getApiBaseUrl();
        const response = await fetch(
          `${baseUrl}/api/create-subcontractor`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: company.id,
              name: subcontractor.name,
              companyName: subcontractor.companyName,
              email: subcontractor.email,
              phone: subcontractor.phone,
              trade: subcontractor.trade,
              rating: subcontractor.rating,
              hourlyRate: subcontractor.hourlyRate,
              availability: subcontractor.availability,
              certifications: subcontractor.certifications,
              address: subcontractor.address,
              insuranceExpiry: subcontractor.insuranceExpiry,
              notes: subcontractor.notes,
              avatar: subcontractor.avatar,
            }),
          }
        );

        const data = await response.json();

        if (data.success && data.subcontractor) {
          const savedSubcontractor = data.subcontractor;
          console.log('[Subcontractor] Saved to database successfully:', savedSubcontractor.id);

          // Update local state with the database version (which has the proper ID)
          const updated = [savedSubcontractor, ...subcontractors];
          setSubcontractors(updated);
          await AsyncStorage.setItem('subcontractors', JSON.stringify(updated));
          return;
        } else {
          console.error('[Subcontractor] Database save failed:', data.error || data);
        }
      } catch (error) {
        console.error('[Subcontractor] Error saving to database:', error);
      }
    }

    // Fallback to local storage only
    const updated = [subcontractor, ...subcontractors];
    setSubcontractors(updated);
    await AsyncStorage.setItem('subcontractors', JSON.stringify(updated));
    console.log('[Storage] Subcontractor saved to local storage:', subcontractor.name);
  }, [subcontractors, company]);

  const updateSubcontractor = useCallback(async (id: string, updates: Partial<Subcontractor>) => {
    const updated = subcontractors.map(sub => {
      if (sub.id === id) {
        return { ...sub, ...updates };
      }
      return sub;
    });
    setSubcontractors(updated);
    await AsyncStorage.setItem('subcontractors', JSON.stringify(updated));
    console.log('[Storage] Subcontractor updated successfully');
  }, [subcontractors]);

  const getSubcontractors = useCallback(() => {
    return subcontractors;
  }, [subcontractors]);

  const assignSubcontractor = useCallback(async (data: {
    subcontractorId: string;
    subcontractorName: string;
    projectId: string;
    projectName: string;
    startDate?: string;
    notes?: string;
  }) => {
    try {
      const response = await fetch('/api/assign-subcontractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId: company?.id }),
      });
      if (!response.ok) {
        throw new Error('Failed to assign subcontractor');
      }
      console.log('[AppContext] Subcontractor assigned to project');
    } catch (error) {
      console.error('[AppContext] Error assigning subcontractor:', error);
      throw error;
    }
  }, [company?.id]);

  const addProposal = useCallback(async (proposal: SubcontractorProposal) => {
    const updated = [proposal, ...proposals];
    setProposals(updated);
    await AsyncStorage.setItem('proposals', JSON.stringify(updated));
    console.log('[Storage] Proposal saved successfully');

    const notification: Notification = {
      id:        crypto.randomUUID(),
      userId:    user?.id || '',
      companyId: company?.id || '',
      type:      'estimate-received',
      title:     'New Proposal Received',
      message:   `A subcontractor has submitted a proposal for $${proposal.amount.toLocaleString()}`,
      data:      { proposalId: proposal.id, projectId: proposal.projectId },
      read:      false,
      createdAt: new Date().toISOString(),
    };
    await addNotification(notification);
  }, [proposals, user, company]);

  const getProposals = useCallback((projectId?: string) => {
    if (!projectId) return proposals;
    return proposals.filter(p => p.projectId === projectId);
  }, [proposals]);

  const addNotification = useCallback(async (notification: Notification) => {
    // Ensure the id is a valid UUID so the DB insert succeeds.
    // Non-UUID ids (e.g. notif_${Date.now()}) cause a silent PG type error.
    const notif = notification.id && /^[0-9a-f-]{36}$/i.test(notification.id)
      ? notification
      : { ...notification, id: crypto.randomUUID() };
    const updated = [notif, ...notifications];
    setNotifications(updated);
    await AsyncStorage.setItem('notifications', JSON.stringify(updated));
    console.log('[Storage] Notification saved successfully');

    // Fire-and-forget: persist to DB (uses the UUID-normalised notif, not the raw input)
    if (user?.id && company?.id) {
      supabase.from('notifications').insert({
        id: notif.id,
        user_id: user.id!,
        company_id: company.id!,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        data: notif.data,
        read: false,
      }).then(({ error }) => {
        if (error) console.warn('[Notifications] DB persist failed (non-fatal):', error);
      });
    }
  }, [notifications, user, company]);

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

    // Fire-and-forget: sync read state to DB
    if (user?.id) {
      supabase.from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id!)
        .then(({ error }) => {
          if (error) console.warn('[Notifications] DB mark-read failed (non-fatal):', error);
        });
    }
  }, [notifications, user]);

  // Schedule/Appointment Management
  const addAppointment = useCallback(async (appointment: any) => {
    // For now, store in local state - you can add API call later
    console.log('[AppContext] Appointment added:', appointment);
  }, []);

  const deleteAppointment = useCallback(async (appointmentId: string) => {
    console.log('[AppContext] Appointment deleted:', appointmentId);
  }, []);

  // Team Management
  const addTeamMember = useCallback(async (member: any) => {
    console.log('[AppContext] Team member added:', member);
  }, []);

  const assignTeamToProject = useCallback(async (data: any) => {
    console.log('[AppContext] Team member assigned to project:', data);
  }, []);

  // Delete client
  const deleteClient = useCallback(async (clientId: string) => {
    try {
      const response = await fetch('/api/delete-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, companyId: company?.id }),
      });
      if (response.ok) {
        setClients(prev => prev.filter(c => c.id !== clientId));
      }
    } catch (error) {
      console.error('[AppContext] Error deleting client:', error);
      setClients(prev => prev.filter(c => c.id !== clientId));
    }
  }, [company?.id]);

  // Update expense
  const updateExpense = useCallback(async (expenseId: string, updates: Partial<Expense>) => {
    try {
      const response = await fetch('/api/update-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId, updates, companyId: company?.id }),
      });
      if (response.ok) {
        setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, ...updates } : e));
      }
    } catch (error) {
      console.error('[AppContext] Error updating expense:', error);
      setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, ...updates } : e));
    }
  }, [company?.id]);

  // Delete expense
  const deleteExpense = useCallback(async (expenseId: string) => {
    try {
      const response = await fetch('/api/delete-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId, companyId: company?.id }),
      });
      if (response.ok) {
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
      }
    } catch (error) {
      console.error('[AppContext] Error deleting expense:', error);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
    }
  }, [company?.id]);

  // Delete task
  const deleteTask = useCallback(async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  // Delete photo
  const deletePhoto = useCallback(async (photoId: string) => {
    try {
      const response = await fetch('/api/delete-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, companyId: company?.id }),
      });
      if (response.ok) {
        setPhotos(prev => prev.filter(p => p.id !== photoId));
      }
    } catch (error) {
      console.error('[AppContext] Error deleting photo:', error);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    }
  }, [company?.id]);

  // ===== DAILY TASKS MANAGEMENT =====
  const loadDailyTasks = useCallback(async () => {
    if (!user?.id || !company?.id) return;
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-daily-tasks?companyId=${company.id}&userId=${user.id}`);
      if (response.ok) {
        const tasks = await response.json();
        if (Array.isArray(tasks)) {
          setDailyTasks(tasks);
        }
      }
    } catch (error) {
      console.error('[AppContext] Error loading daily tasks:', error);
    }
  }, [user?.id, company?.id]);

  const addDailyTask = useCallback(async (task: Omit<DailyTask, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Optimistic update first
    const tempTask: DailyTask = {
      ...task,
      id: `temp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDailyTasks(prev => [...prev, tempTask]);

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/add-daily-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: task.companyId,
          userId: task.userId,
          title: task.title,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          dueDateTime: task.dueDateTime,
          reminder: task.reminder,
          notes: task.notes,
        }),
      });

      if (response.ok) {
        const newTask = await response.json();
        // Replace temp task with real one from DB
        setDailyTasks(prev => prev.map(t => t.id === tempTask.id ? newTask : t));

        // Notify the assignee when an admin creates a task for someone else.
        // Fire-and-forget — does not block the optimistic UI update.
        if (task.userId && task.userId !== user?.id && task.companyId) {
          supabase.from('notifications').insert({
            user_id: task.userId,
            company_id: task.companyId,
            type: 'general',
            title: 'New Task Assigned',
            message: task.title,
            data: { taskId: newTask.id ?? tempTask.id },
            read: false,
          }).then(({ error }) => {
            if (error) console.warn('[Notifications] Task assignment notify failed:', error);
          });
        }

        return newTask;
      }
    } catch (error) {
      console.error('[AppContext] Error adding daily task:', error);
    }
    return tempTask;
  }, [user?.id]);

  const updateDailyTask = useCallback(async (taskId: string, updates: Partial<DailyTask>) => {
    // Optimistic update
    setDailyTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ));

    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/update-daily-task`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, updates }),
      });
    } catch (error) {
      console.error('[AppContext] Error updating daily task:', error);
    }
  }, []);

  const deleteDailyTask = useCallback(async (taskId: string) => {
    // Optimistic update
    setDailyTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/delete-daily-task`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
    } catch (error) {
      console.error('[AppContext] Error deleting daily task:', error);
    }
  }, []);

  const loadScheduledTasks = useCallback(async (projectId: string) => {
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/get-scheduled-tasks?projectId=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      setScheduledTasks(prev => [
        ...prev.filter(t => t.projectId !== projectId),
        ...(data.scheduledTasks ?? []),
      ]);
    } catch (e) {
      console.error('[Schedule] loadScheduledTasks error', e);
    }
  }, []);

  const updateScheduledTasks = useCallback(async (newTasks: ScheduledTask[]) => {
    const base = getApiBaseUrl();
    setScheduledTasks(prev => {
      const old = prev;
      const added    = newTasks.filter(t => !old.find(o => o.id === t.id));
      const modified = newTasks.filter(t => {
        const o = old.find(o => o.id === t.id);
        return o && JSON.stringify(o) !== JSON.stringify(t);
      });
      const removed  = old.filter(o => !newTasks.find(t => t.id === o.id));
      Promise.all([
        ...added.map(t => fetch(`${base}/api/save-scheduled-task`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t),
        })),
        ...modified.map(t => fetch(`${base}/api/update-scheduled-task`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t),
        })),
        ...removed.map(t => fetch(`${base}/api/delete-scheduled-task?id=${t.id}`, { method: 'DELETE' })),
      ]).catch(e => console.error('[Schedule] updateScheduledTasks sync error', e));
      return newTasks;
    });
  }, []);

  const addDailyTaskReminder = useCallback(async (task: Omit<DailyTaskReminder, 'id' | 'createdAt'>) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/add-daily-task`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: task.title, dueDate: task.dueDate, reminder: task.isReminder, projectId: task.projectId }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const reminder: DailyTaskReminder = {
      id: data.task.id,
      title: data.task.title,
      dueDate: data.task.dueDate,
      isReminder: data.task.reminder,
      completed: data.task.completed,
      createdAt: data.task.createdAt,
      projectId: task.projectId,
    };
    setDailyTaskReminders(prev => [...prev, reminder]);
  }, []);

  const updateDailyTaskReminder = useCallback(async (id: string, updates: Partial<DailyTaskReminder>) => {
    const base = getApiBaseUrl();
    await fetch(`${base}/api/update-daily-task`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: id, completed: updates.completed }),
    });
    setDailyTaskReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const deleteDailyTaskReminder = useCallback(async (id: string) => {
    const base = getApiBaseUrl();
    await fetch(`${base}/api/delete-daily-task?taskId=${id}`, { method: 'DELETE' });
    setDailyTaskReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  const getDailyTaskReminders = useCallback((projectId?: string): DailyTaskReminder[] => {
    if (projectId) return dailyTaskReminders.filter(r => r.projectId === projectId);
    return dailyTaskReminders;
  }, [dailyTaskReminders]);

  const generateShareLink = useCallback(async (projectId: string, password?: string, expiresAt?: string): Promise<ScheduleShareLink> => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/generate-schedule-share-link`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, companyId: company?.id, password, expiresAt }),
    });
    const data = await res.json();
    const link: ScheduleShareLink = data.link;
    setScheduleShareLinks(prev => [...prev.filter(l => l.projectId !== projectId), link]);
    return link;
  }, [company?.id]);

  const disableShareLink = useCallback(async (token: string): Promise<boolean> => {
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/disable-schedule-share-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[disableShareLink] API error:', res.status, err);
        return false;
      }
      setScheduleShareLinks(prev => prev.map(l => l.token === token ? { ...l, enabled: false } : l));
      return true;
    } catch (e) {
      console.error('[disableShareLink] Network error:', e);
      return false;
    }
  }, []);

  const regenerateShareLink = useCallback(async (projectId: string, password?: string, expiresAt?: string): Promise<ScheduleShareLink> => {
    return generateShareLink(projectId, password, expiresAt);
  }, [generateShareLink]);

  const getShareLinkByToken = useCallback((token: string) => {
    return scheduleShareLinks.find(l => l.token === token);
  }, [scheduleShareLinks]);

  const getShareLinkByProject = useCallback((projectId: string) => {
    return scheduleShareLinks.find(l => l.projectId === projectId);
  }, [scheduleShareLinks]);

  const logout = useCallback(async () => {
    // Fire-and-forget: deactivate all push tokens so the device stops receiving
    // notifications after logout. Non-blocking — we clear local state regardless.
    if (user?.id) {
      supabase.from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', user.id!)
        .then(({ error }) => {
          if (error) console.warn('[Notifications] Token deactivation on logout failed:', error);
        });
    }

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
  }, [user]);

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
    priceListItems,
    priceListCategories,
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
    dailyTasks,
    scheduledTasks,
    scheduleShareLinks,
    dailyTaskReminders,
    isLoading,
    loadScheduledTasks,
    updateScheduledTasks,
    addDailyTaskReminder,
    updateDailyTaskReminder,
    deleteDailyTaskReminder,
    getDailyTaskReminders,
    generateShareLink,
    disableShareLink,
    regenerateShareLink,
    getShareLinkByToken,
    getShareLinkByProject,
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
    updateCustomPriceListItem,
    addCustomCategory,
    deleteCustomCategory,
    addPhotoCategory,
    updatePhotoCategory,
    deletePhotoCategory,
    addCallLog,
    updateCallLog,
    deleteCallLog,
    setCallLogs,
    addConversation,
    addMessageToConversation,
    addReport,
    deleteReport,
    refreshReports,
    addProjectFile,
    updateProjectFile,
    deleteProjectFile,
    addDailyLog,
    updateDailyLog,
    deleteDailyLog,
    addPayment,
    getPayments,
    sendPaymentRequest,
    sendSMS,
    sendEmail,
    sendBulkSMS,
    initiateCall,
    addChangeOrder,
    updateChangeOrder,
    getChangeOrders,
    addSubcontractor,
    updateSubcontractor,
    getSubcontractors,
    assignSubcontractor,
    addProposal,
    getProposals,
    addNotification,
    getNotifications,
    markNotificationRead,
    addAppointment,
    deleteAppointment,
    addTeamMember,
    assignTeamToProject,
    deleteClient,
    updateExpense,
    deleteExpense,
    deleteTask,
    deletePhoto,
    refreshClients,
    refreshEstimates,
    refreshExpenses,
    refreshDailyLogs,
    refreshPhotos,
    refreshSubcontractors,
    refreshNotifications,
    loadDailyTasks,
    addDailyTask,
    updateDailyTask,
    deleteDailyTask,
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
    priceListItems,
    priceListCategories,
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
    dailyTasks,
    scheduledTasks,
    scheduleShareLinks,
    dailyTaskReminders,
    isLoading,
    loadScheduledTasks,
    updateScheduledTasks,
    addDailyTaskReminder,
    updateDailyTaskReminder,
    deleteDailyTaskReminder,
    getDailyTaskReminders,
    generateShareLink,
    disableShareLink,
    regenerateShareLink,
    getShareLinkByToken,
    getShareLinkByProject,
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
    updateCustomPriceListItem,
    addCustomCategory,
    deleteCustomCategory,
    addPhotoCategory,
    updatePhotoCategory,
    deletePhotoCategory,
    addCallLog,
    updateCallLog,
    deleteCallLog,
    setCallLogs,
    addConversation,
    addMessageToConversation,
    addReport,
    deleteReport,
    refreshReports,
    addProjectFile,
    updateProjectFile,
    deleteProjectFile,
    addDailyLog,
    updateDailyLog,
    deleteDailyLog,
    addPayment,
    getPayments,
    sendPaymentRequest,
    sendSMS,
    sendEmail,
    sendBulkSMS,
    initiateCall,
    addChangeOrder,
    updateChangeOrder,
    getChangeOrders,
    addSubcontractor,
    updateSubcontractor,
    getSubcontractors,
    assignSubcontractor,
    addProposal,
    getProposals,
    addNotification,
    getNotifications,
    markNotificationRead,
    addAppointment,
    deleteAppointment,
    addTeamMember,
    assignTeamToProject,
    deleteClient,
    updateExpense,
    deleteExpense,
    deleteTask,
    deletePhoto,
    refreshClients,
    refreshEstimates,
    refreshExpenses,
    refreshDailyLogs,
    refreshPhotos,
    refreshSubcontractors,
    refreshNotifications,
    loadDailyTasks,
    addDailyTask,
    updateDailyTask,
    deleteDailyTask,
    logout,
  ]);
});
