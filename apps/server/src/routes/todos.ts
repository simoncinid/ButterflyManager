import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { TodoPriority } from '../types/prisma';

export const todoRouter = Router();

const updateTodoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  priority: z.nativeEnum(TodoPriority).optional(),
  dueDate: z.string().optional().nullable(),
  completed: z.boolean().optional(),
});

// Get all todos for user
todoRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, priority, completed, overdue, sortBy } = req.query;

    // Get all projects for the user
    const projects = await prisma.project.findMany({
      where: { userId: req.userId },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);

    let where: any = {
      projectId: { in: projectIds },
    };

    // Filter by project
    if (projectId) {
      // Verify project belongs to user
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        throw new AppError('Project not found', 404);
      }
      where.projectId = projectId as string;
    }

    // Filter by priority
    if (priority) {
      where.priority = priority as TodoPriority;
    }

    // Filter by completed status
    if (completed === 'true') {
      where.completed = true;
    } else if (completed === 'false') {
      where.completed = false;
    }

    // Filter overdue todos
    if (overdue === 'true') {
      where.completed = false;
      where.dueDate = { lt: new Date() };
    }

    // Sort
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'priority') {
      orderBy = [{ priority: 'desc' }, { createdAt: 'desc' }];
    } else if (sortBy === 'dueDate') {
      orderBy = [{ dueDate: 'asc' }, { createdAt: 'desc' }];
    } else if (sortBy === 'project') {
      orderBy = [{ project: { name: 'asc' } }, { createdAt: 'desc' }];
    }

    const todos = await prisma.projectTodo.findMany({
      where,
      orderBy,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            clientName: true,
            status: true,
          },
        },
      },
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

// Update todo
todoRouter.put('/:todoId', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateTodoSchema.parse(req.body);

    // Verify ownership through project
    const todo = await prisma.projectTodo.findFirst({
      where: { id: req.params.todoId },
      include: { project: true },
    });

    if (!todo || todo.project.userId !== req.userId) {
      throw new AppError('Todo not found', 404);
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title as string;
    if (data.description !== undefined) updateData.description = (data.description as string) || null;
    if (data.priority !== undefined) updateData.priority = data.priority as any;
    if (data.completed !== undefined) updateData.completed = data.completed as boolean;

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate as string) : null;
    }

    if (data.completed !== undefined) {
      updateData.completedAt = data.completed ? new Date() : null;
    }

    const updatedTodo = await prisma.projectTodo.update({
      where: { id: req.params.todoId },
      data: updateData,
    });

    res.json({ success: true, data: updatedTodo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Update todo error:', error);
    res.status(500).json({ success: false, error: 'Failed to update todo' });
  }
});

// Delete todo
todoRouter.delete('/:todoId', async (req: AuthRequest, res: Response) => {
  try {
    // Verify ownership through project
    const todo = await prisma.projectTodo.findFirst({
      where: { id: req.params.todoId },
      include: { project: true },
    });

    if (!todo || todo.project.userId !== req.userId) {
      throw new AppError('Todo not found', 404);
    }

    await prisma.projectTodo.delete({
      where: { id: req.params.todoId },
    });

    res.json({ success: true, message: 'Todo deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Delete todo error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete todo' });
  }
});

