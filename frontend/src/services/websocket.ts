import { io, Socket } from 'socket.io-client';

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

    this.socket.on('connect', () => {
      console.info('[WS] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.info('[WS] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err.message);
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

  sendChatMessage(sessionId: string, content: string, attachments?: unknown[]): void {
    this.socket?.emit('chat_message', { sessionId, content, attachments });
  }

  sendCodeExecution(sessionId: string, code: string, language: string): void {
    this.socket?.emit('code_execution', { sessionId, code, language });
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
