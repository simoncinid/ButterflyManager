import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const timeEntryRouter = Router();

const updateTimeEntrySchema = z.object({
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  note: z.string().optional(),
});

// Get user's active time entries (can have multiple on different projects)
timeEntryRouter.get('/active', async (req: AuthRequest, res: Response) => {
  try {
    const activeEntries = await prisma.timeEntry.findMany({
      where: { userId: req.userId, endedAt: null },
      include: { project: true },
      orderBy: { startedAt: 'desc' },
    });

    res.json({ success: true, data: activeEntries });
  } catch (error) {
    console.error('Get active time entries error:', error);
    res.status(500).json({ success: false, error: 'Failed to get active time entries' });
  }
});

// Update time entry
timeEntryRouter.put('/:timeEntryId', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateTimeEntrySchema.parse(req.body);

    const timeEntry = await prisma.timeEntry.findFirst({
      where: { id: req.params.timeEntryId, userId: req.userId },
    });

    if (!timeEntry) {
      throw new AppError('Time entry not found', 404);
    }

    const updateData: any = {};

    if (data.startedAt) {
      updateData.startedAt = new Date(data.startedAt);
    }

    if (data.endedAt) {
      updateData.endedAt = new Date(data.endedAt);
    }

    if (data.note !== undefined) {
      updateData.note = data.note;
    }

    // Recalculate duration if both dates are set
    const startedAt = updateData.startedAt || timeEntry.startedAt;
    const endedAt = updateData.endedAt || timeEntry.endedAt;

    if (startedAt && endedAt) {
      const start = new Date(startedAt);
      const end = new Date(endedAt);

      if (end <= start) {
        throw new AppError('End time must be after start time', 400);
      }

      updateData.durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }

    const updatedEntry = await prisma.timeEntry.update({
      where: { id: req.params.timeEntryId },
      data: updateData,
    });

    res.json({ success: true, data: updatedEntry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Update time entry error:', error);
    res.status(500).json({ success: false, error: 'Failed to update time entry' });
  }
});

// Delete time entry
timeEntryRouter.delete('/:timeEntryId', async (req: AuthRequest, res: Response) => {
  try {
    const timeEntry = await prisma.timeEntry.findFirst({
      where: { id: req.params.timeEntryId, userId: req.userId },
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
});

