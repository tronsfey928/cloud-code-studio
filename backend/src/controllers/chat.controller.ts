import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession } from '../models/ChatSession';
import { ChatMessage } from '../models/ChatMessage';
import { Workspace } from '../models/Workspace';
import { openCodeService } from '../services/opencodeService';
import { AuthenticatedRequest, MessageType } from '../types';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { MAX_MESSAGE_LENGTH } from '../utils/validation';

export async function createSession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { workspaceId } = req.body as { workspaceId: string };
    if (!workspaceId) return next(createError('workspaceId is required', 400));

    const workspace = await Workspace.findOne({
      where: { id: workspaceId, userId: req.user!.userId },
    });
    if (!workspace) return next(createError('Workspace not found', 404));

    const session = await ChatSession.create({
      workspaceId,
      userId: req.user!.userId,
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
    const where: Record<string, string> = { userId: req.user!.userId };
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    const sessions = await ChatSession.findAll({
      where,
      order: [['updatedAt', 'DESC']],
    });
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
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!session) return next(createError('Session not found', 404));

    const messages = await ChatMessage.findAll({
      where: { sessionId: session.id },
      order: [['timestamp', 'ASC']],
    });

    res.json({ success: true, session: { ...session.toJSON(), messages } });
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
    if (content.length > MAX_MESSAGE_LENGTH) {
      return next(createError('Message content exceeds maximum allowed length', 413));
    }

    const session = await ChatSession.findOne({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!session) return next(createError('Session not found', 404));

    const workspace = await Workspace.findByPk(session.workspaceId);
    if (!workspace?.workspacePath) {
      return next(createError('Workspace is not ready', 400));
    }

    const userMsg = await ChatMessage.create({
      id: uuidv4(),
      sessionId: session.id,
      type: MessageType.CHAT_MESSAGE,
      content,
      timestamp: Date.now(),
      isStreaming: false,
      role: 'user',
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const assistantMsgId = uuidv4();
    let fullContent = '';

    try {
      for await (const chunk of openCodeService.streamResponse(
        workspace.workspacePath,
        content
      )) {
        fullContent += chunk.content;
        res.write(`data: ${JSON.stringify({ id: assistantMsgId, content: chunk.content, timestamp: chunk.timestamp })}\n\n`);
      }
    } catch (streamError) {
      logger.error('Stream error', { sessionId: session.id, streamError });
      const errorMsg = streamError instanceof Error ? streamError.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: `Stream processing failed: ${errorMsg}` })}\n\n`);
    }

    await ChatMessage.create({
      id: assistantMsgId,
      sessionId: session.id,
      type: MessageType.CHAT_MESSAGE,
      content: fullContent,
      timestamp: Date.now(),
      isStreaming: false,
      role: 'assistant',
    });

    // Touch updatedAt on session
    await session.update({ updatedAt: new Date() });

    logger.info('Message exchange saved', { sessionId: session.id, userMsgId: userMsg.id });

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
    const session = await ChatSession.findOne({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!session) return next(createError('Session not found', 404));

    await ChatMessage.destroy({ where: { sessionId: session.id } });
    await session.destroy();
    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    next(error);
  }
}
