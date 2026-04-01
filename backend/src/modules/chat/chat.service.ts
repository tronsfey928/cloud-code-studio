import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { MessageType, ResponseChunk } from '../../common/interfaces';
import { OpenCodeService } from '../opencode/opencode.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly openCodeService: OpenCodeService,
  ) {}

  async createSession(userId: string, dto: CreateSessionDto): Promise<ChatSession> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: dto.workspaceId, userId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const session = this.sessionRepository.create({
      workspaceId: dto.workspaceId,
      userId,
    });
    return this.sessionRepository.save(session);
  }

  async getSessions(userId: string, workspaceId?: string): Promise<ChatSession[]> {
    const where: Record<string, string> = { userId };
    if (workspaceId) where['workspaceId'] = workspaceId;

    return this.sessionRepository.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  async getSession(id: string, userId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    const session = await this.sessionRepository.findOne({
      where: { id, userId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const messages = await this.messageRepository.find({
      where: { sessionId: session.id },
      order: { timestamp: 'ASC' },
    });

    return { session, messages };
  }

  async *sendMessage(
    sessionId: string,
    userId: string,
    content: string,
  ): AsyncGenerator<{ id: string; content: string; timestamp: number } | { done: true }, void, unknown> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const workspace = await this.workspaceRepository.findOne({
      where: { id: session.workspaceId },
    });
    if (!workspace?.workspacePath) {
      throw new BadRequestException('Workspace is not ready');
    }

    await this.messageRepository.save(
      this.messageRepository.create({
        id: uuidv4(),
        sessionId: session.id,
        type: MessageType.CHAT_MESSAGE,
        content,
        timestamp: Date.now(),
        isStreaming: false,
        role: 'user',
      }),
    );

    const assistantMsgId = uuidv4();
    let fullContent = '';

    try {
      for await (const chunk of this.openCodeService.streamResponse(
        workspace.workspacePath,
        content,
      )) {
        fullContent += chunk.content;
        yield { id: assistantMsgId, content: chunk.content, timestamp: chunk.timestamp };
      }
    } catch (streamError) {
      this.logger.error(`Stream error in session ${session.id}`, (streamError as Error).stack);
      const errorMsg = streamError instanceof Error ? streamError.message : 'Unknown error';
      yield { id: assistantMsgId, content: `Stream processing failed: ${errorMsg}`, timestamp: Date.now() };
    }

    await this.messageRepository.save(
      this.messageRepository.create({
        id: assistantMsgId,
        sessionId: session.id,
        type: MessageType.CHAT_MESSAGE,
        content: fullContent,
        timestamp: Date.now(),
        isStreaming: false,
        role: 'assistant',
      }),
    );

    session.updatedAt = new Date();
    await this.sessionRepository.save(session);

    this.logger.log(`Message exchange saved: ${session.id}`);
    yield { done: true };
  }

  async deleteSession(id: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id, userId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.messageRepository.delete({ sessionId: session.id });
    await this.sessionRepository.remove(session);
  }
}
