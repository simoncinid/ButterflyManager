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
  clientName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(ProjectStatus).optional().default(ProjectStatus.ACTIVE),
  billingMode: z.nativeEnum(BillingMode),
  fixedTotalAmount: z.coerce.number().min(0).optional().nullable(),
  recurringAmount: z.coerce.number().min(0).optional().nullable(),
  recurringPeriodType: z.nativeEnum(RecurringPeriodType).optional().nullable(),
  hourlyRate: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().default('EUR'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
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
    console.log('Create project request:', { body: req.body });
    const data = createProjectSchema.parse(req.body);
    console.log('Parsed data:', data);

    const project = await prisma.project.create({
      data: {
        name: data.name as string,
        clientName: (data.clientName as string) || null,
        description: (data.description as string) || null,
        status: (data.status as any) || 'ACTIVE',
        billingMode: data.billingMode as any,
        fixedTotalAmount: data.fixedTotalAmount ? (data.fixedTotalAmount as number) : null,
        recurringAmount: data.recurringAmount ? (data.recurringAmount as number) : null,
        recurringPeriodType: (data.recurringPeriodType as any) || null,
        hourlyRate: data.hourlyRate ? (data.hourlyRate as number) : null,
        currency: (data.currency as string) || 'EUR',
        userId: req.userId!,
        startDate: data.startDate ? new Date(data.startDate as string) : null,
        endDate: data.endDate ? new Date(data.endDate as string) : null,
      },
    });

    res.status(201).json({ success: true, data: project });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      return res.status(400).json({ success: false, error: error.errors });
    }
    console.error('Create project error:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
    });
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

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name as string;
    if (data.clientName !== undefined) updateData.clientName = (data.clientName as string) || null;
    if (data.description !== undefined) updateData.description = (data.description as string) || null;
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.billingMode !== undefined) updateData.billingMode = data.billingMode as any;
    if (data.fixedTotalAmount !== undefined) updateData.fixedTotalAmount = data.fixedTotalAmount ? (data.fixedTotalAmount as number) : null;
    if (data.recurringAmount !== undefined) updateData.recurringAmount = data.recurringAmount ? (data.recurringAmount as number) : null;
    if (data.recurringPeriodType !== undefined) updateData.recurringPeriodType = (data.recurringPeriodType as any) || null;
    if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate ? (data.hourlyRate as number) : null;
    if (data.currency !== undefined) updateData.currency = data.currency as string;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate as string) : null;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate as string) : null;

    const project = await prisma.project.update({
      where: { id: req.params.projectId },
      data: updateData,
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

// Delete project (permanent deletion)
projectRouter.delete('/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    });

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    // Permanent delete - cascades to related records (timeEntries, todos, invoices, payments)
    await prisma.project.delete({
      where: { id: req.params.projectId },
    });

    res.json({ success: true, message: 'Project deleted' });
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

    // Check if user already has an active timer on THIS project (allow multiple timers on different projects)
    const activeEntryOnThisProject = await prisma.timeEntry.findFirst({
      where: { userId: req.userId, projectId: req.params.projectId, endedAt: null },
    });

    if (activeEntryOnThisProject) {
      throw new AppError(
        `You already have a timer running on this project.`,
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

// Resume time tracking - reopen an existing time entry
projectRouter.post(
  '/:projectId/time-entries/:timeEntryId/resume',
  async (req: AuthRequest, res: Response) => {
    try {
      const project = await prisma.project.findFirst({
        where: { id: req.params.projectId, userId: req.userId },
      });

      if (!project) {
        throw new AppError('Project not found', 404);
      }

      // Check if user already has an active timer on THIS project (allow multiple timers on different projects)
      const activeEntryOnThisProject = await prisma.timeEntry.findFirst({
        where: { userId: req.userId, projectId: req.params.projectId, endedAt: null },
      });

      if (activeEntryOnThisProject) {
        throw new AppError(
          `You already have a timer running on this project.`,
          400
        );
      }

      // Find the specific time entry to resume
      const existingEntry = await prisma.timeEntry.findFirst({
        where: {
          id: req.params.timeEntryId,
          projectId: req.params.projectId,
          userId: req.userId,
          endedAt: { not: null },
        },
      });

      if (!existingEntry) {
        throw new AppError('Time entry not found or still running', 404);
      }

      // Reopen the existing time entry by clearing endedAt
      // Store the previous duration so we can add to it when stopped
      // We'll use a trick: set startedAt to now minus the previous duration
      // and clear durationMinutes so it's recalculated when stopped
      const previousDurationMinutes = existingEntry.durationMinutes || 0;
      const resumedEntry = await prisma.timeEntry.update({
        where: { id: req.params.timeEntryId },
        data: {
          endedAt: null,
          startedAt: new Date(Date.now() - previousDurationMinutes * 60 * 1000),
          durationMinutes: null, // Clear it so it's recalculated when stopped
        },
      });
      
      console.log('Resumed time entry:', {
        id: resumedEntry.id,
        previousDurationMinutes,
        newStartedAt: resumedEntry.startedAt,
      });

      res.json({ success: true, data: resumedEntry });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      console.error('Resume time entry error:', error);
      res.status(500).json({ success: false, error: 'Failed to resume time entry' });
    }
  }
);

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

      console.log('Stopping time entry:', {
        id: timeEntry.id,
        startedAt: timeEntry.startedAt,
        endedAt,
        calculatedDurationMinutes: durationMinutes,
        previousDurationMinutes: timeEntry.durationMinutes,
      });

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: req.params.timeEntryId },
        data: {
          endedAt,
          durationMinutes,
          note: note || null,
        },
      });
      
      console.log('Stopped time entry:', {
        id: updatedEntry.id,
        finalDurationMinutes: updatedEntry.durationMinutes,
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

// Update time entry
projectRouter.put(
  '/:projectId/time-entries/:timeEntryId',
  async (req: AuthRequest, res: Response) => {
    try {
      const { startedAt, endedAt, durationMinutes, note } = req.body;
      console.log('Update time entry request:', {
        timeEntryId: req.params.timeEntryId,
        body: { startedAt, endedAt, durationMinutes, note },
      });

      // Verify project ownership
      const project = await prisma.project.findFirst({
        where: { id: req.params.projectId, userId: req.userId },
      });

      if (!project) {
        throw new AppError('Project not found', 404);
      }

      // Verify time entry belongs to project and user
      const timeEntry = await prisma.timeEntry.findFirst({
        where: {
          id: req.params.timeEntryId,
          projectId: req.params.projectId,
          userId: req.userId,
        },
      });

      if (!timeEntry) {
        throw new AppError('Time entry not found', 404);
      }

      console.log('Existing time entry:', {
        id: timeEntry.id,
        durationMinutes: timeEntry.durationMinutes,
        startedAt: timeEntry.startedAt,
        endedAt: timeEntry.endedAt,
      });

      const updateData: any = {};
      if (startedAt !== undefined) updateData.startedAt = new Date(startedAt);
      if (endedAt !== undefined) updateData.endedAt = endedAt ? new Date(endedAt) : null;
      if (note !== undefined) updateData.note = note || null;

      // If durationMinutes is explicitly provided, use it
      if (durationMinutes !== undefined) {
        updateData.durationMinutes = durationMinutes;
      } else {
        // Only recalculate duration if startedAt or endedAt are being changed
        // and durationMinutes was NOT explicitly provided
        const newStartedAt = updateData.startedAt || timeEntry.startedAt;
        const newEndedAt = updateData.endedAt !== undefined ? updateData.endedAt : timeEntry.endedAt;
        
        if (newStartedAt && newEndedAt) {
          updateData.durationMinutes = Math.round(
            (newEndedAt.getTime() - newStartedAt.getTime()) / (1000 * 60)
          );
        } else if (newEndedAt === null) {
          // If endedAt is being cleared (timer reopened), don't set durationMinutes
          updateData.durationMinutes = null;
        }
      }

      console.log('Update data to save:', updateData);

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: req.params.timeEntryId },
        data: updateData,
      });

      console.log('Updated time entry:', {
        id: updatedEntry.id,
        durationMinutes: updatedEntry.durationMinutes,
        startedAt: updatedEntry.startedAt,
        endedAt: updatedEntry.endedAt,
      });

      res.json({ success: true, data: updatedEntry });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      console.error('Update time entry error:', error);
      res.status(500).json({ success: false, error: 'Failed to update time entry' });
    }
  }
);

// Delete time entry
projectRouter.delete(
  '/:projectId/time-entries/:timeEntryId',
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify project ownership
      const project = await prisma.project.findFirst({
        where: { id: req.params.projectId, userId: req.userId },
      });

      if (!project) {
        throw new AppError('Project not found', 404);
      }

      // Verify time entry belongs to project and user
      const timeEntry = await prisma.timeEntry.findFirst({
        where: {
          id: req.params.timeEntryId,
          projectId: req.params.projectId,
          userId: req.userId,
        },
      });

      if (!timeEntry) {
        throw new AppError('Time entry not found', 404);
      }

      await prisma.timeEntry.delete({
        where: { id: req.params.timeEntryId },
      });

      res.json({ success: true, message: 'Time entry deleted' });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      console.error('Delete time entry error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete time entry' });
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

