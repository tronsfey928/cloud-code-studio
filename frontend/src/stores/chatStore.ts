import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@/types';
import { MessageType } from '@/types';

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  sessionId: string | null;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => ChatMessage;
  updateStreamingMessage: (id: string, content: string, done?: boolean) => void;
  setTyping: (typing: boolean) => void;
  setSessionId: (id: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,
  sessionId: null,

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
        msg.id === id
          ? { ...msg, content, isStreaming: !done }
          : msg,
      ),
      isTyping: !done,
    }));
  },

  setTyping: (typing) => set({ isTyping: typing }),

  setSessionId: (id) => {
    const prev = get().sessionId;
    if (prev !== id) {
      set({ sessionId: id, messages: [] });
    }
  },

  clearMessages: () => set({ messages: [] }),
}));
