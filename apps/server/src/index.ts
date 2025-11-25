import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';

import { authRouter } from './routes/auth';
import { projectRouter } from './routes/projects';
import { timeEntryRouter } from './routes/timeEntries';
import { todoRouter } from './routes/todos';
import { invoiceRouter } from './routes/invoices';
import { paymentRouter } from './routes/payments';
import { analyticsRouter } from './routes/analytics';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/projects', authMiddleware, projectRouter);
app.use('/api/time-entries', authMiddleware, timeEntryRouter);
app.use('/api/todos', authMiddleware, todoRouter);
app.use('/api/invoices', authMiddleware, invoiceRouter);
app.use('/api/payments', authMiddleware, paymentRouter);
app.use('/api/analytics', authMiddleware, analyticsRouter);

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to database');

    app.listen(PORT, () => {
      console.log(`🦋 ButterflyManager server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

