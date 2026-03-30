export enum MessageType {
  CHAT_MESSAGE = 'chat_message',
  CODE_EXECUTION = 'code_execution',
  FILE_OPERATION = 'file_operation',
  SYSTEM_STATUS = 'system_status',
  ERROR = 'error',
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Workspace {
  id: string;
  name: string;
  repositoryUrl: string;
  branch: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  createdAt: string;
  lastAccessedAt: string;
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  isStreaming?: boolean;
  isUser?: boolean;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  path: string;
  name: string;
  mimeType: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface ChatSession {
  id: string;
  workspaceId: string;
  messages: ChatMessage[];
}

export interface McpServer {
  name: string;
  url: string;
  enabled: boolean;
}

export interface OpenCodeConfig {
  id: string;
  workspaceId: string;
  llmProvider: string;
  llmModel: string | null;
  llmApiKey: string | null;
  llmBaseUrl: string | null;
  skills: string[];
  mcpServers: McpServer[];
}

export interface ApiError {
  message: string;
  status?: number;
}

export interface CreateWorkspacePayload {
  name: string;
  repositoryUrl?: string;
  branch?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
