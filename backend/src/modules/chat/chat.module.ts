import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { OpenCodeModule } from '../opencode/opencode.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage, Workspace]),
    OpenCodeModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
