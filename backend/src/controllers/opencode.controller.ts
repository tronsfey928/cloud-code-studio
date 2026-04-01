import { Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace';
import { OpenCodeConfig } from '../models/OpenCodeConfig';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';

function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

function toSafeConfig(config: OpenCodeConfig): Record<string, unknown> {
  const json = config.toJSON() as Record<string, unknown>;
  json.llmApiKey = maskApiKey(config.llmApiKey as string | null);
  return json;
}

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

    res.json({ success: true, config: toSafeConfig(config) });
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

    const allowedFields = ['codingProvider', 'llmProvider', 'llmModel', 'llmApiKey', 'llmBaseUrl', 'skills', 'mcpServers', 'setupCommands'] as const;
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

    res.json({ success: true, config: toSafeConfig(config) });
  } catch (error) {
    next(error);
  }
}
