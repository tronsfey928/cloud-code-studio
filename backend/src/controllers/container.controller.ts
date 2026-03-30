import { Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace';
import { containerManager } from '../services/containerService';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

async function getWorkspaceAndContainer(
  workspaceId: string,
  userId: string
): Promise<{ workspace: Workspace; containerId: string }> {
  const workspace = await Workspace.findOne({ where: { id: workspaceId, userId } });
  if (!workspace) throw createError('Workspace not found', 404);
  if (!workspace.containerId) throw createError('No container for this workspace', 400);
  return { workspace, containerId: workspace.containerId };
}

export async function getContainerStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { workspace, containerId } = await getWorkspaceAndContainer(
      req.params.workspaceId,
      req.user!.userId
    );
    const status = await containerManager.getStatus(containerId);
    res.json({ success: true, workspaceId: workspace.id, status });
  } catch (error) {
    next(error);
  }
}

export async function startContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspace = await Workspace.findOne({
      where: { id: req.params.workspaceId, userId: req.user!.userId },
    });
    if (!workspace) return next(createError('Workspace not found', 404));

    if (workspace.status === 'running') {
      res.json({ success: true, message: 'Container already running' });
      return;
    }

    const containerId = await containerManager.createAndStart(
      workspace.id,
      workspace.repositoryUrl,
      workspace.branch,
      {
        cpu: workspace.config.resources.cpu,
        memory: workspace.config.resources.memory,
      }
    );

    await Workspace.update(
      { containerId, status: 'running' },
      { where: { id: workspace.id } }
    );
    logger.info('Container started', { workspaceId: workspace.id, containerId });
    const updated = await Workspace.findByPk(workspace.id);
    res.json({ success: true, workspace: updated });
  } catch (error) {
    next(error);
  }
}

export async function stopContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { workspace, containerId } = await getWorkspaceAndContainer(
      req.params.workspaceId,
      req.user!.userId
    );

    await containerManager.stop(containerId);
    await Workspace.update({ status: 'stopped' }, { where: { id: workspace.id } });
    const updated = await Workspace.findByPk(workspace.id);
    res.json({ success: true, workspace: updated });
  } catch (error) {
    next(error);
  }
}

export async function getContainerLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { containerId } = await getWorkspaceAndContainer(
      req.params.workspaceId,
      req.user!.userId
    );
    const tail = parseInt((req.query.tail as string) || '100', 10);
    const logs = await containerManager.getLogs(containerId, tail);
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
}

export async function execInContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { command } = req.body as { command: string[] };
    if (!command || !Array.isArray(command)) {
      return next(createError('command array is required', 400));
    }

    const { containerId } = await getWorkspaceAndContainer(
      req.params.workspaceId,
      req.user!.userId
    );

    const result = await containerManager.exec(containerId, command);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
}
