import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const paymentRouter = Router();

const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  paymentDate: z.string(),
  amount: z.coerce.number().min(0),
  currency: z.string().default('EUR'),
  method: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updatePaymentSchema = createPaymentSchema.partial();

// Get all payments
paymentRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, projectId } = req.query;

    const where: any = { userId: req.userId };
    if (projectId) where.projectId = projectId as string;
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate as string);
      if (endDate) where.paymentDate.lte = new Date(endDate as string);
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        invoice: {
          select: { id: true, externalNumber: true, amount: true },
        },
        project: {
          select: { id: true, name: true, clientName: true },
        },
      },
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payments' });
  }
});

// Get single payment
paymentRouter.get('/:paymentId', async (req: AuthRequest, res: Response) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.paymentId, userId: req.userId },
      include: {
        invoice: true,
        project: true,
      },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Get payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment' });
  }
});

// Create payment
paymentRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    console.log('Create payment request:', { body: req.body });
    const data = createPaymentSchema.parse(req.body);
    console.log('Parsed payment data:', data);

    // Verify invoice ownership
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, userId: req.userId },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    // Verify project ownership if projectId is provided
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId: req.userId },
      });
      if (!project) {
        throw new AppError('Project not found', 404);
      }
    }

    const payment = await prisma.payment.create({
      data: {
        userId: req.userId!,
        invoiceId: data.invoiceId,
        projectId: data.projectId || invoice.projectId,
        paymentDate: new Date(data.paymentDate),
        amount: data.amount,
        currency: data.currency,
        method: data.method,
        notes: data.notes,
      },
      include: {
        invoice: true,
        project: true,
      },
    });

    // Update invoice status if fully paid
    const totalPaid = await prisma.payment.aggregate({
      where: { invoiceId: data.invoiceId },
      _sum: { amount: true },
    });

    if (Number(totalPaid._sum.amount) >= Number(invoice.amount)) {
      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: { status: 'PAID' },
      });
    }

    res.status(201).json({ success: true, data: payment });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('Payment validation error:', error.errors);
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Create payment error:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
    });
    res.status(500).json({ success: false, error: 'Failed to create payment' });
  }
});

// Update payment
paymentRouter.put('/:paymentId', async (req: AuthRequest, res: Response) => {
  try {
    const data = updatePaymentSchema.parse(req.body);

    const existing = await prisma.payment.findFirst({
      where: { id: req.params.paymentId, userId: req.userId },
    });

    if (!existing) {
      throw new AppError('Payment not found', 404);
    }

    // Verify invoice ownership if invoiceId is being changed
    if (data.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: data.invoiceId, userId: req.userId },
      });
      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }
    }

    // Verify project ownership if projectId is being changed
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId: req.userId },
      });
      if (!project) {
        throw new AppError('Project not found', 404);
      }
    }

    const payment = await prisma.payment.update({
      where: { id: req.params.paymentId },
      data: {
        ...data,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
      },
      include: {
        invoice: true,
        project: true,
      },
    });

    res.json({ success: true, data: payment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Update payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to update payment' });
  }
});

// Delete payment
paymentRouter.delete('/:paymentId', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.payment.findFirst({
      where: { id: req.params.paymentId, userId: req.userId },
    });

    if (!existing) {
      throw new AppError('Payment not found', 404);
    }

    await prisma.payment.delete({
      where: { id: req.params.paymentId },
    });

    res.json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Delete payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete payment' });
  }
});

