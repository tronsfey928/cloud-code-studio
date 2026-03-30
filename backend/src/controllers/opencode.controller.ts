import { Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace';
import { OpenCodeConfig } from '../models/OpenCodeConfig';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';

export async function getConfig(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspace = await Workspace.findOne({
      where: { id: req.params.workspaceId, userId: req.user!.userId },
    });
    if (!workspace) return next(createError('Workspace not found', 404));

    let config = await OpenCodeConfig.findOne({
      where: { workspaceId: workspace.id },
    });

    if (!config) {
      config = await OpenCodeConfig.create({ workspaceId: workspace.id });
    }

    res.json({ success: true, config });
  } catch (error) {
    next(error);
  }
}

export async function updateConfig(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspace = await Workspace.findOne({
      where: { id: req.params.workspaceId, userId: req.user!.userId },
    });
    if (!workspace) return next(createError('Workspace not found', 404));

    const allowedFields = ['llmProvider', 'llmModel', 'llmApiKey', 'llmBaseUrl', 'skills', 'mcpServers'] as const;
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in req.body) {
        updates[field] = req.body[field];
      }
    }

    let config = await OpenCodeConfig.findOne({
      where: { workspaceId: workspace.id },
    });

    if (!config) {
      config = await OpenCodeConfig.create({
        workspaceId: workspace.id,
        ...updates,
      });
    } else {
      await config.update(updates);
    }

    res.json({ success: true, config });
  } catch (error) {
    next(error);
  }
}
