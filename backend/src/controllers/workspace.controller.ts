import { Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace';
import { containerManager } from '../services/containerService';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export async function createWorkspace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, repositoryUrl, branch = 'main', config: wsConfig } = req.body as {
      name: string;
      repositoryUrl: string;
      branch?: string;
      config?: { resources?: { cpu?: string; memory?: string; storage?: string }; environment?: Record<string, string> };
    };

    if (!name || !repositoryUrl) {
      return next(createError('name and repositoryUrl are required', 400));
    }

    const userId = new mongoose.Types.ObjectId(req.user!.userId);

    const workspace = await Workspace.create({
      userId,
      name,
      repositoryUrl,
      branch,
      status: 'creating',
      config: wsConfig || {},
    });

    // Start container asynchronously
    setImmediate(async () => {
      try {
        const containerId = await containerManager.createAndStart(
          workspace.id as string,
          repositoryUrl,
          branch,
          {
            cpu: workspace.config.resources.cpu,
            memory: workspace.config.resources.memory,
          }
        );
        await Workspace.findByIdAndUpdate(workspace.id, {
          containerId,
          status: 'running',
        });
        logger.info('Workspace container started', { workspaceId: workspace.id, containerId });
      } catch (err) {
        await Workspace.findByIdAndUpdate(workspace.id, { status: 'error' });
        logger.error('Failed to start workspace container', { workspaceId: workspace.id, err });
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
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const workspaces = await Workspace.find({ userId }).sort({ lastAccessedAt: -1 });
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
      _id: req.params.id,
      userId: new mongoose.Types.ObjectId(req.user!.userId),
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
      _id: req.params.id,
      userId: new mongoose.Types.ObjectId(req.user!.userId),
    });
    if (!workspace) return next(createError('Workspace not found', 404));

    if (workspace.containerId) {
      try {
        await containerManager.destroy(workspace.containerId);
      } catch (err) {
        logger.warn('Failed to destroy container during workspace deletion', {
          workspaceId: workspace.id,
          containerId: workspace.containerId,
          err,
        });
      }
    }

    await workspace.deleteOne();
    res.json({ success: true, message: 'Workspace deleted' });
  } catch (error) {
    next(error);
  }
}
