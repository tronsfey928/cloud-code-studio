import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession } from '../models/ChatSession';
import { Workspace } from '../models/Workspace';
import { openCodeService } from '../services/opencodeService';
import { AuthenticatedRequest, MessageType } from '../types';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export async function createSession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { workspaceId } = req.body as { workspaceId: string };
    if (!workspaceId) return next(createError('workspaceId is required', 400));

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      userId: new mongoose.Types.ObjectId(req.user!.userId),
    });
    if (!workspace) return next(createError('Workspace not found', 404));

    const session = await ChatSession.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      userId: new mongoose.Types.ObjectId(req.user!.userId),
      messages: [],
    });

    res.status(201).json({ success: true, session });
  } catch (error) {
    next(error);
  }
}

export async function getSessions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { workspaceId } = req.query as { workspaceId?: string };
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(req.user!.userId),
    };
    if (workspaceId) {
      query.workspaceId = new mongoose.Types.ObjectId(workspaceId);
    }

    const sessions = await ChatSession.find(query)
      .sort({ updatedAt: -1 })
      .select('-messages');
    res.json({ success: true, sessions });
  } catch (error) {
    next(error);
  }
}

export async function getSession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: new mongoose.Types.ObjectId(req.user!.userId),
    });
    if (!session) return next(createError('Session not found', 404));
    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { content } = req.body as { content: string };
    if (!content) return next(createError('content is required', 400));

    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: new mongoose.Types.ObjectId(req.user!.userId),
    }).populate<{ workspaceId: { containerId?: string } }>('workspaceId', 'containerId');

    if (!session) return next(createError('Session not found', 404));

    const workspace = session.workspaceId as unknown as { containerId?: string };
    if (!workspace?.containerId) {
      return next(createError('Workspace container is not running', 400));
    }

    const userMsg = {
      id: uuidv4(),
      type: MessageType.CHAT_MESSAGE,
      content,
      timestamp: Date.now(),
      isStreaming: false,
      role: 'user' as const,
    };

    session.messages.push(userMsg);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const assistantMsgId = uuidv4();
    let fullContent = '';

    try {
      for await (const chunk of openCodeService.streamResponse(
        workspace.containerId,
        content
      )) {
        fullContent += chunk.content;
        res.write(`data: ${JSON.stringify({ id: assistantMsgId, content: chunk.content, timestamp: chunk.timestamp })}\n\n`);
      }
    } catch (streamError) {
      logger.error('Stream error', { sessionId: session.id, streamError });
    }

    const assistantMsg = {
      id: assistantMsgId,
      type: MessageType.CHAT_MESSAGE,
      content: fullContent,
      timestamp: Date.now(),
      isStreaming: false,
      role: 'assistant' as const,
    };

    session.messages.push(assistantMsg);
    await session.save();

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    next(error);
  }
}

export async function deleteSession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await ChatSession.findOneAndDelete({
      _id: req.params.id,
      userId: new mongoose.Types.ObjectId(req.user!.userId),
    });
    if (!session) return next(createError('Session not found', 404));
    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    next(error);
  }
}
