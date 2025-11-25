// Enums
export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum BillingMode {
  FIXED_TOTAL = 'FIXED_TOTAL',
  RECURRING_PERIOD = 'RECURRING_PERIOD',
  HOURLY = 'HOURLY',
}

export enum RecurringPeriodType {
  MONTHLY = 'MONTHLY',
  WEEKLY = 'WEEKLY',
  CUSTOM = 'CUSTOM',
}

export enum TodoPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateInput {
  email: string;
  password: string;
  name?: string;
}

export interface UserLoginInput {
  email: string;
  password: string;
}

export interface UserUpdateInput {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}

// Project types
export interface Project {
  id: string;
  userId: string;
  name: string;
  clientName: string | null;
  description: string | null;
  status: ProjectStatus;
  billingMode: BillingMode;
  fixedTotalAmount: number | null;
  recurringAmount: number | null;
  recurringPeriodType: RecurringPeriodType | null;
  hourlyRate: number | null;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCreateInput {
  name: string;
  clientName?: string;
  description?: string;
  status?: ProjectStatus;
  billingMode: BillingMode;
  fixedTotalAmount?: number;
  recurringAmount?: number;
  recurringPeriodType?: RecurringPeriodType;
  hourlyRate?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
}

export interface ProjectUpdateInput extends Partial<ProjectCreateInput> {}

export interface ProjectWithStats extends Project {
  totalHours: number;
  totalIncome: number;
  effectiveHourlyRate: number | null;
  activeTimeEntry?: TimeEntry | null;
}

// TimeEntry types
export interface TimeEntry {
  id: string;
  projectId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  note: string | null;
  billingPeriodStart: Date | null;
  billingPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntryWithAmount extends TimeEntry {
  amount?: number;
}

export interface TimeEntryCreateInput {
  note?: string;
}

export interface TimeEntryUpdateInput {
  startedAt?: string;
  endedAt?: string;
  note?: string;
}

// ProjectTodo types
export interface ProjectTodo {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: TodoPriority;
  dueDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoCreateInput {
  title: string;
  description?: string;
  priority?: TodoPriority;
  dueDate?: string;
}

export interface TodoUpdateInput extends Partial<TodoCreateInput> {
  completed?: boolean;
}

// Invoice types
export interface Invoice {
  id: string;
  userId: string;
  projectId: string | null;
  issueDate: Date;
  dueDate: Date | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  externalNumber: string | null;
  notes: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project?: Project | null;
}

export interface InvoiceCreateInput {
  projectId?: string;
  issueDate: string;
  dueDate?: string;
  amount: number;
  currency?: string;
  status?: InvoiceStatus;
  externalNumber?: string;
  notes?: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface InvoiceUpdateInput extends Partial<InvoiceCreateInput> {}

// Payment types
export interface Payment {
  id: string;
  invoiceId: string;
  userId: string;
  projectId: string | null;
  paymentDate: Date;
  amount: number;
  currency: string;
  method: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  invoice?: Invoice;
  project?: Project | null;
}

export interface PaymentCreateInput {
  invoiceId: string;
  projectId?: string;
  paymentDate: string;
  amount: number;
  currency?: string;
  method?: string;
  notes?: string;
}

export interface PaymentUpdateInput extends Partial<PaymentCreateInput> {}

// Analytics types
export interface EarningsByPeriod {
  period: string;
  totalAmount: number;
  currency: string;
}

export interface EarningsByProject {
  projectId: string;
  projectName: string;
  totalAmount: number;
  currency: string;
}

export interface TimeByProject {
  projectId: string;
  projectName: string;
  totalMinutes: number;
  totalHours: number;
}

export interface TimeByPeriod {
  period: string;
  totalMinutes: number;
  totalHours: number;
}

export interface DashboardStats {
  totalIncomeMonth: number;
  totalHoursMonth: number;
  activeProjectsCount: number;
  incomeByMonth: EarningsByPeriod[];
  topProjects: ProjectWithStats[];
}

export interface ProjectAnalytics {
  totalHours: number;
  totalIncome: number;
  effectiveHourlyRate: number | null;
  hoursByPeriod: TimeByPeriod[];
  incomeByPeriod: EarningsByPeriod[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  user: User;
}

