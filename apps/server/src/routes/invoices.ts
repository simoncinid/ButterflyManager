import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { InvoiceStatus } from '../types/prisma';

export const invoiceRouter = Router();

const createInvoiceSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  issueDate: z.string(),
  dueDate: z.string().optional().nullable(),
  amount: z.coerce.number().min(0),
  currency: z.string().default('EUR'),
  status: z.nativeEnum(InvoiceStatus).optional().default(InvoiceStatus.DRAFT),
  externalNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

// Get all invoices
invoiceRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, startDate, endDate } = req.query;

    const where: any = { userId: req.userId };
    if (status) where.status = status as InvoiceStatus;
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate.gte = new Date(startDate as string);
      if (endDate) where.issueDate.lte = new Date(endDate as string);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { issueDate: 'desc' },
      include: {
        project: {
          select: { id: true, name: true, clientName: true },
        },
        payments: {
          select: { amount: true },
        },
      },
    });

    // Calculate paid amount for each invoice
    const invoicesWithPaidAmount = invoices.map((invoice) => ({
      ...invoice,
      paidAmount: invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      outstandingAmount:
        Number(invoice.amount) -
        invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0),
    }));

    res.json({ success: true, data: invoicesWithPaidAmount });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ success: false, error: 'Failed to get invoices' });
  }
});

// Get single invoice
invoiceRouter.get('/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.invoiceId, userId: req.userId },
      include: {
        project: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    res.json({
      success: true,
      data: {
        ...invoice,
        paidAmount: invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0),
        outstandingAmount:
          Number(invoice.amount) -
          invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Get invoice error:', error);
    res.status(500).json({ success: false, error: 'Failed to get invoice' });
  }
});

// Create invoice
invoiceRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    console.log('Create invoice request:', { body: req.body });
    const data = createInvoiceSchema.parse(req.body);
    console.log('Parsed invoice data:', data);

    // Verify project ownership if projectId is provided
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId: req.userId },
      });
      if (!project) {
        throw new AppError('Project not found', 404);
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        userId: req.userId!,
        projectId: (data.projectId as string) || null,
        issueDate: new Date(data.issueDate as string),
        dueDate: data.dueDate ? new Date(data.dueDate as string) : null,
        amount: data.amount as number,
        currency: (data.currency as string) || 'EUR',
        status: (data.status as any) || 'DRAFT',
        externalNumber: (data.externalNumber as string) || null,
        notes: (data.notes as string) || null,
        periodStart: data.periodStart ? new Date(data.periodStart as string) : null,
        periodEnd: data.periodEnd ? new Date(data.periodEnd as string) : null,
      },
      include: { project: true },
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('Invoice validation error:', error.errors);
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Create invoice error:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
    });
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
});

// Update invoice
invoiceRouter.put('/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateInvoiceSchema.parse(req.body);

    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.invoiceId, userId: req.userId },
    });

    if (!existing) {
      throw new AppError('Invoice not found', 404);
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

    const updateData: any = {};
    if (data.projectId !== undefined) updateData.projectId = (data.projectId as string) || null;
    if (data.issueDate !== undefined) updateData.issueDate = new Date(data.issueDate as string);
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate as string) : null;
    if (data.amount !== undefined) updateData.amount = data.amount as number;
    if (data.currency !== undefined) updateData.currency = data.currency as string;
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.externalNumber !== undefined) updateData.externalNumber = (data.externalNumber as string) || null;
    if (data.notes !== undefined) updateData.notes = (data.notes as string) || null;
    if (data.periodStart !== undefined) updateData.periodStart = data.periodStart ? new Date(data.periodStart as string) : null;
    if (data.periodEnd !== undefined) updateData.periodEnd = data.periodEnd ? new Date(data.periodEnd as string) : null;

    // Check if status is being changed to PAID
    const isStatusChangingToPaid = data.status === 'PAID' && existing.status !== 'PAID';
    console.log('Invoice update:', {
      invoiceId: req.params.invoiceId,
      oldStatus: existing.status,
      newStatus: data.status,
      isStatusChangingToPaid,
    });

    const invoice = await prisma.invoice.update({
      where: { id: req.params.invoiceId },
      data: updateData,
      include: { project: true, payments: true },
    });

    // If status changed to PAID, create automatic payment if no payments exist or if not fully paid
    if (isStatusChangingToPaid) {
      const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const outstandingAmount = Number(invoice.amount) - totalPaid;
      console.log('Auto-payment check:', { totalPaid, outstandingAmount, invoiceAmount: Number(invoice.amount) });

      if (outstandingAmount > 0) {
        console.log('Creating auto-payment for:', outstandingAmount);
        // Create automatic payment for the outstanding amount
        const payment = await prisma.payment.create({
          data: {
            userId: req.userId!,
            invoiceId: invoice.id,
            projectId: invoice.projectId,
            paymentDate: new Date(),
            amount: outstandingAmount,
            currency: invoice.currency,
            method: 'Automatic',
            notes: 'Auto-created when invoice marked as paid',
          },
        });
        console.log('Auto-payment created:', payment.id);
      }
    }

    // Refetch invoice with updated payments
    const updatedInvoice = await prisma.invoice.findFirst({
      where: { id: req.params.invoiceId },
      include: { project: true, payments: true },
    });

    res.json({ success: true, data: updatedInvoice });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Update invoice error:', error);
    res.status(500).json({ success: false, error: 'Failed to update invoice' });
  }
});

// Delete invoice
invoiceRouter.delete('/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.invoiceId, userId: req.userId },
    });

    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }

    await prisma.invoice.delete({
      where: { id: req.params.invoiceId },
    });

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Delete invoice error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
});

