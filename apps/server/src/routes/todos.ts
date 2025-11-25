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

    const updateData: any = { ...data };

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
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

