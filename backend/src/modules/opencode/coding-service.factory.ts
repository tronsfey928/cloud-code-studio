import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenCodeConfig } from './entities/opencode-config.entity';
import { OpenCodeService, OpenCodeStreamEvent } from './opencode.service';
import { ClaudeCodeService, ClaudeCodeStreamEvent } from './claude-code.service';
import { ResponseChunk } from '../../common/interfaces';

export type CodingProvider = 'opencode' | 'claude_code';
export type CodingStreamEvent = OpenCodeStreamEvent | ClaudeCodeStreamEvent;

@Injectable()
export class CodingServiceFactory {
  private readonly logger = new Logger(CodingServiceFactory.name);

  constructor(
    @InjectRepository(OpenCodeConfig)
    private readonly configRepository: Repository<OpenCodeConfig>,
    private readonly openCodeService: OpenCodeService,
    private readonly claudeCodeService: ClaudeCodeService,
  ) {}

  async getCodingProvider(workspaceId: string): Promise<CodingProvider> {
    try {
      const wsConfig = await this.configRepository.findOne({ where: { workspaceId } });
      if (wsConfig?.codingProvider) {
        return wsConfig.codingProvider as CodingProvider;
      }
    } catch (error) {
      this.logger.warn(`Failed to read coding provider, defaulting to opencode: ${workspaceId}`);
    }
    return 'opencode';
  }

  async *streamCodingSession(
    workspacePath: string,
    userMessage: string,
    options: {
      planMode?: boolean;
      images?: string[];
      workspaceId?: string;
    } = {},
  ): AsyncGenerator<CodingStreamEvent, void, unknown> {
    const provider = options.workspaceId
      ? await this.getCodingProvider(options.workspaceId)
      : 'opencode';

    this.logger.log(`Using coding provider: ${provider}`);

    if (provider === 'claude_code') {
      yield* this.claudeCodeService.streamCodingSession(workspacePath, userMessage, options);
    } else {
      yield* this.openCodeService.streamCodingSession(workspacePath, userMessage, options);
    }
  }

  async *streamResponse(
    workspacePath: string,
    userMessage: string,
    options: { workspaceId?: string; sessionContext?: string } = {},
  ): AsyncGenerator<ResponseChunk, void, unknown> {
    const provider = options.workspaceId
      ? await this.getCodingProvider(options.workspaceId)
      : 'opencode';

    if (provider === 'claude_code') {
      yield* this.claudeCodeService.streamResponse(workspacePath, userMessage, options.sessionContext);
    } else {
      yield* this.openCodeService.streamResponse(workspacePath, userMessage, options.sessionContext);
    }
  }
}
