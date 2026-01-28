import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { User, Project, Client, Expense, Photo, Task, DailyTask, ClockEntry, Subscription, Estimate, CallLog, ChatConversation, ChatMessage, Report, ProjectFile, DailyLog, Payment, ChangeOrder, Company, Subcontractor, SubcontractorProposal, Notification } from '@/types';
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
  dailyTasks: DailyTask[];
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
  refreshDailyLogs: () => Promise<void>;
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
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

          // Load clients
          try {
            const clientsResponse = await fetch(
              `${baseUrl}/trpc/crm.getClients?input=${encodeURIComponent(JSON.stringify({ json: { companyId: company.id } }))}`
            );
            const clientsData = await clientsResponse.json();
            const clientsResult = clientsData.result.data.json;
            if (clientsResult.success && clientsResult.clients) {
              setClients(clientsResult.clients);
              console.log('[App] ✅ Loaded', clientsResult.clients.length, 'clients');
            } else {
              console.log('[App] ⚠️ getClients returned no data');
              setClients([]);
            }
          } catch (error: any) {
            console.error('[App] ❌ Error loading clients:', error?.message || error);
            setClients([]);
          }

          // Load projects
          try {
            const projectsResponse = await fetch(
              `${baseUrl}/trpc/projects.getProjects?input=${encodeURIComponent(JSON.stringify({ json: { companyId: company.id } }))}`
            );
            const projectsData = await projectsResponse.json();
            const projectsResult = projectsData.result.data.json;
            if (projectsResult.success && projectsResult.projects) {
              setProjects(projectsResult.projects);
              console.log('[App] ✅ Loaded', projectsResult.projects.length, 'projects');
            } else {
              setProjects([]);
            }
          } catch (error: any) {
            console.error('[App] Error loading projects:', error?.message || error);
            setProjects([]);
          }

          // Load expenses (using direct API endpoint)
          try {
            const expensesResponse = await fetch(
              `${baseUrl}/api/get-expenses?companyId=${company.id}`
            );
            if (expensesResponse.ok) {
              const expensesResult = await expensesResponse.json();
              if (expensesResult.success && expensesResult.expenses) {
                setExpenses(expensesResult.expenses);
                console.log('[App] ✅ Loaded', expensesResult.expenses.length, 'expenses');
              } else {
                setExpenses([]);
              }
            } else {
              console.error('[App] Error loading expenses:', expensesResponse.status);
              setExpenses([]);
            }
          } catch (error: any) {
            console.error('[App] Error loading expenses:', error?.message || error);
            setExpenses([]);
          }

          // Load photos
          try {
            const photosResponse = await fetch(
              `${baseUrl}/trpc/photos.getPhotos?input=${encodeURIComponent(JSON.stringify({ json: { companyId: company.id } }))}`
            );
            const photosData = await photosResponse.json();
            const photosResult = photosData.result.data.json;
            if (photosResult.photos) {
              setPhotos(photosResult.photos);
              console.log('[App] ✅ Loaded', photosResult.photos.length, 'photos');
            } else {
              setPhotos([]);
            }
          } catch (error: any) {
            console.error('[App] Error loading photos:', error?.message || error);
            setPhotos([]);
          }

          // Load photo categories from database
          try {
            const categoriesResponse = await fetch(
              `${baseUrl}/trpc/photoCategories.getPhotoCategories?input=${encodeURIComponent(JSON.stringify({ json: { companyId: company.id } }))}`
            );
            const categoriesData = await categoriesResponse.json();
            const categoriesResult = categoriesData.result.data.json;
            if (categoriesResult.success && categoriesResult.categories) {
              setPhotoCategories(categoriesResult.categories);
              console.log('[App] ✅ Loaded', categoriesResult.categories.length, 'photo categories');
            } else {
              setPhotoCategories([]);
            }
          } catch (error: any) {
            console.error('[App] Error loading photo categories:', error?.message || error);
            setPhotoCategories([]);
          }

          // Load tasks
          try {
            const tasksResponse = await fetch(
              `${baseUrl}/trpc/tasks.getTasks?input=${encodeURIComponent(JSON.stringify({ json: { companyId: company.id } }))}`
            );
            const tasksData = await tasksResponse.json();
            const tasksResult = tasksData.result.data.json;
            if (tasksResult.tasks) {
              setTasks(tasksResult.tasks);
              console.log('[App] ✅ Loaded', tasksResult.tasks.length, 'tasks');
            } else {
              setTasks([]);
            }
          } catch (error: any) {
            console.error('[App] Error loading tasks:', error?.message || error);
            setTasks([]);
          }

          // Load clock entries
          try {
            const clockResponse = await fetch(
              `${baseUrl}/trpc/clock.getClockEntries?input=${encodeURIComponent(JSON.stringify({ json: { companyId: company.id } }))}`
            );
            const clockData = await clockResponse.json();
            const clockResult = clockData.result.data.json;
            if (clockResult.entries) {
              setClockEntries(clockResult.entries);
              console.log('[App] ✅ Loaded', clockResult.entries.length, 'clock entries');
            } else {
              setClockEntries([]);
            }
          } catch (error: any) {
            console.error('[App] Error loading clock entries:', error?.message || error);
            setClockEntries([]);
          }

          // Load custom price list items
          try {
            const priceListResponse = await fetch(
              `${baseUrl}/trpc/priceList.getPriceList?input=${encodeURIComponent(JSON.stringify({ json: { companyId: company.id } }))}`
            );
            const priceListData = await priceListResponse.json();
            const priceListResult = priceListData.result.data.json;
            if (priceListResult.success && priceListResult.items) {
              // Filter for custom items only (company-specific)
              const customItems = priceListResult.items.filter((item: any) => item.isCustom);
              setCustomPriceListItems(customItems);
              console.log('[App] ✅ Loaded', customItems.length, 'custom price list items');
            } else {
              setCustomPriceListItems([]);
            }
          } catch (error: any) {
            console.error('[App] Error loading custom price list items:', error?.message || error);
            setCustomPriceListItems([]);
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

          console.log('[App] ✅ Finished reloading data after company change');
        } catch (error: any) {
          console.error('[App] ❌ Fatal error reloading data after company change:', error?.message || error);
        }
      })();
    }
  }, [company?.id, isLoading]);

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
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

          // Load clients
          try {
            const clientsResponse = await fetch(
              `${baseUrl}/trpc/crm.getClients?input=${encodeURIComponent(JSON.stringify({ json: { companyId: parsedCompany.id } }))}`
            );
            const clientsData = await clientsResponse.json();
            const clientsResult = clientsData.result.data.json;
            if (clientsResult.success && clientsResult.clients) {
              setClients(clientsResult.clients);
              console.log('[App] Loaded', clientsResult.clients.length, 'clients');
            } else {
              setClients(mockClients);
            }
          } catch (error) {
            console.error('[App] Error loading clients:', error);
            setClients(mockClients);
          }

          // Load projects
          try {
            const projectsResponse = await fetch(
              `${baseUrl}/trpc/projects.getProjects?input=${encodeURIComponent(JSON.stringify({ json: { companyId: parsedCompany.id } }))}`
            );
            const projectsData = await projectsResponse.json();
            const projectsResult = projectsData.result.data.json;
            if (projectsResult.success && projectsResult.projects) {
              setProjects(projectsResult.projects);
              console.log('[App] Loaded', projectsResult.projects.length, 'projects');
            } else {
              setProjects(mockProjects);
            }
          } catch (error) {
            console.error('[App] Error loading projects:', error);
            setProjects(mockProjects);
          }

          // Load expenses (using direct API endpoint)
          try {
            const expensesResponse = await fetch(
              `${baseUrl}/api/get-expenses?companyId=${parsedCompany.id}`
            );
            if (expensesResponse.ok) {
              const expensesResult = await expensesResponse.json();
              if (expensesResult.success && expensesResult.expenses) {
                setExpenses(expensesResult.expenses);
                console.log('[App] Loaded', expensesResult.expenses.length, 'expenses');
              } else {
                setExpenses(mockExpenses);
              }
            } else {
              console.error('[App] Error loading expenses:', expensesResponse.status);
              setExpenses(mockExpenses);
            }
          } catch (error) {
            console.error('[App] Error loading expenses:', error);
            setExpenses(mockExpenses);
          }

          // Load photos from database
          try {
            const photosResponse = await fetch(
              `${baseUrl}/trpc/photos.getPhotos?input=${encodeURIComponent(JSON.stringify({ json: { companyId: parsedCompany.id } }))}`
            );
            const photosData = await photosResponse.json();
            const photosResult = photosData.result.data.json;
            if (photosResult.photos) {
              setPhotos(photosResult.photos);
              console.log('[App] Loaded', photosResult.photos.length, 'photos from database');
            } else {
              setPhotos([]);
            }
          } catch (error) {
            console.error('[App] Error loading photos:', error);
            setPhotos([]);
          }

          // Load photo categories from database
          try {
            const categoriesResponse = await fetch(
              `${baseUrl}/trpc/photoCategories.getPhotoCategories?input=${encodeURIComponent(JSON.stringify({ json: { companyId: parsedCompany.id } }))}`
            );
            const categoriesData = await categoriesResponse.json();
            const categoriesResult = categoriesData.result.data.json;
            if (categoriesResult.success && categoriesResult.categories) {
              setPhotoCategories(categoriesResult.categories);
              console.log('[App] Loaded', categoriesResult.categories.length, 'photo categories from database');
            } else {
              setPhotoCategories([]);
            }
          } catch (error) {
            console.error('[App] Error loading photo categories:', error);
            setPhotoCategories([]);
          }

          // Load clock entries from database
          try {
            const clockResponse = await fetch(
              `${baseUrl}/trpc/clock.getClockEntries?input=${encodeURIComponent(JSON.stringify({ json: { companyId: parsedCompany.id } }))}`
            );
            const clockData = await clockResponse.json();
            const clockResult = clockData.result.data.json;
            if (clockResult.entries) {
              setClockEntries(clockResult.entries);
              console.log('[App] Loaded', clockResult.entries.length, 'clock entries from database');
            } else {
              setClockEntries([]);
            }
          } catch (error) {
            console.error('[App] Error loading clock entries:', error);
            setClockEntries([]);
          }

          // Load tasks from database
          try {
            const tasksResponse = await fetch(
              `${baseUrl}/trpc/tasks.getTasks?input=${encodeURIComponent(JSON.stringify({ json: { companyId: parsedCompany.id } }))}`
            );
            const tasksData = await tasksResponse.json();
            const tasksResult = tasksData.result.data.json;
            if (tasksResult.tasks) {
              setTasks(tasksResult.tasks);
              console.log('[App] Loaded', tasksResult.tasks.length, 'tasks from database');
            } else {
              setTasks([]);
            }
          } catch (error) {
            console.error('[App] Error loading tasks:', error);
            setTasks([]);
          }

          // Load custom price list items from database
          try {
            const priceListResponse = await fetch(
              `${baseUrl}/trpc/priceList.getPriceList?input=${encodeURIComponent(JSON.stringify({ json: { companyId: parsedCompany.id } }))}`
            );
            const priceListData = await priceListResponse.json();
            const priceListResult = priceListData.result.data.json;
            if (priceListResult.success && priceListResult.items) {
              // Filter for custom items only (company-specific)
              const customItems = priceListResult.items.filter((item: any) => item.isCustom);
              setCustomPriceListItems(customItems);
              console.log('[App] Loaded', customItems.length, 'custom price list items from database');
            } else {
              setCustomPriceListItems([]);
            }
          } catch (error) {
            console.error('[App] Error loading custom price list items:', error);
            // Fallback to AsyncStorage data if backend fails
            const parsedCustomItems = safeJsonParse<CustomPriceListItem[]>(storedCustomItems, 'customPriceListItems', []);
            if (Array.isArray(parsedCustomItems)) {
              setCustomPriceListItems(parsedCustomItems);
            }
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

          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
          const response = await fetch(`${baseUrl}/trpc/projects.addProject`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              json: {
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
              },
            }),
          });

          if (!response.ok) {
            throw new Error(`Backend sync failed: ${response.status}`);
          }

          const data = await response.json();
          const result = data.result.data.json;

          if (result.success && result.project) {
            console.log('[App] ✓ Project synced to backend with UUID:', result.project.id);

            // Update the project ID in state to use the database UUID
            setProjects(prev => prev.map(p =>
              p.id === project.id ? { ...p, id: result.project.id } : p
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

    // Save to backend
    try {
      const { vanillaClient } = await import('@/lib/trpc');
      await vanillaClient.projects.updateProject.mutate({ id, ...updates });
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
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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
      // Use direct HTTP fetch instead of tRPC dynamic import (which breaks in production)
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const clientsResponse = await fetch(
        `${baseUrl}/trpc/crm.getClients?input=${encodeURIComponent(JSON.stringify({ json: { companyId: company.id } }))}`
      );
      const clientsData = await clientsResponse.json();
      const clientsResult = clientsData.result.data.json;
      console.log('[App] 📦 Query result:', clientsResult);
      if (clientsResult.success && clientsResult.clients) {
        setClients(clientsResult.clients);
        console.log('[App] ✅ Refreshed', clientsResult.clients.length, 'clients');
        console.log('[App] 📋 Client names:', clientsResult.clients.map(c => c.name).join(', '));
      } else {
        console.log('[App] ⚠️ Query succeeded but no clients returned');
      }
    } catch (error) {
      console.error('[App] ❌ Error refreshing clients:', error);
    }
  }, [company]);

  const updateClient = useCallback(async (id: string, updates: Partial<Client>) => {
    // Update local state immediately for responsive UI
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    // Save to database
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(
        `${baseUrl}/trpc/crm.updateClient`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json: {
              clientId: id,
              updates,
            },
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        console.error('[App] Error updating client:', data.error);
        // Revert local state on error
        await refreshClients();
      } else if (data.result?.data?.json) {
        console.log('[App] Client updated successfully');
      } else {
        console.error('[App] Unexpected response format:', data);
        await refreshClients();
      }
    } catch (error) {
      console.error('[App] Error updating client:', error);
      // Revert local state on error
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
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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

  const refreshDailyLogs = useCallback(async () => {
    if (!company?.id) {
      console.log('[App] ⚠️ Cannot refresh daily logs - no company ID');
      return;
    }

    console.log('[App] 🔄 Refreshing daily logs...');
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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

        const response = await fetch(`${apiUrl}/api/add-expense`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            projectId: expense.projectId,
            type: expense.type,
            subcategory: expense.subcategory,
            amount: expense.amount,
            store: expense.store,
            date: expense.date,
            receiptUrl: expense.receiptUrl,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
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
        const response = await fetch(`${apiUrl}/api/save-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
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
        const { vanillaClient } = await import('@/lib/trpc');
        await vanillaClient.tasks.addTask.mutate({
          companyId: company.id,
          projectId: task.projectId,
          name: task.name,
          date: task.date,
          reminder: task.reminder,
          completed: task.completed,
        });
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
      const { vanillaClient } = await import('@/lib/trpc');
      await vanillaClient.tasks.updateTask.mutate({ id, ...updates });
      console.log('[App] Task updated in backend:', id);
    } catch (error) {
      console.error('[App] Error updating task in backend:', error);
    }
  }, []);

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
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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
    setCustomPriceListItems(prev => [...prev, item]);

    // Save to backend if company exists (non-blocking)
    if (company?.id) {
      try {
        const { vanillaClient } = await import('@/lib/trpc');
        const result = await vanillaClient.priceList.addPriceListItem.mutate({
          companyId: company.id,
          category: item.category,
          name: item.name,
          description: item.description || '',
          unit: item.unit,
          unitPrice: item.unitPrice,
          laborCost: item.laborCost,
          materialCost: item.materialCost,
          isCustom: true,
        });

        if (result.success && result.item) {
          // Update the item with the database ID
          setCustomPriceListItems(prev =>
            prev.map(i => i.id === item.id ? { ...i, id: result.item.id } : i)
          );
          console.log('[App] Custom price list item saved to backend:', item.name);
        }
      } catch (error) {
        console.error('[App] Error saving custom price list item to backend:', error);
        // Keep the item in state even if backend fails (offline-first)
        // Save to AsyncStorage as fallback
        const updated = [...customPriceListItems, item];
        await AsyncStorage.setItem('customPriceListItems', JSON.stringify(updated));
        console.log('[App] Saved custom price list item to AsyncStorage (offline):', item.name);
      }
    } else {
      // Fallback to AsyncStorage if no company
      const updated = [...customPriceListItems, item];
      await AsyncStorage.setItem('customPriceListItems', JSON.stringify(updated));
    }
  }, [company, customPriceListItems]);

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
    if (!company?.id) {
      console.error('[PhotoCategory] No company ID available');
      return;
    }

    if (photoCategories.includes(category)) {
      console.log('[PhotoCategory] Category already exists:', category);
      return;
    }

    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(
        `${baseUrl}/trpc/photoCategories.addPhotoCategory`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json: {
              companyId: company.id,
              name: category,
            },
          }),
        }
      );

      const data = await response.json();
      const result = data.result?.data?.json;

      if (result?.success) {
        setPhotoCategories([...photoCategories, category]);
        console.log('[PhotoCategory] Added category:', category);
      } else {
        console.error('[PhotoCategory] Failed to add category');
      }
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
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(
        `${baseUrl}/trpc/photoCategories.updatePhotoCategory`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json: {
              companyId: company.id,
              oldName,
              newName,
            },
          }),
        }
      );

      const data = await response.json();
      const result = data.result?.data?.json;

      if (result?.success) {
        // Update local state
        const updated = photoCategories.map(cat => cat === oldName ? newName : cat);
        setPhotoCategories(updated);

        const updatedPhotos = photos.map(p => p.category === oldName ? { ...p, category: newName } : p);
        setPhotos(updatedPhotos);

        console.log('[PhotoCategory] Updated category:', oldName, 'to', newName);
      } else {
        console.error('[PhotoCategory] Failed to update category');
      }
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
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(
        `${baseUrl}/trpc/photoCategories.deletePhotoCategory`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json: {
              companyId: company.id,
              name: category,
            },
          }),
        }
      );

      const data = await response.json();
      const result = data.result?.data?.json;

      if (result?.success) {
        const updated = photoCategories.filter(cat => cat !== category);
        setPhotoCategories(updated);
        console.log('[PhotoCategory] Deleted category:', category);
      } else {
        console.error('[PhotoCategory] Failed to delete category');
      }
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
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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
      // Convert photos to base64 if they have local URIs
      const photosWithData = await Promise.all(
        (log.photos || []).map(async (photo) => {
          // Skip if already uploaded to S3 (HTTP URL)
          if (photo.uri.startsWith('http')) {
            return null;
          }

          // Convert local URI to base64
          try {
            const base64 = await fetchLocalImageAsBase64(photo.uri);
            return {
              id: photo.id,
              fileData: base64,
              fileName: `photo-${photo.id}.jpg`,
              mimeType: 'image/jpeg',
              fileSize: base64.length,
              author: photo.author,
              notes: photo.notes,
            };
          } catch (error) {
            console.error('[Storage] Failed to convert photo to base64:', error);
            return null;
          }
        })
      );

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/save-daily-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          projectId: log.projectId,
          logDate: log.logDate,
          createdBy: log.createdBy, // User name (will be converted to UUID)
          equipmentNote: log.equipmentNote,
          materialNote: log.materialNote,
          officialNote: log.officialNote,
          subsNote: log.subsNote,
          employeesNote: log.employeesNote,
          workPerformed: log.workPerformed,
          issues: log.issues,
          generalNotes: log.generalNotes,
          tasks: log.tasks || [],
          photos: photosWithData.filter(p => p !== null),
          sharedWith: log.sharedWith || [], // Emails (will be converted to UUIDs)
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save daily log');
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
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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
  }, [payments, projects]);

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
    // Try to save to database first
    if (company?.id) {
      try {
        console.log('[Subcontractor] Saving to database for company:', company.id);
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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
    if (!user?.id) return;
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/get-daily-tasks?userId=${user.id}`);
      const data = await response.json();
      if (data.tasks) {
        setDailyTasks(data.tasks);
      }
    } catch (error) {
      console.error('[AppContext] Error loading daily tasks:', error);
    }
  }, [user?.id]);

  const addDailyTask = useCallback(async (task: Omit<DailyTask, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: DailyTask = {
      ...task,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDailyTasks(prev => [...prev, newTask]);
    return newTask;
  }, []);

  const updateDailyTask = useCallback(async (taskId: string, updates: Partial<DailyTask>) => {
    setDailyTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ));
  }, []);

  const deleteDailyTask = useCallback(async (taskId: string) => {
    setDailyTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

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
    dailyTasks,
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
    refreshDailyLogs,
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
    dailyTasks,
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
    refreshDailyLogs,
    loadDailyTasks,
    addDailyTask,
    updateDailyTask,
    deleteDailyTask,
    logout,
  ]);
});
