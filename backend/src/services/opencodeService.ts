import { v4 as uuidv4 } from 'uuid';
import { containerManager } from './containerService';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  ResponseChunk,
  ToolCallEvent,
  CodeChangeEvent,
  PlanStep,
} from '../types';

export interface OpenCodeStreamEvent {
  type: 'chunk' | 'tool_call' | 'code_change' | 'plan' | 'dev_server' | 'done';
  data: unknown;
}

export class OpenCodeService {
  /**
   * Stream an OpenCode coding session. Executes opencode CLI inside the
   * container and parses its JSON-line output so the caller can forward
   * structured events (tool calls, code changes, plan steps, etc.) over
   * WebSocket.
   */
  async *streamCodingSession(
    containerId: string,
    userMessage: string,
    options: {
      planMode?: boolean;
      images?: string[];
      workspaceId?: string;
    } = {}
  ): AsyncGenerator<OpenCodeStreamEvent, void, unknown> {
    logger.info('Starting OpenCode coding session', { containerId, planMode: options.planMode });

    const envVars = this.buildEnvVars(options.workspaceId);
    const planFlag = options.planMode ? '--plan' : '';
    const messageB64 = Buffer.from(userMessage).toString('base64');

    // Build the opencode invocation command.
    // We pipe the message via stdin using base64 to avoid shell injection.
    const cmd = [
      '/bin/bash',
      '-c',
      `cd /workspace && export ${envVars.join(' ')} && ` +
        `echo "${messageB64}" | base64 -d | opencode run ${planFlag} --output json 2>&1 || true`,
    ];

    try {
      const result = await containerManager.exec(containerId, cmd);
      const lines = result.stdout.split('\n').filter(Boolean);

      for (const line of lines) {
        const event = this.parseLine(line);
        if (event) {
          yield event;
        }
      }

      yield { type: 'done', data: { timestamp: Date.now() } };
    } catch (error) {
      logger.error('OpenCode session error', { containerId, error });
      // Yield error as text so the user sees what happened
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
    containerId: string,
    userMessage: string,
    _sessionContext?: string
  ): AsyncGenerator<ResponseChunk, void, unknown> {
    logger.info('Streaming OpenCode response', { containerId });

    // Try opencode first; fall back to echo if binary not found
    const checkResult = await containerManager.exec(containerId, [
      '/bin/bash',
      '-c',
      'which opencode 2>/dev/null && echo FOUND || echo NOTFOUND',
    ]);

    const hasOpenCode = checkResult.stdout.trim().endsWith('FOUND');

    if (hasOpenCode) {
      const messageB64 = Buffer.from(userMessage).toString('base64');
      const envVars = this.buildEnvVars();
      const result = await containerManager.exec(containerId, [
        '/bin/bash',
        '-c',
        `cd /workspace && export ${envVars.join(' ')} && ` +
          `echo "${messageB64}" | base64 -d | opencode run --output text 2>&1 || true`,
      ]);

      const lines = result.stdout.split('\n').filter(Boolean);
      for (const line of lines) {
        yield { content: line + '\n', timestamp: Date.now() };
        await this.sleep(30);
      }
    } else {
      // Fallback: describe what would happen
      const response =
        `I received your message: "${userMessage}"\n\n` +
        `OpenCode CLI is not installed in this container. ` +
        `To enable AI-powered coding, install opencode in the sandbox image ` +
        `and configure the LLM provider via workspace settings.\n`;

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
    containerId: string,
    command: string
  ): Promise<{ output: string; error: string; exitCode: number }> {
    logger.info('Executing command in container', { containerId, command });

    try {
      const result = await containerManager.exec(containerId, [
        '/bin/bash',
        '-c',
        command,
      ]);

      return {
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      logger.error('Command execution failed', { containerId, command, error });
      throw error;
    }
  }

  /** Start a dev server inside the container and return the forwarded URL. */
  async startDevServer(
    containerId: string,
    command: string,
    port: number
  ): Promise<{ url: string; port: number }> {
    logger.info('Starting dev server', { containerId, command, port });

    // Start the dev server in background
    await containerManager.exec(containerId, [
      '/bin/bash',
      '-c',
      `cd /workspace && nohup ${command} > /tmp/devserver.log 2>&1 &`,
    ]);

    // Give it a moment to start
    await this.sleep(2000);

    return {
      url: `http://localhost:${port}`,
      port,
    };
  }

  /** Get the git status summary of the workspace */
  async getWorkspaceInfo(containerId: string): Promise<{
    branch: string;
    fileCount: number;
    recentFiles: string[];
    gitStatus: string;
  }> {
    const branchResult = await containerManager.exec(containerId, [
      '/bin/bash',
      '-c',
      'cd /workspace && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"',
    ]);

    const fileCountResult = await containerManager.exec(containerId, [
      '/bin/bash',
      '-c',
      'cd /workspace && find . -type f -not -path "./.git/*" | wc -l 2>/dev/null || echo "0"',
    ]);

    const recentResult = await containerManager.exec(containerId, [
      '/bin/bash',
      '-c',
      'cd /workspace && find . -type f -not -path "./.git/*" -printf "%T@ %p\\n" 2>/dev/null | sort -rn | head -10 | awk "{print \\$2}" || echo ""',
    ]);

    const statusResult = await containerManager.exec(containerId, [
      '/bin/bash',
      '-c',
      'cd /workspace && git status --short 2>/dev/null || echo ""',
    ]);

    return {
      branch: branchResult.stdout.trim(),
      fileCount: parseInt(fileCountResult.stdout.trim(), 10) || 0,
      recentFiles: recentResult.stdout.split('\n').filter(Boolean),
      gitStatus: statusResult.stdout.trim(),
    };
  }

  /** Clone the git repository inside a running container */
  async cloneRepository(
    containerId: string,
    repositoryUrl: string,
    branch: string
  ): Promise<void> {
    logger.info('Cloning repository in container', { containerId, repositoryUrl, branch });

    // Install git if not present and clone
    const cloneCmd = [
      '/bin/bash',
      '-c',
      [
        'apt-get update -qq && apt-get install -y -qq git > /dev/null 2>&1 || true',
        `git clone --branch ${this.sanitize(branch)} --single-branch --depth 1 ${this.sanitize(repositoryUrl)} /workspace 2>&1 || ` +
          `git clone --depth 1 ${this.sanitize(repositoryUrl)} /workspace 2>&1`,
      ].join(' && '),
    ];

    const result = await containerManager.exec(containerId, cloneCmd);
    if (result.exitCode !== 0 && !result.stdout.includes('already exists')) {
      logger.error('Git clone failed in container', {
        containerId,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      throw new Error(`Git clone failed: ${result.stderr || result.stdout}`);
    }

    logger.info('Repository cloned in container', { containerId });
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

  private sanitize(value: string): string {
    // Allow characters valid in git URLs and branch names (including /)
    // Remove only shell-dangerous metacharacters
    return value.replace(/[;&|`$(){}[\]\\'"!]/g, '');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const openCodeService = new OpenCodeService();
