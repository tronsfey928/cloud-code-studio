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

export interface ClaudeCodeStreamEvent {
  type: 'chunk' | 'tool_call' | 'code_change' | 'plan' | 'dev_server' | 'done';
  data: unknown;
}

@Injectable()
export class ClaudeCodeService {
  private readonly logger = new Logger(ClaudeCodeService.name);

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
  ): AsyncGenerator<ClaudeCodeStreamEvent, void, unknown> {
    this.logger.log(`Starting Claude Code coding session: ${workspacePath}`);

    if (options.workspaceId) {
      await this.writeClaudeConfig(workspacePath, options.workspaceId);
    }

    const envVars = this.buildEnvVars(options.workspaceId);
    const messageB64 = Buffer.from(userMessage).toString('base64');
    const planFlag = options.planMode ? '--plan' : '';
    const cmd =
      `cd ${this.escapeShellArg(workspacePath)} && export ${envVars.join(' ')} && ` +
      `echo "${messageB64}" | base64 -d | claude ${planFlag} --output-format json --print 2>&1 || true`;

    try {
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
      this.logger.error(`Claude Code session error: ${(error as Error).message}`);
      yield {
        type: 'chunk',
        data: { content: `Error running Claude Code: ${(error as Error).message}\n`, timestamp: Date.now() } as ResponseChunk,
      };
      yield { type: 'done', data: { timestamp: Date.now() } };
    }
  }

  async *streamResponse(
    workspacePath: string,
    userMessage: string,
    _sessionContext?: string,
  ): AsyncGenerator<ResponseChunk, void, unknown> {
    this.logger.log(`Streaming Claude Code response: ${workspacePath}`);

    const hasClaudeCode = await this.checkClaudeCodeInstalled();

    if (hasClaudeCode) {
      const messageB64 = Buffer.from(userMessage).toString('base64');
      const envVars = this.buildEnvVars();
      const cmd =
        `cd ${this.escapeShellArg(workspacePath)} && export ${envVars.join(' ')} && ` +
        `echo "${messageB64}" | base64 -d | claude --print 2>&1 || true`;

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
        `Claude Code CLI is not installed in this environment. ` +
        `To enable AI-powered coding with Claude Code, install the claude CLI ` +
        `and set your Anthropic API key in workspace settings.\n`;

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

  async checkClaudeCodeInstalled(): Promise<boolean> {
    try {
      await execAsync('which claude', { shell: '/bin/bash' });
      return true;
    } catch {
      return false;
    }
  }

  async writeClaudeConfig(workspacePath: string, workspaceId: string): Promise<void> {
    try {
      const wsConfig = await this.configRepository.findOne({ where: { workspaceId } });
      if (!wsConfig) return;

      const apiKey = wsConfig.llmApiKey || this.configService.get<string>('opencode.llmApiKey');
      const claudeConfig: Record<string, unknown> = {};

      if (apiKey) claudeConfig['apiKey'] = apiKey;
      if (wsConfig.llmModel) claudeConfig['model'] = wsConfig.llmModel;
      if (wsConfig.skills && wsConfig.skills.length > 0) claudeConfig['skills'] = wsConfig.skills;

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
        claudeConfig['mcpServers'] = mcpServers;
      }

      const configPath = path.join(workspacePath, '.claude.json');
      await fs.writeFile(configPath, JSON.stringify(claudeConfig, null, 2), 'utf8');
      this.logger.log(`Claude Code config written: ${workspaceId}`);
    } catch (error) {
      this.logger.warn(`Failed to write Claude Code config: ${workspaceId}`, (error as Error).stack);
    }
  }

  private buildEnvVars(workspaceId?: string): string[] {
    const vars: string[] = [];
    const llmApiKey = this.configService.get<string>('opencode.llmApiKey');
    if (llmApiKey) vars.push(`ANTHROPIC_API_KEY="${llmApiKey}"`);
    if (workspaceId) vars.push(`WORKSPACE_ID="${workspaceId}"`);
    if (vars.length === 0) vars.push('CLAUDE_STUB=1');
    return vars;
  }

  private parseLine(line: string): ClaudeCodeStreamEvent | null {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;

      if (obj['type'] === 'tool_use' || obj['type'] === 'tool_call') {
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

      if (obj['type'] === 'dev_server') {
        return {
          type: 'dev_server',
          data: { url: obj['url'], port: obj['port'], status: obj['status'] || 'running', timestamp: Date.now() },
        };
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
