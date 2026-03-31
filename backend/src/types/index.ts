import { Request } from 'express';

export enum MessageType {
  CHAT_MESSAGE = 'chat_message',
  CODE_EXECUTION = 'code_execution',
  FILE_OPERATION = 'file_operation',
  SYSTEM_STATUS = 'system_status',
  TOOL_CALL = 'tool_call',
  CODE_CHANGE = 'code_change',
  PLAN = 'plan',
  DEV_SERVER = 'dev_server',
  ERROR = 'error',
}

export interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: number;
  userId: string;
  sessionId: string;
}

export interface ChatMessage extends BaseMessage {
  type: MessageType.CHAT_MESSAGE;
  content: string;
  attachments?: FileAttachment[];
  isStreaming?: boolean;
}

export interface FileAttachment {
  path: string;
  name: string;
  mimeType: string;
  /** Base64-encoded data for image attachments */
  data?: string;
}

export interface OpenCodeResponse {
  stream: AsyncGenerator<ResponseChunk, void, unknown>;
  final: ResponseChunk;
}

export interface ResponseChunk {
  content: string;
  timestamp: number;
}

/** Emitted when OpenCode invokes a tool (e.g. file_write, bash, grep) */
export interface ToolCallEvent {
  id: string;
  toolName: string;
  input: string;
  output?: string;
  status: 'running' | 'completed' | 'error';
  timestamp: number;
}

/** Emitted when a file is created or modified during coding */
export interface CodeChangeEvent {
  id: string;
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
  diff?: string;
  timestamp: number;
}

/** Emitted when OpenCode generates a plan for confirmation */
export interface PlanEvent {
  id: string;
  steps: PlanStep[];
  status: 'pending' | 'confirmed' | 'rejected';
  timestamp: number;
}

export interface PlanStep {
  index: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

/** Emitted when a dev server is started for live preview */
export interface DevServerEvent {
  url: string;
  port: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  timestamp: number;
}

export interface FileUploadResult {
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
