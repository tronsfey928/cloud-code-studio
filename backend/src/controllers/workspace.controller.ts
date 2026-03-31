import { Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { Workspace } from '../models/Workspace';
import { gitService } from '../services/gitService';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';
import { config } from '../config';
import { logger } from '../utils/logger';

export async function createWorkspace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, repositoryUrl, branch = 'main' } = req.body as {
      name: string;
      repositoryUrl: string;
      branch?: string;
    };

    if (!name || !repositoryUrl) {
      return next(createError('name and repositoryUrl are required', 400));
    }

    const userId = req.user!.userId;

    const workspace = await Workspace.create({
      userId,
      name,
      repositoryUrl,
      branch,
      status: 'creating',
    });

    const workspacePath = path.join(config.workspacesDir, workspace.id);

    // Clone repository asynchronously
    setImmediate(async () => {
      try {
        await fs.mkdir(workspacePath, { recursive: true });
        await gitService.clone(repositoryUrl, branch, workspacePath);

        await Workspace.update(
          { workspacePath, status: 'ready' },
          { where: { id: workspace.id } }
        );
        logger.info('Workspace ready', { workspaceId: workspace.id, workspacePath });
      } catch (err) {
        await Workspace.update({ status: 'error' }, { where: { id: workspace.id } });
        logger.error('Failed to set up workspace', { workspaceId: workspace.id, err });
      }
    });

    res.status(201).json({ success: true, workspace });
  } catch (error) {
    next(error);
  }
}

export async function listWorkspaces(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaces = await Workspace.findAll({
      where: { userId: req.user!.userId },
      order: [['lastAccessedAt', 'DESC']],
    });
    res.json({ success: true, workspaces });
  } catch (error) {
    next(error);
  }
}

export async function getWorkspace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspace = await Workspace.findOne({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!workspace) return next(createError('Workspace not found', 404));

    workspace.lastAccessedAt = new Date();
    await workspace.save();

    res.json({ success: true, workspace });
  } catch (error) {
    next(error);
  }
}

export async function deleteWorkspace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspace = await Workspace.findOne({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!workspace) return next(createError('Workspace not found', 404));

    // Clean up workspace directory
    if (workspace.workspacePath) {
      try {
        await fs.rm(workspace.workspacePath, { recursive: true, force: true });
      } catch (err) {
        logger.warn('Failed to remove workspace directory', {
          workspaceId: workspace.id,
          workspacePath: workspace.workspacePath,
          err,
        });
      }
    }

    await workspace.destroy();
    res.json({ success: true, message: 'Workspace deleted' });
  } catch (error) {
    next(error);
  }
}
