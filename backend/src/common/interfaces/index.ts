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

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface ResponseChunk {
  content: string;
  timestamp: number;
}

export interface FileAttachment {
  path: string;
  name: string;
  mimeType: string;
  data?: string;
}

export interface ToolCallEvent {
  id: string;
  toolName: string;
  input: string;
  output?: string;
  status: 'running' | 'completed' | 'error';
  timestamp: number;
}

export interface CodeChangeEvent {
  id: string;
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
  diff?: string;
  timestamp: number;
}

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

export interface McpServerConfig {
  name: string;
  url: string;
  enabled: boolean;
  transport?: 'sse' | 'stdio';
  command?: string;
  args?: string[];
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
