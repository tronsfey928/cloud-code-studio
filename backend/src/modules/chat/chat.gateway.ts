import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { CodingServiceFactory } from '../opencode/coding-service.factory';
import { OpenCodeService } from '../opencode/opencode.service';
import {
  JwtPayload,
  MessageType,
  ResponseChunk,
  FileAttachment,
} from '../../common/interfaces';
import { isValidPort } from '../../common/validation';
import { MAX_MESSAGE_LENGTH, MAX_ATTACHMENT_SIZE } from '../../common/constants';

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly codingServiceFactory: CodingServiceFactory,
    private readonly openCodeService: OpenCodeService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect();
      return;
    }

    try {
      const secret = this.configService.get<string>('jwt.secret', 'your-secret-key');
      const decoded = jwt.verify(token, secret) as JwtPayload;
      socket.user = decoded;
      this.logger.log(`WebSocket client connected: ${socket.id} user: ${decoded.userId}`);
    } catch {
      socket.emit('error', { message: 'Invalid token' });
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthenticatedSocket): void {
    this.logger.log(`WebSocket client disconnected: ${socket.id} user: ${socket.user?.userId}`);
  }

  @SubscribeMessage('join_session')
  async handleJoinSession(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: data.sessionId, userId: socket.user!.userId },
      });

      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      const messageCount = await this.messageRepository.count({ where: { sessionId: data.sessionId } });
      await socket.join(`session:${data.sessionId}`);
      socket.emit('session_joined', { sessionId: data.sessionId, messageCount });

      const workspace = await this.workspaceRepository.findOne({ where: { id: session.workspaceId } });
      if (workspace?.workspacePath) {
        try {
          const wsInfo = await this.openCodeService.getWorkspaceInfo(workspace.workspacePath);
          socket.emit('workspace_info', {
            workspaceId: workspace.id,
            ...wsInfo,
            timestamp: Date.now(),
          });
        } catch (err) {
          this.logger.warn('Failed to get workspace info on join', (err as Error).stack);
        }
      }
    } catch (error) {
      this.logger.error('join_session error', (error as Error).stack);
      socket.emit('error', { message: 'Failed to join session' });
    }
  }

  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: {
      sessionId: string;
      content: string;
      attachments?: FileAttachment[];
      planMode?: boolean;
    },
  ): Promise<void> {
    try {
      if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
        socket.emit('error', { message: 'Message content is required' });
        return;
      }
      if (data.content.length > MAX_MESSAGE_LENGTH) {
        socket.emit('error', { message: 'Message content exceeds maximum length' });
        return;
      }

      if (data.attachments && Array.isArray(data.attachments)) {
        const totalSize = data.attachments.reduce(
          (sum, a) => sum + (typeof a.data === 'string' ? a.data.length : 0),
          0,
        );
        if (totalSize > MAX_ATTACHMENT_SIZE) {
          socket.emit('error', { message: 'Total attachment size exceeds limit' });
          return;
        }
      }

      const session = await this.sessionRepository.findOne({
        where: { id: data.sessionId, userId: socket.user!.userId },
      });

      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      const workspace = await this.workspaceRepository.findOne({ where: { id: session.workspaceId } });
      if (!workspace?.workspacePath) {
        socket.emit('error', { message: 'Workspace is not ready' });
        return;
      }

      // Persist user message
      const userMsgId = uuidv4();
      const userMsg = this.messageRepository.create({
        id: userMsgId,
        sessionId: data.sessionId,
        type: MessageType.CHAT_MESSAGE,
        content: data.content,
        timestamp: Date.now(),
        isStreaming: false,
        role: 'user',
      });
      await this.messageRepository.save(userMsg);

      this.server.to(`session:${data.sessionId}`).emit('message', {
        ...userMsg,
        attachments: data.attachments,
      });

      // Start assistant response
      const assistantMsgId = uuidv4();
      let fullContent = '';

      this.server.to(`session:${data.sessionId}`).emit('message_start', {
        id: assistantMsgId,
        role: 'assistant',
        timestamp: Date.now(),
      });

      const imageData = data.attachments
        ?.filter((a): a is FileAttachment & { data: string } =>
          Boolean(a.mimeType?.startsWith('image/') && typeof a.data === 'string'),
        )
        .map((a) => a.data);

      for await (const event of this.codingServiceFactory.streamCodingSession(
        workspace.workspacePath,
        data.content,
        { planMode: data.planMode, images: imageData, workspaceId: workspace.id },
      )) {
        switch (event.type) {
          case 'chunk': {
            const chunk = event.data as ResponseChunk;
            fullContent += chunk.content;
            this.server.to(`session:${data.sessionId}`).emit('message_chunk', {
              id: assistantMsgId,
              content: chunk.content,
              timestamp: chunk.timestamp,
            });
            break;
          }
          case 'tool_call':
            this.server.to(`session:${data.sessionId}`).emit('tool_call', event.data);
            break;
          case 'code_change':
            this.server.to(`session:${data.sessionId}`).emit('code_change', event.data);
            break;
          case 'plan':
            this.server.to(`session:${data.sessionId}`).emit('plan_pending', event.data);
            break;
          case 'dev_server':
            this.server.to(`session:${data.sessionId}`).emit('dev_server_started', event.data);
            break;
          case 'done':
            break;
        }
      }

      // Persist assistant message
      const assistantMsg = this.messageRepository.create({
        id: assistantMsgId,
        sessionId: data.sessionId,
        type: MessageType.CHAT_MESSAGE,
        content: fullContent,
        timestamp: Date.now(),
        isStreaming: false,
        role: 'assistant',
      });
      await this.messageRepository.save(assistantMsg);

      session.updatedAt = new Date();
      await this.sessionRepository.save(session);

      this.server.to(`session:${data.sessionId}`).emit('message_complete', assistantMsg);
    } catch (error) {
      this.logger.error('chat_message error', (error as Error).stack);
      socket.emit('error', { message: 'Failed to process message' });
    }
  }

  @SubscribeMessage('plan_confirm')
  handlePlanConfirm(
    @MessageBody() data: { sessionId: string; planId: string; confirmed: boolean },
  ): void {
    this.server.to(`session:${data.sessionId}`).emit('plan_status', {
      id: data.planId,
      status: data.confirmed ? 'confirmed' : 'rejected',
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('code_execution')
  async handleCodeExecution(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string; workspaceId: string; command: string },
  ): Promise<void> {
    try {
      const workspace = await this.workspaceRepository.findOne({
        where: { id: data.workspaceId, userId: socket.user!.userId },
      });

      if (!workspace?.workspacePath) {
        socket.emit('error', { message: 'Workspace not ready' });
        return;
      }

      socket.emit('execution_start', { sessionId: data.sessionId, command: data.command });
      const result = await this.openCodeService.executeCommand(workspace.workspacePath, data.command);
      socket.emit('execution_complete', { sessionId: data.sessionId, result });
    } catch (error) {
      this.logger.error('code_execution error', (error as Error).stack);
      socket.emit('error', { message: 'Execution failed' });
    }
  }

  @SubscribeMessage('start_dev_server')
  async handleStartDevServer(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string; workspaceId: string; command: string; port: number },
  ): Promise<void> {
    try {
      if (!isValidPort(data.port)) {
        socket.emit('error', { message: 'Port must be between 1024 and 65535' });
        return;
      }

      const workspace = await this.workspaceRepository.findOne({
        where: { id: data.workspaceId, userId: socket.user!.userId },
      });

      if (!workspace?.workspacePath) {
        socket.emit('error', { message: 'Workspace not ready' });
        return;
      }

      const result = await this.openCodeService.startDevServer(
        workspace.workspacePath,
        data.command,
        data.port,
      );

      this.server.to(`session:${data.sessionId}`).emit('dev_server_started', {
        ...result,
        status: 'running',
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error('start_dev_server error', (error as Error).stack);
      socket.emit('error', { message: 'Failed to start dev server' });
    }
  }
}
