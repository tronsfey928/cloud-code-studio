import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, DevServerData, WorkspaceInfo } from '@/types';
import { MessageType } from '@/types';

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  sessionId: string | null;
  planMode: boolean;
  devServer: DevServerData | null;
  workspaceInfo: WorkspaceInfo | null;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => ChatMessage;
  updateStreamingMessage: (id: string, content: string, done?: boolean) => void;
  setTyping: (typing: boolean) => void;
  setSessionId: (id: string) => void;
  clearMessages: () => void;
  clearSession: () => void;
  setPlanMode: (enabled: boolean) => void;
  setDevServer: (data: DevServerData | null) => void;
  setWorkspaceInfo: (info: WorkspaceInfo) => void;
}

export const useChatStore = create<ChatState>((set, _get) => ({
  messages: [],
  isTyping: false,
  sessionId: null,
  planMode: false,
  devServer: null,
  workspaceInfo: null,

  addMessage: (message) => {
    const newMessage: ChatMessage = {
      ...message,
      id: uuidv4(),
      timestamp: Date.now(),
      type: message.type ?? MessageType.CHAT_MESSAGE,
    };
    set((state) => ({ messages: [...state.messages, newMessage] }));
    return newMessage;
  },

  updateStreamingMessage: (id, content, done = false) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content, isStreaming: !done } : msg,
      ),
      isTyping: !done,
    }));
  },

  setTyping: (typing) => set({ isTyping: typing }),

  setSessionId: (id) => {
    set({ sessionId: id, messages: [] });
  },

  clearMessages: () => set({ messages: [] }),

  clearSession: () => set({ sessionId: null, messages: [], isTyping: false }),

  setPlanMode: (enabled) => set({ planMode: enabled }),

  setDevServer: (data) => set({ devServer: data }),

  setWorkspaceInfo: (info) => set({ workspaceInfo: info }),
}));
