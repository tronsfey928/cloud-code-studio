import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User } from '../models/User';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, email, password } = req.body as {
      username: string;
      email: string;
      password: string;
    };

    if (!username || !email || !password) {
      return next(createError('username, email, and password are required', 400));
    }

    if (password.length < 8) {
      return next(createError('Password must be at least 8 characters', 400));
    }

    const existing = await User.findOne({
      where: { [Op.or]: [{ email }, { username }] },
    });
    if (existing) {
      return next(createError('User already exists with that email or username', 409));
    }

    const user = await User.create({ username, email, passwordHash: password });

    const signOptions: SignOptions = { expiresIn: config.jwtExpiry as SignOptions['expiresIn'] };
    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      config.jwtSecret,
      signOptions
    );

    logger.info('User registered', { userId: user.id, email });
    res.status(201).json({ success: true, token, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return next(createError('email and password are required', 400));
    }

    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.comparePassword(password))) {
      return next(createError('Invalid credentials', 401));
    }

    user.lastLoginAt = new Date();
    await user.save();

    const signOptions: SignOptions = { expiresIn: config.jwtExpiry as SignOptions['expiresIn'] };
    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      config.jwtSecret,
      signOptions
    );

    logger.info('User logged in', { userId: user.id, email });
    res.json({ success: true, token, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await User.findByPk(req.user?.userId, {
      attributes: { exclude: ['passwordHash'] },
    });
    if (!user) return next(createError('User not found', 404));
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return next(createError('currentPassword and newPassword are required', 400));
    }

    if (newPassword.length < 8) {
      return next(createError('New password must be at least 8 characters', 400));
    }

    const user = await User.findByPk(req.user?.userId);
    if (!user) return next(createError('User not found', 404));

    if (!(await user.comparePassword(currentPassword))) {
      return next(createError('Current password is incorrect', 401));
    }

    user.passwordHash = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}
