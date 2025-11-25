import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string(),
});

const updateProfileSchema = z.object({
  name: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
};

const setTokenCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    domain: process.env.COOKIE_DOMAIN || undefined,
  };

  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// Login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Refresh token
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new AppError('Refresh token required', 401);
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      userId: string;
    };

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      throw new AppError('User not found', 401);
    }

    const tokens = generateTokens(user.id);
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({ success: true });
  } catch (error) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

// Get current user
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({ success: true, data: { user } });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// Update profile
authRouter.put('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, currentPassword, newPassword } = updateProfileSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updateData: { name?: string; passwordHash?: string } = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (newPassword) {
      if (!currentPassword) {
        throw new AppError('Current password required to change password', 400);
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new AppError('Current password is incorrect', 400);
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });

    res.json({ success: true, data: { user: updatedUser } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

