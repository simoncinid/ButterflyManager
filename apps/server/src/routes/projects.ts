import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ProjectStatus, BillingMode, RecurringPeriodType } from '../types/prisma';
import { calculateProjectStats } from '../utils/billing';

export const projectRouter = Router();

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  clientName: z.string().optional(),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional().default(ProjectStatus.ACTIVE),
  billingMode: z.nativeEnum(BillingMode),
  fixedTotalAmount: z.number().positive().optional(),
  recurringAmount: z.number().positive().optional(),
  recurringPeriodType: z.nativeEnum(RecurringPeriodType).optional(),
  hourlyRate: z.number().positive().optional(),
  currency: z.string().default('EUR'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

// Get all projects
projectRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, billingMode } = req.query;

    const where: any = { userId: req.userId };
    if (status) where.status = status as ProjectStatus;
    if (billingMode) where.billingMode = billingMode as BillingMode;

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        timeEntries: {
          select: { durationMinutes: true, endedAt: true, startedAt: true },
        },
        _count: {
          select: { todos: true, invoices: true },
        },
      },
    });

    // Calculate stats for each project
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const stats = await calculateProjectStats(project);
        const activeTimeEntry = await prisma.timeEntry.findFirst({
          where: { projectId: project.id, endedAt: null },
        });

        return {
          ...project,
          ...stats,
          activeTimeEntry,
          todoCount: project._count.todos,
          invoiceCount: project._count.invoices,
        };
      })
    );

    res.json({ success: true, data: projectsWithStats });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, error: 'Failed to get projects' });
  }
});

// Get single project
projectRouter.get('/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
      include: {
        timeEntries: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
        todos: {
          orderBy: [{ completed: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        },
        invoices: {
          orderBy: { issueDate: 'desc' },
          take: 5,
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 5,
        },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const stats = await calculateProjectStats(project);
    const activeTimeEntry = await prisma.timeEntry.findFirst({
      where: { projectId: project.id, endedAt: null },
    });

    res.json({
      success: true,
      data: { ...project, ...stats, activeTimeEntry },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Get project error:', error);
    res.status(500).json({ success: false, error: 'Failed to get project' });
  }
});

// Create project
projectRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        ...data,
        userId: req.userId!,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    console.error('Create project error:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

// Update project
projectRouter.put('/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateProjectSchema.parse(req.body);

    const existing = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    const project = await prisma.project.update({
      where: { id: req.params.projectId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });

    res.json({ success: true, data: project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Update project error:', error);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

// Delete/Archive project
projectRouter.delete('/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    // Soft delete by archiving
    await prisma.project.update({
      where: { id: req.params.projectId },
      data: { status: ProjectStatus.ARCHIVED },
    });

    res.json({ success: true, message: 'Project archived' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Delete project error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

// Archive project
projectRouter.post('/:projectId/archive', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    const project = await prisma.project.update({
      where: { id: req.params.projectId },
      data: { status: ProjectStatus.ARCHIVED },
    });

    res.json({ success: true, data: project });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Archive project error:', error);
    res.status(500).json({ success: false, error: 'Failed to archive project' });
  }
});

// Unarchive project
projectRouter.post('/:projectId/unarchive', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    const project = await prisma.project.update({
      where: { id: req.params.projectId },
      data: { status: ProjectStatus.ACTIVE },
    });

    res.json({ success: true, data: project });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Unarchive project error:', error);
    res.status(500).json({ success: false, error: 'Failed to unarchive project' });
  }
});

// Get project time entries
projectRouter.get('/:projectId/time-entries', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { startedAt: 'desc' },
    });

    // Add amount for hourly projects
    const entriesWithAmount = timeEntries.map((entry) => ({
      ...entry,
      amount:
        project.billingMode === 'HOURLY' && project.hourlyRate && entry.durationMinutes
          ? Number(project.hourlyRate) * (entry.durationMinutes / 60)
          : null,
    }));

    res.json({ success: true, data: entriesWithAmount });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Get time entries error:', error);
    res.status(500).json({ success: false, error: 'Failed to get time entries' });
  }
});

// Start time tracking
projectRouter.post('/:projectId/time-entries/start', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Check if user has an active session
    const activeEntry = await prisma.timeEntry.findFirst({
      where: { userId: req.userId, endedAt: null },
      include: { project: { select: { name: true } } },
    });

    if (activeEntry) {
      throw new AppError(
        `You have an active session on project "${activeEntry.project.name}". Stop it first.`,
        400
      );
    }

    const timeEntry = await prisma.timeEntry.create({
      data: {
        projectId: req.params.projectId,
        userId: req.userId!,
        startedAt: new Date(),
      },
    });

    res.status(201).json({ success: true, data: timeEntry });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Start time entry error:', error);
    res.status(500).json({ success: false, error: 'Failed to start time entry' });
  }
});

// Stop time tracking
projectRouter.post(
  '/:projectId/time-entries/:timeEntryId/stop',
  async (req: AuthRequest, res: Response) => {
    try {
      const { note } = req.body;

      const timeEntry = await prisma.timeEntry.findFirst({
        where: {
          id: req.params.timeEntryId,
          projectId: req.params.projectId,
          userId: req.userId,
          endedAt: null,
        },
      });

      if (!timeEntry) {
        throw new AppError('Active time entry not found', 404);
      }

      const endedAt = new Date();
      const durationMinutes = Math.round(
        (endedAt.getTime() - timeEntry.startedAt.getTime()) / (1000 * 60)
      );

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: req.params.timeEntryId },
        data: {
          endedAt,
          durationMinutes,
          note: note || null,
        },
      });

      res.json({ success: true, data: updatedEntry });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      console.error('Stop time entry error:', error);
      res.status(500).json({ success: false, error: 'Failed to stop time entry' });
    }
  }
);

// Get project todos
projectRouter.get('/:projectId/todos', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const { filter, sortBy } = req.query;

    let where: any = { projectId: req.params.projectId };
    if (filter === 'open') where.completed = false;
    else if (filter === 'completed') where.completed = true;
    else if (filter === 'overdue') {
      where.completed = false;
      where.dueDate = { lt: new Date() };
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'priority') orderBy = [{ priority: 'desc' }, { createdAt: 'desc' }];
    else if (sortBy === 'dueDate') orderBy = [{ dueDate: 'asc' }, { createdAt: 'desc' }];

    const todos = await prisma.projectTodo.findMany({
      where,
      orderBy,
    });

    res.json({ success: true, data: todos });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Get todos error:', error);
    res.status(500).json({ success: false, error: 'Failed to get todos' });
  }
});

// Create todo
projectRouter.post('/:projectId/todos', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const { title, description, priority, dueDate } = req.body;

    const todo = await prisma.projectTodo.create({
      data: {
        projectId: req.params.projectId,
        title,
        description,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    res.status(201).json({ success: true, data: todo });
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ success: false, error: 'Failed to create todo' });
  }
});

// Get project invoices
projectRouter.get('/:projectId/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const invoices = await prisma.invoice.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { issueDate: 'desc' },
    });

    res.json({ success: true, data: invoices });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Get invoices error:', error);
    res.status(500).json({ success: false, error: 'Failed to get invoices' });
  }
});

// Get project payments
projectRouter.get('/:projectId/payments', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const payments = await prisma.payment.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { paymentDate: 'desc' },
      include: { invoice: true },
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payments' });
  }
});

