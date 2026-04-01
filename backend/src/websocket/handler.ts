import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import { JwtPayload, MessageType, ResponseChunk, FileAttachment } from '../types';
import { ChatSession } from '../models/ChatSession';
import { ChatMessage } from '../models/ChatMessage';
import { Workspace } from '../models/Workspace';
import { openCodeService } from '../services/opencodeService';
import { streamCodingSession } from '../services/codingServiceFactory';
import { isValidPort, MAX_MESSAGE_LENGTH, MAX_ATTACHMENT_SIZE } from '../utils/validation';

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

    // ─── Join Session ────────────────────────────────────────────
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

        // Push workspace info on join
        const workspace = await Workspace.findByPk(session.workspaceId);
        if (workspace?.workspacePath) {
          try {
            const wsInfo = await openCodeService.getWorkspaceInfo(workspace.workspacePath);
            socket.emit('workspace_info', {
              workspaceId: workspace.id,
              ...wsInfo,
              timestamp: Date.now(),
            });
          } catch (err) {
            logger.warn('Failed to get workspace info on join', { err });
          }
        }
      } catch (error) {
        logger.error('join_session error', { error });
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // ─── Chat Message (supports plan mode, images) ───────────────
    socket.on(
      'chat_message',
      async ({
        sessionId,
        content,
        attachments,
        planMode,
      }: {
        sessionId: string;
        content: string;
        attachments?: FileAttachment[];
        planMode?: boolean;
      }) => {
        try {
          // Validate message content
          if (!content || typeof content !== 'string' || content.trim().length === 0) {
            socket.emit('error', { message: 'Message content is required' });
            return;
          }
          if (content.length > MAX_MESSAGE_LENGTH) {
            socket.emit('error', { message: 'Message content exceeds maximum length' });
            return;
          }

          // Validate attachment sizes
          if (attachments && Array.isArray(attachments)) {
            const totalSize = attachments.reduce(
              (sum, a) => sum + (typeof a.data === 'string' ? a.data.length : 0),
              0
            );
            if (totalSize > MAX_ATTACHMENT_SIZE) {
              socket.emit('error', { message: 'Total attachment size exceeds limit' });
              return;
            }
          }

          const session = await ChatSession.findOne({
            where: { id: sessionId, userId: socket.user!.userId },
          });

          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }

          const workspace = await Workspace.findByPk(session.workspaceId);
          if (!workspace?.workspacePath) {
            socket.emit('error', { message: 'Workspace is not ready' });
            return;
          }

          // Persist & broadcast user message
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
          io.to(`session:${sessionId}`).emit('message', {
            ...userMsg.toJSON(),
            attachments,
          });

          // Start assistant response
          const assistantMsgId = uuidv4();
          let fullContent = '';

          io.to(`session:${sessionId}`).emit('message_start', {
            id: assistantMsgId,
            role: 'assistant',
            timestamp: Date.now(),
          });

          // Extract base64 image data from attachments
          const imageData = attachments
            ?.filter((a): a is FileAttachment & { data: string } =>
              Boolean(a.mimeType?.startsWith('image/') && typeof a.data === 'string')
            )
            .map((a) => a.data);

          // Use the full coding session stream (routed through the factory)
          for await (const event of streamCodingSession(
            workspace.workspacePath,
            content,
            {
              planMode,
              images: imageData,
              workspaceId: workspace.id,
            }
          )) {
            switch (event.type) {
              case 'chunk': {
                const chunk = event.data as ResponseChunk;
                fullContent += chunk.content;
                io.to(`session:${sessionId}`).emit('message_chunk', {
                  id: assistantMsgId,
                  content: chunk.content,
                  timestamp: chunk.timestamp,
                });
                break;
              }
              case 'tool_call': {
                io.to(`session:${sessionId}`).emit('tool_call', event.data);
                break;
              }
              case 'code_change': {
                io.to(`session:${sessionId}`).emit('code_change', event.data);
                break;
              }
              case 'plan': {
                io.to(`session:${sessionId}`).emit('plan_pending', event.data);
                break;
              }
              case 'dev_server': {
                io.to(`session:${sessionId}`).emit('dev_server_started', event.data);
                break;
              }
              case 'done':
                break;
            }
          }

          // Persist assistant message
          const assistantMsg = await ChatMessage.create({
            id: assistantMsgId,
            sessionId,
            type: MessageType.CHAT_MESSAGE,
            content: fullContent,
            timestamp: Date.now(),
            isStreaming: false,
            role: 'assistant',
          });

          await session.update({ updatedAt: new Date() });

          io.to(`session:${sessionId}`).emit('message_complete', assistantMsg.toJSON());
        } catch (error) {
          logger.error('chat_message error', { error });
          socket.emit('error', { message: 'Failed to process message' });
        }
      }
    );

    // ─── Plan Confirmation ───────────────────────────────────────
    socket.on(
      'plan_confirm',
      async ({
        sessionId,
        planId,
        confirmed,
      }: {
        sessionId: string;
        planId: string;
        confirmed: boolean;
      }) => {
        io.to(`session:${sessionId}`).emit('plan_status', {
          id: planId,
          status: confirmed ? 'confirmed' : 'rejected',
          timestamp: Date.now(),
        });
      }
    );

    // ─── Code Execution ──────────────────────────────────────────
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

          if (!workspace?.workspacePath) {
            socket.emit('error', { message: 'Workspace not ready' });
            return;
          }

          socket.emit('execution_start', { sessionId, command });
          const result = await openCodeService.executeCommand(workspace.workspacePath, command);
          socket.emit('execution_complete', { sessionId, result });
        } catch (error) {
          logger.error('code_execution error', { error });
          socket.emit('error', { message: 'Execution failed' });
        }
      }
    );

    // ─── Start Dev Server ────────────────────────────────────────
    socket.on(
      'start_dev_server',
      async ({
        sessionId,
        workspaceId,
        command,
        port,
      }: {
        sessionId: string;
        workspaceId: string;
        command: string;
        port: number;
      }) => {
        try {
          if (!isValidPort(port)) {
            socket.emit('error', { message: 'Port must be between 1024 and 65535' });
            return;
          }

          const workspace = await Workspace.findOne({
            where: { id: workspaceId, userId: socket.user!.userId },
          });

          if (!workspace?.workspacePath) {
            socket.emit('error', { message: 'Workspace not ready' });
            return;
          }

          const result = await openCodeService.startDevServer(
            workspace.workspacePath,
            command,
            port
          );

          io.to(`session:${sessionId}`).emit('dev_server_started', {
            ...result,
            status: 'running',
            timestamp: Date.now(),
          });
        } catch (error) {
          logger.error('start_dev_server error', { error });
          socket.emit('error', { message: 'Failed to start dev server' });
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
