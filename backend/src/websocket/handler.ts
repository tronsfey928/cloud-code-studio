import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import { JwtPayload, MessageType } from '../types';
import { ChatSession } from '../models/ChatSession';
import { ChatMessage } from '../models/ChatMessage';
import { Workspace } from '../models/Workspace';
import { openCodeService } from '../services/opencodeService';
import { containerManager } from '../services/containerService';

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

export function setupWebSocket(io: Server): void {
  // Auth middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: socket.user?.userId,
    });

    socket.on('join_session', async ({ sessionId }: { sessionId: string }) => {
      try {
        const session = await ChatSession.findOne({
          where: { id: sessionId, userId: socket.user!.userId },
        });

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        const messageCount = await ChatMessage.count({ where: { sessionId } });

        await socket.join(`session:${sessionId}`);
        socket.emit('session_joined', { sessionId, messageCount });
        logger.info('Socket joined session', { socketId: socket.id, sessionId });
      } catch (error) {
        logger.error('join_session error', { error });
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    socket.on(
      'chat_message',
      async ({ sessionId, content }: { sessionId: string; content: string }) => {
        try {
          const session = await ChatSession.findOne({
            where: { id: sessionId, userId: socket.user!.userId },
          });

          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }

          const workspace = await Workspace.findByPk(session.workspaceId);
          if (!workspace?.containerId) {
            socket.emit('error', { message: 'Workspace container is not running' });
            return;
          }

          const userMsgId = uuidv4();
          const userMsg = await ChatMessage.create({
            id: userMsgId,
            sessionId,
            type: MessageType.CHAT_MESSAGE,
            content,
            timestamp: Date.now(),
            isStreaming: false,
            role: 'user',
          });
          io.to(`session:${sessionId}`).emit('message', userMsg.toJSON());

          const assistantMsgId = uuidv4();
          let fullContent = '';

          io.to(`session:${sessionId}`).emit('message_start', {
            id: assistantMsgId,
            role: 'assistant',
            timestamp: Date.now(),
          });

          for await (const chunk of openCodeService.streamResponse(
            workspace.containerId,
            content
          )) {
            fullContent += chunk.content;
            io.to(`session:${sessionId}`).emit('message_chunk', {
              id: assistantMsgId,
              content: chunk.content,
              timestamp: chunk.timestamp,
            });
          }

          const assistantMsg = await ChatMessage.create({
            id: assistantMsgId,
            sessionId,
            type: MessageType.CHAT_MESSAGE,
            content: fullContent,
            timestamp: Date.now(),
            isStreaming: false,
            role: 'assistant',
          });

          // Touch updatedAt on session
          await session.update({ updatedAt: new Date() });

          io.to(`session:${sessionId}`).emit('message_complete', assistantMsg.toJSON());
        } catch (error) {
          logger.error('chat_message error', { error });
          socket.emit('error', { message: 'Failed to process message' });
        }
      }
    );

    socket.on(
      'code_execution',
      async ({
        sessionId,
        workspaceId,
        command,
      }: {
        sessionId: string;
        workspaceId: string;
        command: string;
      }) => {
        try {
          const workspace = await Workspace.findOne({
            where: { id: workspaceId, userId: socket.user!.userId },
          });

          if (!workspace?.containerId) {
            socket.emit('error', { message: 'Workspace not running' });
            return;
          }

          socket.emit('execution_start', { sessionId, command });
          const result = await openCodeService.executeCommand(workspace.containerId, command);
          socket.emit('execution_complete', { sessionId, result });
        } catch (error) {
          logger.error('code_execution error', { error });
          socket.emit('error', { message: 'Execution failed' });
        }
      }
    );

    socket.on(
      'container_status',
      async ({ workspaceId }: { workspaceId: string }) => {
        try {
          const workspace = await Workspace.findOne({
            where: { id: workspaceId, userId: socket.user!.userId },
          });

          if (!workspace?.containerId) {
            socket.emit('container_status_update', { workspaceId, status: workspace?.status || 'unknown' });
            return;
          }

          const status = await containerManager.getStatus(workspace.containerId);
          socket.emit('container_status_update', { workspaceId, status });
        } catch (error) {
          logger.error('container_status error', { error });
          socket.emit('error', { message: 'Failed to get container status' });
        }
      }
    );

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        userId: socket.user?.userId,
        reason,
      });
    });
  });
}
