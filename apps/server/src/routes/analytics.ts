import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { calculateProjectStats } from '../utils/billing';

export const analyticsRouter = Router();

// Get earnings grouped by period
analyticsRouter.get('/earnings', async (req: AuthRequest, res: Response) => {
  try {
    const { groupBy = 'month', months = '12' } = req.query;
    const monthsCount = parseInt(months as string) || 12;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsCount);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const payments = await prisma.payment.findMany({
      where: {
        userId: req.userId,
        paymentDate: { gte: startDate },
      },
      orderBy: { paymentDate: 'asc' },
    });

    // Group payments by period
    const earningsByPeriod: Record<string, number> = {};

    payments.forEach((payment) => {
      const date = new Date(payment.paymentDate);
      let period: string;

      if (groupBy === 'day') {
        period = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        period = weekStart.toISOString().split('T')[0];
      } else {
        // month
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      earningsByPeriod[period] = (earningsByPeriod[period] || 0) + Number(payment.amount);
    });

    // Convert to array
    const data = Object.entries(earningsByPeriod)
      .map(([period, totalAmount]) => ({
        period,
        totalAmount,
        currency: 'EUR',
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ success: false, error: 'Failed to get earnings' });
  }
});

// Get earnings by project
analyticsRouter.get('/earnings/by-project', async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'all', months = '12' } = req.query;

    let startDate: Date | undefined;
    if (period !== 'all') {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - parseInt(months as string));
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    const payments = await prisma.payment.groupBy({
      by: ['projectId'],
      where: {
        userId: req.userId,
        projectId: { not: null },
        ...(startDate && { paymentDate: { gte: startDate } }),
      },
      _sum: { amount: true },
    });

    // Get project names
    const projectIds = payments.map((p) => p.projectId).filter(Boolean) as string[];
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });

    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const data = payments
      .filter((p) => p.projectId)
      .map((p) => ({
        projectId: p.projectId!,
        projectName: projectMap.get(p.projectId!) || 'Unknown',
        totalAmount: Number(p._sum.amount) || 0,
        currency: 'EUR',
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get earnings by project error:', error);
    res.status(500).json({ success: false, error: 'Failed to get earnings by project' });
  }
});

// Get time tracked grouped by period or project
analyticsRouter.get('/time', async (req: AuthRequest, res: Response) => {
  try {
    const { groupBy = 'project', period = 'month', projectId, months = '12' } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months as string));
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const where: any = {
      userId: req.userId,
      startedAt: { gte: startDate },
      durationMinutes: { not: null },
    };

    if (projectId) {
      where.projectId = projectId as string;
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where,
      include: { project: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'asc' },
    });

    if (groupBy === 'project') {
      // Group by project
      const timeByProject: Record<string, { name: string; minutes: number }> = {};

      timeEntries.forEach((entry) => {
        const projectId = entry.projectId;
        if (!timeByProject[projectId]) {
          timeByProject[projectId] = { name: entry.project.name, minutes: 0 };
        }
        timeByProject[projectId].minutes += entry.durationMinutes || 0;
      });

      const data = Object.entries(timeByProject).map(([projectId, { name, minutes }]) => ({
        projectId,
        projectName: name,
        totalMinutes: minutes,
        totalHours: Math.round((minutes / 60) * 100) / 100,
      }));

      res.json({ success: true, data });
    } else {
      // Group by period (day/week/month)
      const timeByPeriod: Record<string, number> = {};

      timeEntries.forEach((entry) => {
        const date = new Date(entry.startedAt);
        let periodKey: string;

        if (period === 'day') {
          periodKey = date.toISOString().split('T')[0];
        } else if (period === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
        } else {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        timeByPeriod[periodKey] = (timeByPeriod[periodKey] || 0) + (entry.durationMinutes || 0);
      });

      const data = Object.entries(timeByPeriod)
        .map(([period, totalMinutes]) => ({
          period,
          totalMinutes,
          totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      res.json({ success: true, data });
    }
  } catch (error) {
    console.error('Get time error:', error);
    res.status(500).json({ success: false, error: 'Failed to get time data' });
  }
});

// Get dashboard stats
analyticsRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Total income current month
    const monthPayments = await prisma.payment.aggregate({
      where: {
        userId: req.userId,
        paymentDate: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    // Total hours current month
    const monthTimeEntries = await prisma.timeEntry.aggregate({
      where: {
        userId: req.userId,
        startedAt: { gte: startOfMonth },
        durationMinutes: { not: null },
      },
      _sum: { durationMinutes: true },
    });

    // Active projects count
    const activeProjectsCount = await prisma.project.count({
      where: {
        userId: req.userId,
        status: 'ACTIVE',
      },
    });

    // Income by month for last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const yearPayments = await prisma.payment.findMany({
      where: {
        userId: req.userId,
        paymentDate: { gte: twelveMonthsAgo },
      },
    });

    const incomeByMonth: Record<string, number> = {};
    yearPayments.forEach((payment) => {
      const date = new Date(payment.paymentDate);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      incomeByMonth[month] = (incomeByMonth[month] || 0) + Number(payment.amount);
    });

    // Fill in missing months with 0
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!incomeByMonth[month]) incomeByMonth[month] = 0;
    }

    // Top projects by income
    const projectPayments = await prisma.payment.groupBy({
      by: ['projectId'],
      where: {
        userId: req.userId,
        projectId: { not: null },
        paymentDate: { gte: startOfYear },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });

    const topProjectIds = projectPayments.map((p) => p.projectId).filter(Boolean) as string[];
    const topProjects = await prisma.project.findMany({
      where: { id: { in: topProjectIds } },
      include: { timeEntries: { select: { durationMinutes: true } } },
    });

    const topProjectsWithStats = await Promise.all(
      topProjects.map(async (project) => {
        const stats = await calculateProjectStats(project);
        const income =
          projectPayments.find((p) => p.projectId === project.id)?._sum.amount || 0;
        return {
          ...project,
          ...stats,
          totalIncome: Number(income),
        };
      })
    );

    res.json({
      success: true,
      data: {
        totalIncomeMonth: Number(monthPayments._sum.amount) || 0,
        totalHoursMonth:
          Math.round(((monthTimeEntries._sum.durationMinutes || 0) / 60) * 100) / 100,
        activeProjectsCount,
        incomeByMonth: Object.entries(incomeByMonth)
          .map(([period, totalAmount]) => ({ period, totalAmount, currency: 'EUR' }))
          .sort((a, b) => a.period.localeCompare(b.period)),
        topProjects: topProjectsWithStats.sort((a, b) => b.totalIncome - a.totalIncome),
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get dashboard stats' });
  }
});

// Get project analytics
analyticsRouter.get('/project/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
      include: {
        timeEntries: true,
        payments: true,
      },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const stats = await calculateProjectStats(project);

    // Hours by period (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const hoursByPeriod: Record<string, number> = {};
    project.timeEntries
      .filter((e) => e.startedAt >= sixMonthsAgo && e.durationMinutes)
      .forEach((entry) => {
        const date = new Date(entry.startedAt);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        hoursByPeriod[period] = (hoursByPeriod[period] || 0) + (entry.durationMinutes || 0);
      });

    // Income by period (last 6 months)
    const incomeByPeriod: Record<string, number> = {};
    project.payments
      .filter((p) => p.paymentDate >= sixMonthsAgo)
      .forEach((payment) => {
        const date = new Date(payment.paymentDate);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        incomeByPeriod[period] = (incomeByPeriod[period] || 0) + Number(payment.amount);
      });

    res.json({
      success: true,
      data: {
        ...stats,
        hoursByPeriod: Object.entries(hoursByPeriod)
          .map(([period, totalMinutes]) => ({
            period,
            totalMinutes,
            totalHours: Math.round((totalMinutes / 60) * 100) / 100,
          }))
          .sort((a, b) => a.period.localeCompare(b.period)),
        incomeByPeriod: Object.entries(incomeByPeriod)
          .map(([period, totalAmount]) => ({ period, totalAmount, currency: 'EUR' }))
          .sort((a, b) => a.period.localeCompare(b.period)),
      },
    });
  } catch (error) {
    console.error('Get project analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get project analytics' });
  }
});

