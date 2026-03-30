import { Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace';
import { containerManager } from '../services/containerService';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

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

    const userId = req.user!.userId;

    const workspace = await Workspace.create({
      userId,
      name,
      repositoryUrl,
      branch,
      status: 'creating',
      config: wsConfig
        ? {
            resources: {
              cpu: wsConfig.resources?.cpu ?? '0.5',
              memory: wsConfig.resources?.memory ?? '512m',
              storage: wsConfig.resources?.storage ?? '1g',
            },
            environment: wsConfig.environment ?? {},
          }
        : undefined,
    });

    // Start container asynchronously
    setImmediate(async () => {
      try {
        const containerId = await containerManager.createAndStart(
          workspace.id,
          repositoryUrl,
          branch,
          {
            cpu: workspace.config.resources.cpu,
            memory: workspace.config.resources.memory,
          }
        );
        await Workspace.update(
          { containerId, status: 'running' },
          { where: { id: workspace.id } }
        );
        logger.info('Workspace container started', { workspaceId: workspace.id, containerId });
      } catch (err) {
        await Workspace.update({ status: 'error' }, { where: { id: workspace.id } });
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

    await workspace.destroy();
    res.json({ success: true, message: 'Workspace deleted' });
  } catch (error) {
    next(error);
  }
}
