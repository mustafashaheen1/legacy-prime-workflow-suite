export type UserRole = 'super-admin' | 'admin' | 'salesperson' | 'field-employee' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  avatar?: string;
  createdAt: string;
  isActive: boolean;
  phone?: string;
  address?: string;
  hourlyRate?: number;
  rateChangeRequest?: {
    newRate: number;
    requestDate: string;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedDate?: string;
  };
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
  estimateId?: string;
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
  fileSize?: number;      // File size in bytes
  fileType?: string;      // MIME type (e.g., image/jpeg)
  s3Key?: string;         // S3 object key
  compressed?: boolean;   // Whether image was compressed
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  date: string;
  reminder: string;
  completed: boolean;
}

export interface DailyLogNote {
  id: string;
  text: string;
  timestamp: string;
  author: string;
}

export interface DailyLogPhoto {
  id: string;
  uri: string;
  timestamp: string;
  author: string;
  notes?: string;
}

export interface DailyLogTask {
  id: string;
  description: string;
  completed: boolean;
}

export interface DailyLog {
  id: string;
  projectId: string;
  logDate: string;
  createdBy: string;
  equipmentNote?: string;
  materialNote?: string;
  officialNote?: string;
  subsNote?: string;
  employeesNote?: string;
  workPerformed: string;
  issues: string;
  generalNotes: string;
  tasks: DailyLogTask[];
  photos: DailyLogPhoto[];
  sharedWith: string[];
  createdAt: string;
}

export interface DailyLogReminder {
  id: string;
  dailyLogId: string;
  task: string;
  time: string;
  completed: boolean;
  notifiedAt?: string;
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
  source: 'Google' | 'Referral' | 'Ad' | 'Phone Call';
  status: 'Lead' | 'Project' | 'Completed';
  lastContacted: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  createdAt?: string;
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

export interface Company {
  id: string;
  name: string;
  logo?: string;
  brandColor: string;
  licenseNumber?: string;
  officePhone?: string;
  cellPhone?: string;
  address?: string;
  email?: string;
  website?: string;
  slogan?: string;
  estimateTemplate?: string;
  subscriptionStatus: 'trial' | 'active' | 'suspended' | 'cancelled';
  subscriptionPlan: 'basic' | 'pro' | 'enterprise';
  subscriptionStartDate: string;
  subscriptionEndDate?: string;
  employeeCount?: number;
  companyCode?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  settings: CompanySettings;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  features: {
    crm: boolean;
    estimates: boolean;
    schedule: boolean;
    expenses: boolean;
    photos: boolean;
    chat: boolean;
    reports: boolean;
    clock: boolean;
    dashboard: boolean;
  };
  maxUsers: number;
  maxProjects: number;
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
  isSeparator?: boolean;
  separatorLabel?: string;
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
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'paid';
  paidDate?: string;
  paymentId?: string;
}

export interface TakeoffMeasurement {
  id: string;
  type: 'count' | 'length' | 'area' | 'line' | 'rectangle' | 'circle' | 'polygon';
  points: { x: number; y: number }[];
  quantity: number;
  priceListItemId: string;
  notes?: string;
  color: string;
  shapeMetadata?: {
    width?: number;
    height?: number;
    radius?: number;
    center?: { x: number; y: number };
  };
}

export interface AnnotationElement {
  type: 'pen' | 'text' | 'rectangle' | 'circle' | 'arrow';
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  text?: string;
  id: string;
}

export interface TakeoffPlan {
  id: string;
  uri: string;
  name: string;
  measurements: TakeoffMeasurement[];
  scale?: number;
  annotations?: AnnotationElement[];
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
  type: 'administrative' | 'financial' | 'time-tracking' | 'expenses' | 'custom';
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
  expensesByCategory?: { [category: string]: number };
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
  row?: number;
  rowSpan?: number;
}

export interface Payment {
  id: string;
  projectId: string;
  amount: number;
  date: string;
  clientId?: string;
  clientName: string;
  method: 'cash' | 'check' | 'credit-card' | 'wire-transfer' | 'other';
  notes?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  description: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedDate?: string;
  notes?: string;
  createdAt: string;
}

export type Permission =
  | 'view:dashboard'
  | 'view:crm'
  | 'edit:crm'
  | 'view:estimates'
  | 'create:estimates'
  | 'view:projects'
  | 'edit:projects'
  | 'view:reports'
  | 'view:contracts'
  | 'view:schedule'
  | 'edit:schedule'
  | 'view:chat'
  | 'send:chat'
  | 'view:photos'
  | 'add:photos'
  | 'delete:photos'
  | 'add:expenses'
  | 'delete:expenses'
  | 'clock:in-out'
  | 'chatbot:unrestricted'
  | 'chatbot:no-financials'
  | 'chatbot:basic-only';

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

export interface AIChatSession {
  id: string;
  title: string;
  messages: any[];
  createdAt: string;
  updatedAt: string;
}

export type BusinessFileType = 'license' | 'insurance' | 'w9' | 'certificate' | 'other';

export interface BusinessFile {
  id: string;
  subcontractorId: string;
  type: BusinessFileType;
  name: string;
  fileType: string;
  fileSize: number;
  uri: string;
  uploadDate: string;
  expiryDate?: string;
  verified: boolean;
  verifiedBy?: string;
  verifiedDate?: string;
  notes?: string;
}

export interface Subcontractor {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  trade: string;
  rating?: number;
  hourlyRate?: number;
  availability: 'available' | 'busy' | 'unavailable';
  certifications?: string[];
  address?: string;
  insuranceExpiry?: string;
  notes?: string;
  avatar?: string;
  createdAt: string;
  isActive: boolean;
  approved: boolean;
  approvedBy?: string;
  approvedDate?: string;
  businessFiles?: BusinessFile[];
  registrationToken?: string;
  registrationCompleted?: boolean;
}

export interface EstimateRequest {
  id: string;
  projectId: string;
  subcontractorId: string;
  requestedBy: string;
  requestDate: string;
  description: string;
  requiredBy?: string;
  status: 'pending' | 'viewed' | 'responded' | 'declined';
  attachments?: ProjectFile[];
  notes?: string;
  createdAt: string;
}

export interface SubcontractorProposal {
  id: string;
  estimateRequestId: string;
  subcontractorId: string;
  projectId: string;
  amount: number;
  timeline: string;
  proposalDate: string;
  description: string;
  attachments?: ProjectFile[];
  notes?: string;
  status: 'submitted' | 'accepted' | 'rejected' | 'negotiating';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'estimate-received' | 'proposal-submitted' | 'payment-received' | 'change-order' | 'general';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}
