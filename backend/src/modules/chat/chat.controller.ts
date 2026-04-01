import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('chat')
@Controller('api/chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiResponse({ status: 201, description: 'Session created' })
  async createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSessionDto,
  ) {
    const session = await this.chatService.createSession(user.userId, dto);
    return { session };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List chat sessions' })
  @ApiQuery({ name: 'workspaceId', required: false })
  @ApiResponse({ status: 200, description: 'List of sessions' })
  async getSessions(
    @CurrentUser() user: JwtPayload,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const sessions = await this.chatService.getSessions(user.userId, workspaceId);
    return { sessions };
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a chat session with messages' })
  @ApiResponse({ status: 200, description: 'Session with messages' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.chatService.getSession(id, user.userId);
    return { session: { ...result.session, messages: result.messages } };
  }

  @Post('sessions/:id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message (SSE streaming response)' })
  @ApiResponse({ status: 200, description: 'Streaming response' })
  async sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of this.chatService.sendMessage(id, user.userId, dto.content)) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.end();
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a chat session' })
  @ApiResponse({ status: 200, description: 'Session deleted' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async deleteSession(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.chatService.deleteSession(id, user.userId);
    return { message: 'Session deleted' };
  }
}
