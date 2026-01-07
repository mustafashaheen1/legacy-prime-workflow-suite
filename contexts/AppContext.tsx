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
  refreshClients: () => Promise<void>;
  refreshEstimates: () => Promise<void>;
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

          // Load expenses
          try {
            const expensesResponse = await fetch(
              `${baseUrl}/trpc/expenses.getExpenses?input=${encodeURIComponent(JSON.stringify({ json: { companyId: company.id } }))}`
            );
            const expensesData = await expensesResponse.json();
            const expensesResult = expensesData.result.data.json;
            if (expensesResult.success && expensesResult.expenses) {
              setExpenses(expensesResult.expenses);
              console.log('[App] ✅ Loaded', expensesResult.expenses.length, 'expenses');
            } else {
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
            const estimatesResponse = await fetch(`${baseUrl}/api/get-estimates`);
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

          // Load expenses
          try {
            const expensesResponse = await fetch(
              `${baseUrl}/trpc/expenses.getExpenses?input=${encodeURIComponent(JSON.stringify({ json: { companyId: parsedCompany.id } }))}`
            );
            const expensesData = await expensesResponse.json();
            const expensesResult = expensesData.result.data.json;
            if (expensesResult.success && expensesResult.expenses) {
              setExpenses(expensesResult.expenses);
              console.log('[App] Loaded', expensesResult.expenses.length, 'expenses');
            } else {
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

  const addClient = useCallback(async (client: Client) => {
    // Optimistically update UI
    setClients(prev => [...prev, client]);

    // Save to backend if company exists
    if (company?.id) {
      try {
        const { vanillaClient } = await import('@/lib/trpc');
        await vanillaClient.crm.addClient.mutate({
          companyId: company.id,
          name: client.name,
          address: client.address,
          email: client.email,
          phone: client.phone,
          source: client.source,
          status: client.status,
          lastContacted: client.lastContacted,
          lastContactDate: client.lastContactDate,
          nextFollowUpDate: client.nextFollowUpDate,
        });
        console.log('[App] Client saved to backend:', client.name);
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
            clientId: id,
            updates,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        console.error('[App] Error updating client:', data.error);
        // Revert local state on error
        await refreshClients();
      } else {
        console.log('[App] Client updated successfully');
      }
    } catch (error) {
      console.error('[App] Error updating client:', error);
      // Revert local state on error
      await refreshClients();
    }
  }, [refreshClients]);

  const refreshEstimates = useCallback(async () => {
    console.log('[App] 🔄 Refreshing estimates...');
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/get-estimates`);

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
  }, []);

  const addExpense = useCallback(async (expense: Expense) => {
    // Optimistically update UI
    setExpenses(prev => [...prev, expense]);

    // Save to backend if company exists
    if (company?.id) {
      try {
        const { vanillaClient } = await import('@/lib/trpc');
        await vanillaClient.expenses.addExpense.mutate({
          companyId: company.id,
          projectId: expense.projectId,
          type: expense.type,
          subcategory: expense.subcategory,
          amount: expense.amount,
          store: expense.store,
          date: expense.date,
          receiptUrl: expense.receiptUrl,
        });
        console.log('[App] Expense saved to backend:', expense.amount);
      } catch (error) {
        console.error('[App] Error saving expense to backend:', error);
        setExpenses(prev => prev.filter(e => e.id !== expense.id));
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

  const addClockEntry = useCallback(async (entry: ClockEntry) => {
    // Optimistically update UI
    setClockEntries(prev => [...prev, entry]);

    // Clock in on backend if company and user exist
    if (company?.id && user?.id) {
      try {
        const { vanillaClient } = await import('@/lib/trpc');
        await vanillaClient.clock.clockIn.mutate({
          companyId: company.id,
          employeeId: user.id,
          projectId: entry.projectId,
          location: entry.location,
          workPerformed: entry.workPerformed,
          category: entry.category,
        });
        console.log('[App] Clocked in successfully');
      } catch (error) {
        console.error('[App] Error clocking in:', error);
        setClockEntries(prev => prev.filter(e => e.id !== entry.id));
        throw error;
      }
    }
  }, [company, user]);

  const updateClockEntry = useCallback(async (id: string, updates: Partial<ClockEntry>) => {
    // Optimistically update UI
    setClockEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));

    // If clocking out (clockOut is being set), call backend
    if (updates.clockOut) {
      try {
        const { vanillaClient } = await import('@/lib/trpc');
        await vanillaClient.clock.clockOut.mutate({
          entryId: id,
          workPerformed: updates.workPerformed,
          lunchBreaks: updates.lunchBreaks,
        });
        console.log('[App] Clocked out successfully');
      } catch (error) {
        console.error('[App] Error clocking out:', error);
      }
    }
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
    refreshClients,
    refreshEstimates,
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
    refreshClients,
    refreshEstimates,
    logout,
  ]);
});
