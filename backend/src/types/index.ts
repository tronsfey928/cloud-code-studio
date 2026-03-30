import { Request } from 'express';

export enum MessageType {
  CHAT_MESSAGE = 'chat_message',
  CODE_EXECUTION = 'code_execution',
  FILE_OPERATION = 'file_operation',
  SYSTEM_STATUS = 'system_status',
  ERROR = 'error',
}

export interface ContainerConfig {
  id: string;
  repositoryUrl: string;
  branch: string;
  userId: string;
  resources: {
    cpu: string;
    memory: string;
    storage: string;
  };
  timeout: number;
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
}

export interface OpenCodeResponse {
  stream: AsyncGenerator<ResponseChunk, void, unknown>;
  final: ResponseChunk;
}

export interface ResponseChunk {
  content: string;
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

export interface ContainerStatus {
  id: string;
  status: string;
  running: boolean;
  startedAt?: string;
  finishedAt?: string;
}
