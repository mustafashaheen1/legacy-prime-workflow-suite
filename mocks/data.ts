import { Project, Client, Expense, Photo, Task, DailyLog, User } from '@/types';

export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Downtown Office Complex',
    budget: 250000,
    expenses: 150000,
    progress: 60,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400',
    hoursWorked: 1200,
    startDate: '2025-01-15',
  },
  {
    id: '2',
    name: 'Riverside Residential',
    budget: 320000,
    expenses: 180000,
    progress: 45,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400',
    hoursWorked: 980,
    startDate: '2025-02-01',
  },
  {
    id: '3',
    name: 'Tech Campus Renovation',
    budget: 150000,
    expenses: 95000,
    progress: 75,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400',
    hoursWorked: 850,
    startDate: '2024-12-10',
  },
];

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1234567890',
    source: 'Google',
    status: 'Lead',
    lastContacted: '2023-11-01',
  },
  {
    id: '2',
    name: 'Emily Johnson',
    email: 'emily.johnson@example.com',
    phone: '+0987654321',
    source: 'Referral',
    status: 'Project',
    lastContacted: '2023-10-28',
  },
  {
    id: '3',
    name: 'Michael Williams',
    email: 'michael.williams@example.com',
    phone: '+1122334455',
    source: 'Ad',
    status: 'Lead',
    lastContacted: '2023-10-30',
  },
];

export const mockExpenses: Expense[] = [
  {
    id: '1',
    projectId: '1',
    type: 'Material',
    subcategory: 'Preconstruction',
    amount: 138,
    store: 'Home Depot',
    date: '2025-09-15',
  },
  {
    id: '2',
    projectId: '1',
    type: 'Labor',
    subcategory: 'Foundation',
    amount: 2500,
    store: 'Payroll',
    date: '2025-09-20',
  },
];

export const mockPhotos: Photo[] = [
  {
    id: '1',
    projectId: '1',
    category: 'Foundation Work',
    notes: 'Initial foundation pour completed',
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
    date: '2025-09-10',
  },
  {
    id: '2',
    projectId: '1',
    category: 'Concrete Pouring',
    notes: 'Second floor concrete work',
    url: 'https://images.unsplash.com/photo-1590856029826-c7a73142bbf1?w=400',
    date: '2025-09-18',
  },
  {
    id: '3',
    projectId: '1',
    category: 'Reinforced Foundation',
    notes: 'Steel reinforcement installation',
    url: 'https://images.unsplash.com/photo-1597476329446-b2c98b6d2f66?w=400',
    date: '2025-09-22',
  },
];

export const mockTasks: Task[] = [
  {
    id: '1',
    projectId: '1',
    name: 'Framing',
    date: '2023-10-25',
    reminder: '1 day before',
    completed: false,
  },
  {
    id: '2',
    projectId: '1',
    name: 'Painting',
    date: '2023-10-26',
    reminder: '2 days before',
    completed: false,
  },
  {
    id: '3',
    projectId: '1',
    name: 'Electrical Setup',
    date: '2023-10-27',
    reminder: '3 days before',
    completed: false,
  },
];

export const mockDailyLogs: DailyLog[] = [
  {
    id: '1',
    projectId: '1',
    date: '2025-09-28',
    note: 'Completed task review',
  },
];

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@legacyprime.com',
    role: 'admin',
    avatar: 'https://i.pravatar.cc/150?img=12',
  },
  {
    id: '2',
    name: 'Alice Johnson',
    email: 'alice@legacyprime.com',
    role: 'manager',
    avatar: 'https://i.pravatar.cc/150?img=45',
  },
  {
    id: '3',
    name: 'Bob Smith',
    email: 'bob@legacyprime.com',
    role: 'employee',
    avatar: 'https://i.pravatar.cc/150?img=33',
  },
  {
    id: '4',
    name: 'Sarah Wilson',
    email: 'sarah@legacyprime.com',
    role: 'employee',
    avatar: 'https://i.pravatar.cc/150?img=25',
  },
  {
    id: '5',
    name: 'Mike Davis',
    email: 'mike@legacyprime.com',
    role: 'employee',
    avatar: 'https://i.pravatar.cc/150?img=15',
  },
];

export const expenseCategories = [
  'Material',
  'Labor',
  'Equipment',
  'Permits',
  'Utilities',
  'Other',
];

export const expenseSubcategories = [
  'Preconstruction',
  'Foundation',
  'Framing',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Finishing',
];

export const photoCategories = [
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
