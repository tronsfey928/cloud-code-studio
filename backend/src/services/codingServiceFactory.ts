import { OpenCodeConfig } from '../models/OpenCodeConfig';
import { openCodeService, OpenCodeStreamEvent } from './opencodeService';
import { claudeCodeService, ClaudeCodeStreamEvent } from './claudeCodeService';
import { ResponseChunk } from '../types';
import { logger } from '../utils/logger';

/** Supported coding tool providers. */
export type CodingProvider = 'opencode' | 'claude_code';

/** Union of stream event types from all providers. */
export type CodingStreamEvent = OpenCodeStreamEvent | ClaudeCodeStreamEvent;

/**
 * Factory that resolves the appropriate coding service based on the
 * workspace's configured coding provider. Defaults to OpenCode when
 * no explicit provider is set.
 */
export async function getCodingProvider(workspaceId: string): Promise<CodingProvider> {
  try {
    const wsConfig = await OpenCodeConfig.findOne({ where: { workspaceId } });
    if (wsConfig?.codingProvider) {
      return wsConfig.codingProvider as CodingProvider;
    }
  } catch (error) {
    logger.warn('Failed to read coding provider from config, defaulting to opencode', { workspaceId, error });
  }
  return 'opencode';
}

/**
 * Stream a coding session using the workspace's configured provider.
 */
export async function* streamCodingSession(
  workspacePath: string,
  userMessage: string,
  options: {
    planMode?: boolean;
    images?: string[];
    workspaceId?: string;
  } = {}
): AsyncGenerator<CodingStreamEvent, void, unknown> {
  const provider = options.workspaceId
    ? await getCodingProvider(options.workspaceId)
    : 'opencode';

  logger.info('Using coding provider', { provider, workspaceId: options.workspaceId });

  if (provider === 'claude_code') {
    yield* claudeCodeService.streamCodingSession(workspacePath, userMessage, options);
  } else {
    yield* openCodeService.streamCodingSession(workspacePath, userMessage, options);
  }
}

/**
 * Stream a simple response using the workspace's configured provider.
 */
export async function* streamResponse(
  workspacePath: string,
  userMessage: string,
  options: { workspaceId?: string; sessionContext?: string } = {}
): AsyncGenerator<ResponseChunk, void, unknown> {
  const provider = options.workspaceId
    ? await getCodingProvider(options.workspaceId)
    : 'opencode';

  if (provider === 'claude_code') {
    yield* claudeCodeService.streamResponse(workspacePath, userMessage, options.sessionContext);
  } else {
    yield* openCodeService.streamResponse(workspacePath, userMessage, options.sessionContext);
  }
}
