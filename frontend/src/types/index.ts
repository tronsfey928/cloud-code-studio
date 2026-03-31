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
  status: 'creating' | 'ready' | 'error';
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
  /** For TOOL_CALL messages */
  toolCall?: ToolCallData;
  /** For CODE_CHANGE messages */
  codeChange?: CodeChangeData;
  /** For PLAN messages */
  plan?: PlanData;
  /** For DEV_SERVER messages */
  devServer?: DevServerData;
}

export interface FileAttachment {
  path: string;
  name: string;
  mimeType: string;
  /** Base64-encoded data for image preview */
  data?: string;
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

// ─── Structured event data ───────────────────────────────────────

export interface ToolCallData {
  id: string;
  toolName: string;
  input: string;
  output?: string;
  status: 'running' | 'completed' | 'error';
  timestamp: number;
}

export interface CodeChangeData {
  id: string;
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
  diff?: string;
  timestamp: number;
}

export interface PlanData {
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

export interface DevServerData {
  url: string;
  port: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  timestamp: number;
}

export interface WorkspaceInfo {
  workspaceId: string;
  branch: string;
  fileCount: number;
  recentFiles: string[];
  gitStatus: string;
  timestamp: number;
}
