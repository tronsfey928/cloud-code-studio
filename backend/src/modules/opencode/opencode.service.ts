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

export interface OpenCodeStreamEvent {
  type: 'chunk' | 'tool_call' | 'code_change' | 'plan' | 'dev_server' | 'done';
  data: unknown;
}

@Injectable()
export class OpenCodeService {
  private readonly logger = new Logger(OpenCodeService.name);

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
  ): AsyncGenerator<OpenCodeStreamEvent, void, unknown> {
    this.logger.log(`Starting OpenCode coding session: ${workspacePath}`);

    if (options.workspaceId) {
      await this.writeOpenCodeConfig(workspacePath, options.workspaceId);
      await this.runSetupCommands(workspacePath, options.workspaceId);
    }

    const envVars = this.buildEnvVars(options.workspaceId);
    const planFlag = options.planMode ? '--plan' : '';
    const messageB64 = Buffer.from(userMessage).toString('base64');

    const cmd =
      `cd ${this.escapeShellArg(workspacePath)} && export ${envVars.join(' ')} && ` +
      `echo "${messageB64}" | base64 -d | opencode run ${planFlag} --output json 2>&1 || true`;

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
      this.logger.error(`OpenCode session error: ${(error as Error).message}`);
      yield {
        type: 'chunk',
        data: { content: `Error running OpenCode: ${(error as Error).message}\n`, timestamp: Date.now() } as ResponseChunk,
      };
      yield { type: 'done', data: { timestamp: Date.now() } };
    }
  }

  async *streamResponse(
    workspacePath: string,
    userMessage: string,
    _sessionContext?: string,
  ): AsyncGenerator<ResponseChunk, void, unknown> {
    this.logger.log(`Streaming OpenCode response: ${workspacePath}`);

    const hasOpenCode = await this.checkOpenCodeInstalled();

    if (hasOpenCode) {
      const messageB64 = Buffer.from(userMessage).toString('base64');
      const envVars = this.buildEnvVars();
      const cmd =
        `cd ${this.escapeShellArg(workspacePath)} && export ${envVars.join(' ')} && ` +
        `echo "${messageB64}" | base64 -d | opencode run --output text 2>&1 || true`;

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
        `OpenCode CLI is not installed in this environment. ` +
        `To enable AI-powered coding, install opencode and configure the ` +
        `LLM provider via workspace settings.\n`;

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

  async executeCommand(
    workspacePath: string,
    command: string,
  ): Promise<{ output: string; error: string; exitCode: number }> {
    this.logger.log(`Executing command in workspace: ${workspacePath}`);

    try {
      const result = await execAsync(command, {
        cwd: workspacePath,
        shell: '/bin/bash',
        timeout: 120_000,
        env: { ...process.env },
      });
      return { output: result.stdout, error: result.stderr, exitCode: 0 };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      return {
        output: execError.stdout || '',
        error: execError.stderr || (error as Error).message,
        exitCode: execError.code || 1,
      };
    }
  }

  async startDevServer(
    workspacePath: string,
    command: string,
    port: number,
  ): Promise<{ url: string; port: number }> {
    this.logger.log(`Starting dev server: ${workspacePath} port ${port}`);

    exec(command, {
      cwd: workspacePath,
      shell: '/bin/bash',
      env: { ...process.env },
    });

    await this.sleep(2000);
    return { url: `http://localhost:${port}`, port };
  }

  async getWorkspaceInfo(workspacePath: string): Promise<{
    branch: string;
    fileCount: number;
    recentFiles: string[];
    gitStatus: string;
  }> {
    const escapedPath = this.escapeShellArg(workspacePath);

    const [branchResult, fileCountResult, recentResult, statusResult] = await Promise.all([
      execAsync(`cd ${escapedPath} && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"`, { shell: '/bin/bash' }),
      execAsync(`cd ${escapedPath} && find . -type f -not -path "./.git/*" | wc -l 2>/dev/null || echo "0"`, { shell: '/bin/bash' }),
      execAsync(`cd ${escapedPath} && find . -type f -not -path "./.git/*" -printf "%T@ %p\\n" 2>/dev/null | sort -rn | head -10 | awk '{print $2}' || echo ""`, { shell: '/bin/bash' }),
      execAsync(`cd ${escapedPath} && git status --short 2>/dev/null || echo ""`, { shell: '/bin/bash' }),
    ]);

    return {
      branch: branchResult.stdout.trim(),
      fileCount: parseInt(fileCountResult.stdout.trim(), 10) || 0,
      recentFiles: recentResult.stdout.split('\n').filter(Boolean),
      gitStatus: statusResult.stdout.trim(),
    };
  }

  async checkOpenCodeInstalled(): Promise<boolean> {
    try {
      await execAsync('which opencode', { shell: '/bin/bash' });
      return true;
    } catch {
      return false;
    }
  }

  async writeOpenCodeConfig(workspacePath: string, workspaceId: string): Promise<void> {
    try {
      const wsConfig = await this.configRepository.findOne({ where: { workspaceId } });
      if (!wsConfig) return;

      const opencodeConfig: Record<string, unknown> = {};

      const provider = wsConfig.llmProvider || this.configService.get<string>('opencode.llmProvider');
      const model = wsConfig.llmModel || this.configService.get<string>('opencode.llmModel');
      const apiKey = wsConfig.llmApiKey || this.configService.get<string>('opencode.llmApiKey');
      const baseUrl = wsConfig.llmBaseUrl || this.configService.get<string>('opencode.llmBaseUrl');

      if (provider) opencodeConfig['provider'] = provider;
      if (model) opencodeConfig['model'] = model;
      if (apiKey) opencodeConfig['apiKey'] = apiKey;
      if (baseUrl) opencodeConfig['baseUrl'] = baseUrl;

      if (wsConfig.skills && wsConfig.skills.length > 0) {
        opencodeConfig['skills'] = wsConfig.skills;
      }

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
        opencodeConfig['mcpServers'] = mcpServers;
      }

      const configPath = path.join(workspacePath, '.opencode.json');
      await fs.writeFile(configPath, JSON.stringify(opencodeConfig, null, 2), 'utf8');
      this.logger.log(`OpenCode config written: ${workspaceId}`);
    } catch (error) {
      this.logger.warn(`Failed to write opencode config: ${workspaceId}`, (error as Error).stack);
    }
  }

  async runSetupCommands(workspacePath: string, workspaceId: string): Promise<void> {
    const MAX_COMMANDS = 20;
    const MAX_CMD_LENGTH = 2048;

    try {
      const wsConfig = await this.configRepository.findOne({ where: { workspaceId } });
      if (!wsConfig?.setupCommands || wsConfig.setupCommands.length === 0) return;

      const commands = wsConfig.setupCommands.slice(0, MAX_COMMANDS);

      for (const cmd of commands) {
        if (!cmd || typeof cmd !== 'string' || cmd.trim().length === 0) continue;
        if (cmd.length > MAX_CMD_LENGTH) {
          this.logger.warn(`Setup command exceeds max length, skipping: ${workspaceId}`);
          continue;
        }

        this.logger.log(`Running setup command: ${workspaceId} - ${cmd}`);
        try {
          await execAsync(cmd, {
            cwd: workspacePath,
            shell: '/bin/bash',
            timeout: 60_000,
            env: { ...process.env },
          });
        } catch (error) {
          this.logger.warn(`Setup command failed (non-blocking): ${cmd}`, (error as Error).stack);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to run setup commands: ${workspaceId}`, (error as Error).stack);
    }
  }

  private buildEnvVars(workspaceId?: string): string[] {
    const vars: string[] = [];
    const llmProvider = this.configService.get<string>('opencode.llmProvider');
    const llmModel = this.configService.get<string>('opencode.llmModel');
    const llmApiKey = this.configService.get<string>('opencode.llmApiKey');
    const llmBaseUrl = this.configService.get<string>('opencode.llmBaseUrl');

    if (llmProvider) vars.push(`OPENCODE_PROVIDER=${this.escapeShellArg(llmProvider)}`);
    if (llmModel) vars.push(`OPENCODE_MODEL=${this.escapeShellArg(llmModel)}`);
    if (llmApiKey) vars.push(`OPENCODE_API_KEY=${this.escapeShellArg(llmApiKey)}`);
    if (llmBaseUrl) vars.push(`OPENCODE_BASE_URL=${this.escapeShellArg(llmBaseUrl)}`);
    if (workspaceId) vars.push(`WORKSPACE_ID=${this.escapeShellArg(workspaceId)}`);
    if (vars.length === 0) vars.push('OPENCODE_STUB=1');
    return vars;
  }

  private parseLine(line: string): OpenCodeStreamEvent | null {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;

      if (obj['type'] === 'tool_call') {
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
