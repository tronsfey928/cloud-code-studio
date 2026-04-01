import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OpenCodeConfig } from './entities/opencode-config.entity';
import {
  ResponseChunk,
  ToolCallEvent,
  CodeChangeEvent,
  PlanStep,
} from '../../common/interfaces';

const execAsync = promisify(exec);

export interface CopilotCliStreamEvent {
  type: 'chunk' | 'tool_call' | 'code_change' | 'plan' | 'dev_server' | 'done';
  data: unknown;
}

@Injectable()
export class CopilotCliService {
  private readonly logger = new Logger(CopilotCliService.name);

  constructor(
    @InjectRepository(OpenCodeConfig)
    private readonly configRepository: Repository<OpenCodeConfig>,
    private readonly configService: ConfigService,
  ) {}

  async *streamCodingSession(
    workspacePath: string,
    userMessage: string,
    options: {
      planMode?: boolean;
      images?: string[];
      workspaceId?: string;
    } = {},
  ): AsyncGenerator<CopilotCliStreamEvent, void, unknown> {
    this.logger.log(`Starting GitHub Copilot CLI coding session: ${workspacePath}`);

    const messageB64 = Buffer.from(userMessage).toString('base64');
    const cmd =
      `cd ${this.escapeShellArg(workspacePath)} && ` +
      `echo "${messageB64}" | base64 -d | gh copilot suggest -t shell 2>&1 || true`;

    try {
      const hasCopilot = await this.checkCopilotCliInstalled();
      if (!hasCopilot) {
        yield {
          type: 'chunk',
          data: {
            content:
              'GitHub Copilot CLI is not installed. Install it with:\n' +
              '  1. Install GitHub CLI: https://cli.github.com/\n' +
              '  2. Install Copilot extension: `gh extension install github/gh-copilot`\n' +
              '  3. Authenticate: `gh auth login`\n',
            timestamp: Date.now(),
          } as ResponseChunk,
        };
        yield { type: 'done', data: { timestamp: Date.now() } };
        return;
      }

      const result = await execAsync(cmd, {
        shell: '/bin/bash',
        timeout: 300_000,
        env: { ...process.env },
      });

      const lines = result.stdout.split('\n').filter(Boolean);
      for (const line of lines) {
        const event = this.parseLine(line);
        if (event) yield event;
      }

      yield { type: 'done', data: { timestamp: Date.now() } };
    } catch (error) {
      this.logger.error(`GitHub Copilot CLI session error: ${(error as Error).message}`);
      yield {
        type: 'chunk',
        data: {
          content: `Error running GitHub Copilot CLI: ${(error as Error).message}\n`,
          timestamp: Date.now(),
        } as ResponseChunk,
      };
      yield { type: 'done', data: { timestamp: Date.now() } };
    }
  }

  async *streamResponse(
    workspacePath: string,
    userMessage: string,
    _sessionContext?: string,
  ): AsyncGenerator<ResponseChunk, void, unknown> {
    this.logger.log(`Streaming GitHub Copilot CLI response: ${workspacePath}`);

    const hasCopilot = await this.checkCopilotCliInstalled();

    if (hasCopilot) {
      const messageB64 = Buffer.from(userMessage).toString('base64');
      const cmd =
        `cd ${this.escapeShellArg(workspacePath)} && ` +
        `echo "${messageB64}" | base64 -d | gh copilot explain 2>&1 || true`;

      const result = await execAsync(cmd, {
        shell: '/bin/bash',
        timeout: 300_000,
        env: { ...process.env },
      });

      const lines = result.stdout.split('\n').filter(Boolean);
      for (const line of lines) {
        yield { content: line + '\n', timestamp: Date.now() };
        await this.sleep(30);
      }
    } else {
      const response =
        `I received your message: "${userMessage}"\n\n` +
        `GitHub Copilot CLI is not installed in this environment. ` +
        `To enable GitHub Copilot CLI support:\n` +
        `1. Install GitHub CLI: https://cli.github.com/\n` +
        `2. Install the Copilot extension: gh extension install github/gh-copilot\n` +
        `3. Authenticate: gh auth login\n`;

      const words = response.split(' ');
      let buffer = '';
      for (const word of words) {
        buffer += word + ' ';
        if (buffer.length > 40) {
          yield { content: buffer, timestamp: Date.now() };
          buffer = '';
          await this.sleep(30);
        }
      }
      if (buffer) yield { content: buffer, timestamp: Date.now() };
    }
  }

  async checkCopilotCliInstalled(): Promise<boolean> {
    try {
      await execAsync('gh copilot --version', { shell: '/bin/bash' });
      return true;
    } catch {
      return false;
    }
  }

  private parseLine(line: string): CopilotCliStreamEvent | null {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;

      if (obj['type'] === 'tool_call' || obj['type'] === 'tool_use') {
        return {
          type: 'tool_call',
          data: {
            id: (obj['id'] as string) || uuidv4(),
            toolName: obj['tool_name'] || obj['name'] || 'unknown',
            input: typeof obj['input'] === 'string' ? obj['input'] : JSON.stringify(obj['input']),
            output: obj['output'] as string | undefined,
            status: obj['status'] || 'completed',
            timestamp: Date.now(),
          } as ToolCallEvent,
        };
      }

      if (obj['type'] === 'file_change' || obj['type'] === 'code_change') {
        return {
          type: 'code_change',
          data: {
            id: (obj['id'] as string) || uuidv4(),
            filePath: obj['file_path'] || obj['path'] || 'unknown',
            changeType: obj['change_type'] || 'modified',
            diff: obj['diff'] as string | undefined,
            timestamp: Date.now(),
          } as CodeChangeEvent,
        };
      }

      if (obj['type'] === 'plan') {
        const steps = Array.isArray(obj['steps'])
          ? (obj['steps'] as Array<{ description: string }>).map(
              (s, i): PlanStep => ({
                index: i + 1,
                description: s.description || String(s),
                status: 'pending',
              }),
            )
          : [];
        return { type: 'plan', data: { id: uuidv4(), steps, status: 'pending', timestamp: Date.now() } };
      }

      if (obj['content'] || obj['text']) {
        return {
          type: 'chunk',
          data: { content: (obj['content'] || obj['text']) as string, timestamp: Date.now() } as ResponseChunk,
        };
      }

      if (obj['type'] === 'result' && obj['result']) {
        return {
          type: 'chunk',
          data: { content: String(obj['result']), timestamp: Date.now() } as ResponseChunk,
        };
      }

      return null;
    } catch {
      if (line.trim()) {
        return { type: 'chunk', data: { content: line + '\n', timestamp: Date.now() } as ResponseChunk };
      }
      return null;
    }
  }

  private escapeShellArg(value: string): string {
    return "'" + value.replace(/'/g, "'\\''") + "'";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
