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

    let config = await OpenCodeConfig.findOne({
      where: { workspaceId: workspace.id },
    });

    if (!config) {
      config = await OpenCodeConfig.create({
        workspaceId: workspace.id,
        ...req.body,
      });
    } else {
      await config.update(req.body);
    }

    res.json({ success: true, config });
  } catch (error) {
    next(error);
  }
}
