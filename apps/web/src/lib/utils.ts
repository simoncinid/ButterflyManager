import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

export function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy, HH:mm');
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatMonthYear(dateString: string): string {
  // Format: "2024-01" -> "Jan 2024"
  const [year, month] = dateString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return format(date, 'MMM yyyy');
}

export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function getBillingModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    FIXED_TOTAL: 'Fixed Total',
    RECURRING_PERIOD: 'Recurring',
    HOURLY: 'Hourly',
  };
  return labels[mode] || mode;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'success',
    PAUSED: 'warning',
    ARCHIVED: 'default',
    DRAFT: 'default',
    SENT: 'info',
    PAID: 'success',
    CANCELLED: 'danger',
    LOW: 'default',
    MEDIUM: 'warning',
    HIGH: 'danger',
  };
  return colors[status] || 'default';
}

export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
  };
  return labels[priority] || priority;
}

