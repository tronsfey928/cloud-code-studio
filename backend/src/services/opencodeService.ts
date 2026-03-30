import { containerManager } from './containerService';
import { logger } from '../utils/logger';
import { ResponseChunk } from '../types';

export class OpenCodeService {
  async *streamResponse(
    containerId: string,
    userMessage: string,
    sessionContext?: string
  ): AsyncGenerator<ResponseChunk, void, unknown> {
    logger.info('Streaming OpenCode response', { containerId });

    const contextCmd = sessionContext
      ? `echo ${JSON.stringify(sessionContext)} | `
      : '';

    const command = [
      '/bin/bash',
      '-c',
      `${contextCmd}echo ${JSON.stringify(userMessage)}`,
    ];

    try {
      const result = await containerManager.exec(containerId, command);
      const lines = result.stdout.split('\n').filter(Boolean);

      for (const line of lines) {
        yield {
          content: line + '\n',
          timestamp: Date.now(),
        };
        await this.sleep(50);
      }

      if (result.stderr) {
        yield {
          content: `[stderr]: ${result.stderr}`,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      logger.error('OpenCode stream error', { containerId, error });
      throw error;
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const openCodeService = new OpenCodeService();
