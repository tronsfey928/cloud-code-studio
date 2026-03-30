import { Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace';
import { fileService } from '../services/fileService';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

async function resolveWorkspace(workspaceId: string, userId: string) {
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!workspace) throw createError('Workspace not found', 404);
  if (!workspace.containerId) throw createError('Workspace container is not running', 400);
  return workspace;
}

export async function getFileTree(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspace = await resolveWorkspace(req.params.workspaceId, req.user!.userId);
    const dirPath = (req.query.path as string) || '/workspace';
    const depth = parseInt((req.query.depth as string) || '3', 10);
    const tree = await fileService.getFileTree(workspace.containerId!, dirPath, depth);
    res.json({ success: true, tree });
  } catch (error) {
    next(error);
  }
}

export async function readFile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspace = await resolveWorkspace(req.params.workspaceId, req.user!.userId);
    const filePath = req.query.path as string;
    if (!filePath) return next(createError('path query parameter is required', 400));
    const file = await fileService.readFile(workspace.containerId!, filePath);
    res.json({ success: true, file });
  } catch (error) {
    next(error);
  }
}

export async function writeFile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspace = await resolveWorkspace(req.params.workspaceId, req.user!.userId);
    const { path: filePath, content } = req.body as { path: string; content: string };
    if (!filePath || content === undefined) {
      return next(createError('path and content are required', 400));
    }
    await fileService.writeFile(workspace.containerId!, filePath, content);
    res.json({ success: true, message: 'File written successfully' });
  } catch (error) {
    next(error);
  }
}

export async function uploadFile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspace = await resolveWorkspace(req.params.workspaceId, req.user!.userId);
    const { sessionId, targetPath = '/' } = req.body as { sessionId?: string; targetPath?: string };

    if (!req.file) return next(createError('No file uploaded', 400));
    if (!sessionId) return next(createError('sessionId is required', 400));

    const result = await fileService.uploadFile(
      sessionId,
      workspace.id as string,
      workspace.containerId!,
      req.file,
      targetPath
    );

    logger.info('File uploaded', { workspaceId: workspace.id, filename: req.file.originalname });
    res.status(201).json({ success: true, result });
  } catch (error) {
    next(error);
  }
}
