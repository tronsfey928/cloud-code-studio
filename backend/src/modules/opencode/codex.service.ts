import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { OpenCodeConfig } from './entities/opencode-config.entity';
import {
  ResponseChunk,
  ToolCallEvent,
  CodeChangeEvent,
  PlanStep,
  McpServerConfig,
} from '../../common/interfaces';

const execAsync = promisify(exec);

export interface CodexStreamEvent {
  type: 'chunk' | 'tool_call' | 'code_change' | 'plan' | 'dev_server' | 'done';
  data: unknown;
}

@Injectable()
export class CodexService {
  private readonly logger = new Logger(CodexService.name);

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
  ): AsyncGenerator<CodexStreamEvent, void, unknown> {
    this.logger.log(`Starting Codex coding session: ${workspacePath}`);

    if (options.workspaceId) {
      await this.writeCodexConfig(workspacePath, options.workspaceId);
    }

    const envVars = this.buildEnvVars(options.workspaceId);
    const messageB64 = Buffer.from(userMessage).toString('base64');
    const planFlag = options.planMode ? '--approval-mode suggest' : '--approval-mode auto-edit';
    const cmd =
      `cd ${this.escapeShellArg(workspacePath)} && export ${envVars.join(' ')} && ` +
      `echo "${messageB64}" | base64 -d | codex ${planFlag} --quiet 2>&1 || true`;

    try {
      const hasCodex = await this.checkCodexInstalled();
      if (!hasCodex) {
        yield {
          type: 'chunk',
          data: {
            content:
              'Codex CLI is not installed. Install it with: `npm install -g @openai/codex`\n' +
              'Then set your OpenAI API key in workspace settings.\n',
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
      this.logger.error(`Codex session error: ${(error as Error).message}`);
      yield {
        type: 'chunk',
        data: {
          content: `Error running Codex: ${(error as Error).message}\n`,
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
    this.logger.log(`Streaming Codex response: ${workspacePath}`);

    const hasCodex = await this.checkCodexInstalled();

    if (hasCodex) {
      const messageB64 = Buffer.from(userMessage).toString('base64');
      const envVars = this.buildEnvVars();
      const cmd =
        `cd ${this.escapeShellArg(workspacePath)} && export ${envVars.join(' ')} && ` +
        `echo "${messageB64}" | base64 -d | codex --quiet 2>&1 || true`;

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
        `Codex CLI is not installed in this environment. ` +
        `To enable AI-powered coding with Codex, install: npm install -g @openai/codex\n` +
        `Then set your OpenAI API key in workspace settings.\n`;

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

  async checkCodexInstalled(): Promise<boolean> {
    try {
      await execAsync('which codex', { shell: '/bin/bash' });
      return true;
    } catch {
      return false;
    }
  }

  async writeCodexConfig(workspacePath: string, workspaceId: string): Promise<void> {
    try {
      const wsConfig = await this.configRepository.findOne({ where: { workspaceId } });
      if (!wsConfig) return;

      const apiKey = wsConfig.llmApiKey || this.configService.get<string>('opencode.llmApiKey');
      const codexConfig: Record<string, unknown> = {};

      if (apiKey) codexConfig['apiKey'] = apiKey;
      if (wsConfig.llmModel) codexConfig['model'] = wsConfig.llmModel;

      const enabledServers = (wsConfig.mcpServers || []).filter(
        (s: McpServerConfig) => s.enabled && s.name,
      );

      if (enabledServers.length > 0) {
        const mcpServers: Record<string, Record<string, unknown>> = {};
        for (const server of enabledServers) {
          if (server.command) {
            mcpServers[server.name] = { command: server.command, args: server.args || [] };
          } else if (server.url) {
            mcpServers[server.name] = { url: server.url };
          }
        }
        codexConfig['mcpServers'] = mcpServers;
      }

      const configPath = path.join(workspacePath, '.codex.json');
      await fs.writeFile(configPath, JSON.stringify(codexConfig, null, 2), 'utf8');
      this.logger.log(`Codex config written: ${workspaceId}`);
    } catch (error) {
      this.logger.warn(`Failed to write Codex config: ${workspaceId}`, (error as Error).stack);
    }
  }

  private buildEnvVars(workspaceId?: string): string[] {
    const vars: string[] = [];
    const llmApiKey = this.configService.get<string>('opencode.llmApiKey');
    if (llmApiKey) vars.push(`OPENAI_API_KEY="${llmApiKey}"`);
    if (workspaceId) vars.push(`WORKSPACE_ID="${workspaceId}"`);
    if (vars.length === 0) vars.push('CODEX_STUB=1');
    return vars;
  }

  private parseLine(line: string): CodexStreamEvent | null {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;

      if (obj['type'] === 'tool_use' || obj['type'] === 'tool_call' || obj['type'] === 'function_call') {
        return {
          type: 'tool_call',
          data: {
            id: (obj['id'] as string) || uuidv4(),
            toolName: obj['tool_name'] || obj['name'] || obj['function'] || 'unknown',
            input: typeof obj['input'] === 'string' ? obj['input'] : JSON.stringify(obj['input'] || obj['arguments']),
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
