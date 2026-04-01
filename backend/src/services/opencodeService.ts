import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { config } from '../config';
import { OpenCodeConfig, McpServerConfig } from '../models/OpenCodeConfig';
import {
  ResponseChunk,
  ToolCallEvent,
  CodeChangeEvent,
  PlanStep,
} from '../types';

const execAsync = promisify(exec);

export interface OpenCodeStreamEvent {
  type: 'chunk' | 'tool_call' | 'code_change' | 'plan' | 'dev_server' | 'done';
  data: unknown;
}

export class OpenCodeService {
  /**
   * Stream an OpenCode coding session. Executes opencode CLI directly on the
   * host inside the workspace directory and parses its JSON-line output so the
   * caller can forward structured events (tool calls, code changes, plan
   * steps, etc.) over WebSocket.
   */
  async *streamCodingSession(
    workspacePath: string,
    userMessage: string,
    options: {
      planMode?: boolean;
      images?: string[];
      workspaceId?: string;
    } = {}
  ): AsyncGenerator<OpenCodeStreamEvent, void, unknown> {
    logger.info('Starting OpenCode coding session', { workspacePath, planMode: options.planMode });

    // Write workspace-specific opencode config (including MCP servers)
    if (options.workspaceId) {
      await this.writeOpenCodeConfig(workspacePath, options.workspaceId);
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
        if (event) {
          yield event;
        }
      }

      yield { type: 'done', data: { timestamp: Date.now() } };
    } catch (error) {
      logger.error('OpenCode session error', { workspacePath, error });
      yield {
        type: 'chunk',
        data: {
          content: `Error running OpenCode: ${(error as Error).message}\n`,
          timestamp: Date.now(),
        } as ResponseChunk,
      };
      yield { type: 'done', data: { timestamp: Date.now() } };
    }
  }

  /**
   * Fallback streaming that works without an opencode binary.
   * Echoes the user message back to prove the pipeline works end-to-end.
   */
  async *streamResponse(
    workspacePath: string,
    userMessage: string,
    _sessionContext?: string
  ): AsyncGenerator<ResponseChunk, void, unknown> {
    logger.info('Streaming OpenCode response', { workspacePath });

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
      if (buffer) {
        yield { content: buffer, timestamp: Date.now() };
      }
    }
  }

  async executeCommand(
    workspacePath: string,
    command: string
  ): Promise<{ output: string; error: string; exitCode: number }> {
    logger.info('Executing command in workspace', { workspacePath, command });

    try {
      const result = await execAsync(command, {
        cwd: workspacePath,
        shell: '/bin/bash',
        timeout: 120_000,
        env: { ...process.env },
      });

      return {
        output: result.stdout,
        error: result.stderr,
        exitCode: 0,
      };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      logger.error('Command execution failed', { workspacePath, command, error });
      return {
        output: execError.stdout || '',
        error: execError.stderr || (error as Error).message,
        exitCode: execError.code || 1,
      };
    }
  }

  /** Start a dev server in the workspace directory and return the URL. */
  async startDevServer(
    workspacePath: string,
    command: string,
    port: number
  ): Promise<{ url: string; port: number }> {
    logger.info('Starting dev server', { workspacePath, command, port });

    // Start the dev server in background, constrained to the workspace directory via cwd
    exec(command, {
      cwd: workspacePath,
      shell: '/bin/bash',
      env: { ...process.env },
    });

    // Give it a moment to start
    await this.sleep(2000);

    return {
      url: `http://localhost:${port}`,
      port,
    };
  }

  /** Get the git status summary of the workspace */
  async getWorkspaceInfo(workspacePath: string): Promise<{
    branch: string;
    fileCount: number;
    recentFiles: string[];
    gitStatus: string;
  }> {
    const escapedPath = this.escapeShellArg(workspacePath);

    const [branchResult, fileCountResult, recentResult, statusResult] = await Promise.all([
      execAsync(
        `cd ${escapedPath} && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"`,
        { shell: '/bin/bash' }
      ),
      execAsync(
        `cd ${escapedPath} && find . -type f -not -path "./.git/*" | wc -l 2>/dev/null || echo "0"`,
        { shell: '/bin/bash' }
      ),
      execAsync(
        `cd ${escapedPath} && find . -type f -not -path "./.git/*" -printf "%T@ %p\\n" 2>/dev/null | sort -rn | head -10 | awk '{print $2}' || echo ""`,
        { shell: '/bin/bash' }
      ),
      execAsync(
        `cd ${escapedPath} && git status --short 2>/dev/null || echo ""`,
        { shell: '/bin/bash' }
      ),
    ]);

    return {
      branch: branchResult.stdout.trim(),
      fileCount: parseInt(fileCountResult.stdout.trim(), 10) || 0,
      recentFiles: recentResult.stdout.split('\n').filter(Boolean),
      gitStatus: statusResult.stdout.trim(),
    };
  }

  /** Check whether the opencode CLI binary is available */
  async checkOpenCodeInstalled(): Promise<boolean> {
    try {
      await execAsync('which opencode', { shell: '/bin/bash' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write an opencode configuration file to the workspace directory.
   * This includes per-workspace LLM settings and MCP server definitions,
   * allowing opencode to discover and use registered MCP servers.
   */
  async writeOpenCodeConfig(workspacePath: string, workspaceId: string): Promise<void> {
    try {
      const wsConfig = await OpenCodeConfig.findOne({ where: { workspaceId } });
      if (!wsConfig) return;

      const opencodeConfig: Record<string, unknown> = {};

      // LLM provider configuration (per-workspace overrides global)
      const provider = wsConfig.llmProvider || config.opencode.llmProvider;
      const model = wsConfig.llmModel || config.opencode.llmModel;
      const apiKey = wsConfig.llmApiKey || config.opencode.llmApiKey;
      const baseUrl = wsConfig.llmBaseUrl || config.opencode.llmBaseUrl;

      if (provider) opencodeConfig.provider = provider;
      if (model) opencodeConfig.model = model;
      if (apiKey) opencodeConfig.apiKey = apiKey;
      if (baseUrl) opencodeConfig.baseUrl = baseUrl;

      // Skills
      if (wsConfig.skills && wsConfig.skills.length > 0) {
        opencodeConfig.skills = wsConfig.skills;
      }

      // MCP servers — support both sse (url-based) and stdio (command-based) transports
      const enabledServers = (wsConfig.mcpServers || []).filter(
        (s: McpServerConfig) => s.enabled && s.name
      );

      if (enabledServers.length > 0) {
        const mcpServers: Record<string, Record<string, unknown>> = {};
        for (const server of enabledServers) {
          if (server.command) {
            // stdio transport
            mcpServers[server.name] = {
              command: server.command,
              args: server.args || [],
            };
          } else if (server.url) {
            // sse / streamable-http transport
            mcpServers[server.name] = { url: server.url };
          }
        }
        opencodeConfig.mcpServers = mcpServers;
      }

      // Write to .opencode.json in the workspace root
      const configPath = path.join(workspacePath, '.opencode.json');
      await fs.writeFile(configPath, JSON.stringify(opencodeConfig, null, 2), 'utf8');
      logger.info('OpenCode config written', { workspaceId, configPath, mcpCount: enabledServers.length });
    } catch (error) {
      logger.warn('Failed to write opencode config', { workspaceId, error });
    }
  }

  private buildEnvVars(workspaceId?: string): string[] {
    const vars: string[] = [];
    if (config.opencode.llmProvider) {
      vars.push(`OPENCODE_PROVIDER="${config.opencode.llmProvider}"`);
    }
    if (config.opencode.llmModel) {
      vars.push(`OPENCODE_MODEL="${config.opencode.llmModel}"`);
    }
    if (config.opencode.llmApiKey) {
      vars.push(`OPENCODE_API_KEY="${config.opencode.llmApiKey}"`);
    }
    if (config.opencode.llmBaseUrl) {
      vars.push(`OPENCODE_BASE_URL="${config.opencode.llmBaseUrl}"`);
    }
    if (workspaceId) {
      vars.push(`WORKSPACE_ID="${workspaceId}"`);
    }
    // Always need at least one valid export
    if (vars.length === 0) {
      vars.push('OPENCODE_STUB=1');
    }
    return vars;
  }

  private parseLine(line: string): OpenCodeStreamEvent | null {
    // Try JSON parse for structured opencode output
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;

      if (obj.type === 'tool_call') {
        return {
          type: 'tool_call',
          data: {
            id: (obj.id as string) || uuidv4(),
            toolName: obj.tool_name || obj.name || 'unknown',
            input: typeof obj.input === 'string' ? obj.input : JSON.stringify(obj.input),
            output: obj.output as string | undefined,
            status: obj.status || 'completed',
            timestamp: Date.now(),
          } as ToolCallEvent,
        };
      }

      if (obj.type === 'file_change' || obj.type === 'code_change') {
        return {
          type: 'code_change',
          data: {
            id: (obj.id as string) || uuidv4(),
            filePath: obj.file_path || obj.path || 'unknown',
            changeType: obj.change_type || 'modified',
            diff: obj.diff as string | undefined,
            timestamp: Date.now(),
          } as CodeChangeEvent,
        };
      }

      if (obj.type === 'plan') {
        const steps = Array.isArray(obj.steps)
          ? (obj.steps as Array<{ description: string }>).map(
              (s, i): PlanStep => ({
                index: i + 1,
                description: s.description || String(s),
                status: 'pending',
              })
            )
          : [];
        return {
          type: 'plan',
          data: { id: uuidv4(), steps, status: 'pending', timestamp: Date.now() },
        };
      }

      if (obj.type === 'dev_server') {
        return {
          type: 'dev_server',
          data: {
            url: obj.url,
            port: obj.port,
            status: obj.status || 'running',
            timestamp: Date.now(),
          },
        };
      }

      // Default: treat as text chunk
      if (obj.content || obj.text) {
        return {
          type: 'chunk',
          data: {
            content: (obj.content || obj.text) as string,
            timestamp: Date.now(),
          } as ResponseChunk,
        };
      }

      return null;
    } catch {
      // Not JSON — treat as plain text chunk
      if (line.trim()) {
        return {
          type: 'chunk',
          data: { content: line + '\n', timestamp: Date.now() } as ResponseChunk,
        };
      }
      return null;
    }
  }

  private escapeShellArg(value: string): string {
    // Proper single-quote escaping: wrap in single quotes and escape any
    // embedded single quotes using the '\'' idiom.
    return "'" + value.replace(/'/g, "'\\''") + "'";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const openCodeService = new OpenCodeService();
