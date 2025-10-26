export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee' | 'sales';
  avatar?: string;
}

export interface Project {
  id: string;
  name: string;
  budget: number;
  expenses: number;
  progress: number;
  status: 'active' | 'completed' | 'on-hold' | 'archived';
  image: string;
  hoursWorked: number;
  startDate: string;
  endDate?: string;
}

export interface Expense {
  id: string;
  projectId: string;
  type: string;
  subcategory: string;
  amount: number;
  store: string;
  date: string;
  receiptUrl?: string;
}

export interface Photo {
  id: string;
  projectId: string;
  category: string;
  notes: string;
  url: string;
  date: string;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  date: string;
  reminder: string;
  completed: boolean;
}

export interface DailyLog {
  id: string;
  projectId: string;
  date: string;
  note: string;
}

export interface ClockEntry {
  id: string;
  employeeId: string;
  projectId: string;
  clockIn: string;
  clockOut?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  workPerformed?: string;
  category?: string;
  lunchBreaks?: {
    startTime: string;
    endTime?: string;
  }[];
}

export interface Client {
  id: string;
  name: string;
  address?: string;
  email: string;
  phone: string;
  source: 'Google' | 'Referral' | 'Ad' | 'Other';
  status: 'Lead' | 'Project' | 'Completed';
  lastContacted: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text?: string;
  timestamp: string;
  type: 'text' | 'voice' | 'image' | 'file';
  content?: string;
  fileName?: string;
  duration?: number;
}

export interface ChatConversation {
  id: string;
  name: string;
  type: 'individual' | 'group';
  participants: string[];
  messages: ChatMessage[];
  lastMessage?: ChatMessage;
  avatar?: string;
  createdAt: string;
}

export interface Subscription {
  type: 'free-trial' | 'basic' | 'premium';
  startDate: string;
  endDate?: string;
}

export interface PriceListItem {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  unitPrice: number;
  laborCost?: number;
  materialCost?: number;
}

export interface EstimateItem {
  id: string;
  priceListItemId: string;
  quantity: number;
  unitPrice: number;
  customPrice?: number;
  total: number;
  budget?: number;
  budgetUnitPrice?: number;
  notes?: string;
  customName?: string;
  customUnit?: string;
  customCategory?: string;
}

export interface Estimate {
  id: string;
  projectId: string;
  name: string;
  items: EstimateItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  createdDate: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
}

export interface TakeoffMeasurement {
  id: string;
  type: 'count' | 'length' | 'area';
  points: { x: number; y: number }[];
  quantity: number;
  priceListItemId: string;
  notes?: string;
  color: string;
}

export interface TakeoffPlan {
  id: string;
  uri: string;
  name: string;
  measurements: TakeoffMeasurement[];
  scale?: number;
}

export interface CallLog {
  id: string;
  clientId?: string;
  callerName: string;
  callerPhone: string;
  callerEmail?: string;
  callDate: string;
  callDuration: string;
  callType: 'incoming' | 'outgoing';
  status: 'answered' | 'missed' | 'voicemail';
  isQualified: boolean;
  qualificationScore?: number;
  notes: string;
  transcript?: string;
  projectType?: string;
  budget?: string;
  startDate?: string;
  propertyType?: string;
  addedToCRM: boolean;
  scheduledFollowUp?: string;
}

export interface ProjectReportData {
  projectId: string;
  projectName: string;
  budget: number;
  expenses: number;
  hoursWorked: number;
  clockEntries: number;
  status: string;
  progress: number;
  startDate: string;
  endDate?: string;
  expensesByCategory: { [category: string]: number };
}

export interface EmployeeTimeData {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalDays: number;
  averageHoursPerDay: number;
  clockEntries: ClockEntry[];
}

export interface Report {
  id: string;
  name: string;
  type: 'administrative' | 'financial' | 'time-tracking' | 'custom';
  generatedDate: string;
  projectIds: string[];
  projectsCount?: number;
  totalBudget?: number;
  totalExpenses?: number;
  totalHours?: number;
  projects?: ProjectReportData[];
  fileUrl?: string;
  notes?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  employeeData?: EmployeeTimeData[];
  employeeIds?: string[];
}

export type FileCategory = 'receipts' | 'photos' | 'reports' | 'plans' | 'estimates' | 'documentation' | 'other';

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  category: FileCategory;
  fileType: string;
  fileSize: number;
  uri: string;
  uploadDate: string;
  notes?: string;
  annotations?: Annotation[];
}

export interface Annotation {
  id: string;
  type: 'text' | 'highlight' | 'drawing';
  pageNumber?: number;
  position: { x: number; y: number };
  content: string;
  color: string;
  createdDate: string;
}

export interface ScheduledTask {
  id: string;
  projectId: string;
  category: string;
  startDate: string;
  endDate: string;
  duration: number;
  workType: 'in-house' | 'subcontractor';
  notes?: string;
  color: string;
}
