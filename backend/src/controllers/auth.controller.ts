import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';
import { isValidEmail, isValidPassword, isValidUsername } from '../utils/validation';

/** Refresh token validity period (7 days) */
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Generate a cryptographically-secure opaque refresh token. */
function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

/** Create a JWT access token for the given user. */
function createAccessToken(user: User): string {
  const signOptions: SignOptions = { expiresIn: config.jwtExpiry as SignOptions['expiresIn'] };
  return jwt.sign(
    { userId: user.id, email: user.email, username: user.username },
    config.jwtSecret,
    signOptions
  );
}

/** Persist a new refresh token and return the raw value. */
async function issueRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  await RefreshToken.create({
    userId,
    token,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
  });
  return token;
}

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

    if (!isValidUsername(username)) {
      return next(createError('Username must be 2–50 characters', 400));
    }

    if (!isValidEmail(email)) {
      return next(createError('Invalid email format', 400));
    }

    if (!isValidPassword(password)) {
      return next(
        createError(
          'Password must be 8–128 characters and include uppercase, lowercase, and a digit',
          400
        )
      );
    }

    const existing = await User.findOne({
      where: { [Op.or]: [{ email }, { username }] },
    });
    if (existing) {
      return next(createError('User already exists with that email or username', 409));
    }

    const user = await User.create({ username, email, passwordHash: password });

    const token = createAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);

    logger.info('User registered', { userId: user.id, email });
    res.status(201).json({ success: true, token, refreshToken, user: user.toSafeJSON() });
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

    const token = createAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);

    logger.info('User logged in', { userId: user.id, email });
    res.json({ success: true, token, refreshToken, user: user.toSafeJSON() });
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

    if (!isValidPassword(newPassword)) {
      return next(
        createError(
          'New password must be 8–128 characters and include uppercase, lowercase, and a digit',
          400
        )
      );
    }

    const user = await User.findByPk(req.user?.userId);
    if (!user) return next(createError('User not found', 404));

    if (!(await user.comparePassword(currentPassword))) {
      return next(createError('Current password is incorrect', 401));
    }

    if (currentPassword === newPassword) {
      return next(createError('New password must be different from the current password', 400));
    }

    user.passwordHash = newPassword;
    await user.save();

    // Revoke all existing refresh tokens after password change
    await RefreshToken.update(
      { revoked: true },
      { where: { userId: user.id, revoked: false } }
    );

    logger.info('Password changed, refresh tokens revoked', { userId: user.id });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * Rotate a refresh token: verify the old one, issue a new pair (access + refresh),
 * and revoke the consumed refresh token to prevent replay.
 */
export async function refreshAccessToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      return next(createError('refreshToken is required', 400));
    }

    const stored = await RefreshToken.findOne({ where: { token: refreshToken } });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return next(createError('Invalid or expired refresh token', 401));
    }

    // Revoke the consumed token
    stored.revoked = true;
    await stored.save();

    const user = await User.findByPk(stored.userId);
    if (!user) {
      return next(createError('User not found', 404));
    }

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = await issueRefreshToken(user.id);

    logger.info('Access token refreshed', { userId: user.id });
    res.json({ success: true, token: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    next(error);
  }
}

/**
 * Logout: revoke the provided refresh token so it can no longer be used.
 */
export async function logout(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };

    if (refreshToken) {
      await RefreshToken.update(
        { revoked: true },
        { where: { token: refreshToken, userId: req.user!.userId } }
      );
    }

    logger.info('User logged out', { userId: req.user!.userId });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}
