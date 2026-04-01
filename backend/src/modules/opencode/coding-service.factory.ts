import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenCodeConfig } from './entities/opencode-config.entity';
import { OpenCodeService, OpenCodeStreamEvent } from './opencode.service';
import { ClaudeCodeService, ClaudeCodeStreamEvent } from './claude-code.service';
import { CodexService, CodexStreamEvent } from './codex.service';
import { CopilotCliService, CopilotCliStreamEvent } from './copilot-cli.service';
import { ResponseChunk } from '../../common/interfaces';

export type CodingProvider = 'opencode' | 'claude_code' | 'codex' | 'copilot_cli';
export type CodingStreamEvent =
  | OpenCodeStreamEvent
  | ClaudeCodeStreamEvent
  | CodexStreamEvent
  | CopilotCliStreamEvent;

@Injectable()
export class CodingServiceFactory {
  private readonly logger = new Logger(CodingServiceFactory.name);

  constructor(
    @InjectRepository(OpenCodeConfig)
    private readonly configRepository: Repository<OpenCodeConfig>,
    private readonly openCodeService: OpenCodeService,
    private readonly claudeCodeService: ClaudeCodeService,
    private readonly codexService: CodexService,
    private readonly copilotCliService: CopilotCliService,
  ) {}

  async getCodingProvider(workspaceId: string): Promise<CodingProvider> {
    try {
      const wsConfig = await this.configRepository.findOne({ where: { workspaceId } });
      if (wsConfig?.codingProvider) {
        return wsConfig.codingProvider as CodingProvider;
      }
    } catch (error) {
      this.logger.warn(`Failed to read coding provider, defaulting to claude_code: ${workspaceId}`);
    }
    return 'claude_code';
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
      : 'claude_code';

    this.logger.log(`Using coding provider: ${provider}`);

    switch (provider) {
      case 'claude_code':
        yield* this.claudeCodeService.streamCodingSession(workspacePath, userMessage, options);
        break;
      case 'codex':
        yield* this.codexService.streamCodingSession(workspacePath, userMessage, options);
        break;
      case 'copilot_cli':
        yield* this.copilotCliService.streamCodingSession(workspacePath, userMessage, options);
        break;
      case 'opencode':
      default:
        yield* this.openCodeService.streamCodingSession(workspacePath, userMessage, options);
        break;
    }
  }

  async *streamResponse(
    workspacePath: string,
    userMessage: string,
    options: { workspaceId?: string; sessionContext?: string } = {},
  ): AsyncGenerator<ResponseChunk, void, unknown> {
    const provider = options.workspaceId
      ? await this.getCodingProvider(options.workspaceId)
      : 'claude_code';

    switch (provider) {
      case 'claude_code':
        yield* this.claudeCodeService.streamResponse(workspacePath, userMessage, options.sessionContext);
        break;
      case 'codex':
        yield* this.codexService.streamResponse(workspacePath, userMessage, options.sessionContext);
        break;
      case 'copilot_cli':
        yield* this.copilotCliService.streamResponse(workspacePath, userMessage, options.sessionContext);
        break;
      case 'opencode':
      default:
        yield* this.openCodeService.streamResponse(workspacePath, userMessage, options.sessionContext);
        break;
    }
  }
}
