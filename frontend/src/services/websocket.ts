import { io, Socket } from 'socket.io-client';
import type { FileAttachment } from '@/types';

type EventCallback = (...args: unknown[]) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private readonly url: string;

  constructor() {
    this.url = import.meta.env.VITE_WS_URL ?? 'http://localhost:5000';
  }

  connect(token: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(this.url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinSession(sessionId: string): void {
    this.socket?.emit('join_session', { sessionId });
  }

  sendChatMessage(
    sessionId: string,
    content: string,
    attachments?: FileAttachment[],
    planMode?: boolean,
  ): void {
    this.socket?.emit('chat_message', { sessionId, content, attachments, planMode });
  }

  sendCodeExecution(sessionId: string, code: string, language: string): void {
    this.socket?.emit('code_execution', { sessionId, code, language });
  }

  confirmPlan(sessionId: string, planId: string, confirmed: boolean): void {
    this.socket?.emit('plan_confirm', { sessionId, planId, confirmed });
  }

  startDevServer(
    sessionId: string,
    workspaceId: string,
    command: string,
    port: number,
  ): void {
    this.socket?.emit('start_dev_server', { sessionId, workspaceId, command, port });
  }

  on(event: string, callback: EventCallback): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: EventCallback): void {
    this.socket?.off(event, callback);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

const wsService = new WebSocketService();
export default wsService;
