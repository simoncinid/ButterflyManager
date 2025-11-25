import { Project, TimeEntry, Payment, BillingMode } from '@prisma/client';
import { prisma } from '../index';

interface ProjectWithEntries extends Project {
  timeEntries?: Array<{
    durationMinutes: number | null;
    endedAt: Date | null;
    startedAt: Date;
  }>;
}

interface ProjectStats {
  totalHours: number;
  totalIncome: number;
  effectiveHourlyRate: number | null;
}

/**
 * Calculate project statistics based on billing mode
 */
export async function calculateProjectStats(project: ProjectWithEntries): Promise<ProjectStats> {
  // Get all completed time entries for the project
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      projectId: project.id,
      durationMinutes: { not: null },
    },
  });

  // Get all payments for the project
  const payments = await prisma.payment.findMany({
    where: { projectId: project.id },
  });

  // Calculate total hours
  const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0);
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

  // Calculate total income from payments
  const totalIncome = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  // Calculate effective hourly rate based on billing mode
  let effectiveHourlyRate: number | null = null;

  switch (project.billingMode) {
    case 'FIXED_TOTAL':
      // effectiveHourlyRate = fixedTotalAmount / totalHoursTrackedOnProject
      if (totalHours > 0 && project.fixedTotalAmount) {
        effectiveHourlyRate =
          Math.round((Number(project.fixedTotalAmount) / totalHours) * 100) / 100;
      }
      break;

    case 'RECURRING_PERIOD':
      // effectiveHourlyRate = recurringAmount / totalHoursTrackedInPeriod
      // For simplicity, we calculate the average across all periods
      if (totalHours > 0 && project.recurringAmount) {
        // Count how many billing periods have been tracked
        const periodCount = countBillingPeriods(timeEntries, project.recurringPeriodType);
        if (periodCount > 0) {
          const totalRecurring = Number(project.recurringAmount) * periodCount;
          effectiveHourlyRate = Math.round((totalRecurring / totalHours) * 100) / 100;
        }
      }
      break;

    case 'HOURLY':
      // For hourly projects, the effective rate is the hourly rate
      if (project.hourlyRate) {
        effectiveHourlyRate = Number(project.hourlyRate);
      }
      break;
  }

  return {
    totalHours,
    totalIncome,
    effectiveHourlyRate,
  };
}

/**
 * Count the number of distinct billing periods in time entries
 */
function countBillingPeriods(
  timeEntries: Array<{ startedAt: Date }>,
  periodType: string | null
): number {
  if (timeEntries.length === 0) return 0;

  const periods = new Set<string>();

  timeEntries.forEach((entry) => {
    const date = new Date(entry.startedAt);
    let periodKey: string;

    switch (periodType) {
      case 'WEEKLY':
        // Get week number
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
        break;
      case 'MONTHLY':
      default:
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }

    periods.add(periodKey);
  });

  return periods.size;
}

/**
 * Calculate amount for a single time entry (for hourly projects)
 */
export function calculateTimeEntryAmount(
  durationMinutes: number,
  hourlyRate: number
): number {
  return Math.round((hourlyRate * (durationMinutes / 60)) * 100) / 100;
}

/**
 * Calculate billable amount for a project based on billing mode
 */
export async function calculateProjectBillableAmount(project: Project): Promise<number> {
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      projectId: project.id,
      durationMinutes: { not: null },
    },
  });

  const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0);

  switch (project.billingMode) {
    case 'FIXED_TOTAL':
      return Number(project.fixedTotalAmount) || 0;

    case 'RECURRING_PERIOD':
      const periodCount = countBillingPeriods(timeEntries, project.recurringPeriodType);
      return (Number(project.recurringAmount) || 0) * periodCount;

    case 'HOURLY':
      return (Number(project.hourlyRate) || 0) * (totalMinutes / 60);

    default:
      return 0;
  }
}

/**
 * Get effective hourly rate by billing period for RECURRING_PERIOD projects
 */
export async function getEffectiveRatesByPeriod(
  projectId: string
): Promise<Array<{ period: string; hours: number; rate: number }>> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.billingMode !== 'RECURRING_PERIOD') {
    return [];
  }

  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      projectId,
      durationMinutes: { not: null },
    },
    orderBy: { startedAt: 'asc' },
  });

  // Group by period
  const periodHours: Record<string, number> = {};

  timeEntries.forEach((entry) => {
    const date = new Date(entry.startedAt);
    let periodKey: string;

    switch (project.recurringPeriodType) {
      case 'WEEKLY':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
        break;
      case 'MONTHLY':
      default:
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }

    periodHours[periodKey] = (periodHours[periodKey] || 0) + (entry.durationMinutes || 0);
  });

  const recurringAmount = Number(project.recurringAmount) || 0;

  return Object.entries(periodHours)
    .map(([period, minutes]) => {
      const hours = Math.round((minutes / 60) * 100) / 100;
      const rate = hours > 0 ? Math.round((recurringAmount / hours) * 100) / 100 : 0;
      return { period, hours, rate };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

