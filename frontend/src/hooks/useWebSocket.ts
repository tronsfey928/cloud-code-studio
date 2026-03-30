import { useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import wsService from '@/services/websocket';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { MessageType } from '@/types';

interface ChatResponsePayload {
  sessionId?: string;
  content?: string;
  delta?: string;
  done?: boolean;
  messageId?: string;
}

interface ErrorPayload {
  message?: string;
}

export function useWebSocket(sessionId: string | null) {
  const token = useAuthStore((s) => s.token);
  const { addMessage, updateStreamingMessage, setTyping } = useChatStore();
  const streamingIdRef = useRef<string | null>(null);

  const handleChatResponse = useCallback(
    (payload: ChatResponsePayload) => {
      if (!payload) return;

      if (payload.delta !== undefined) {
        // Streaming chunk
        if (!streamingIdRef.current) {
          const newMsg = addMessage({
            type: MessageType.CHAT_MESSAGE,
            content: payload.delta,
            isStreaming: true,
            isUser: false,
            sessionId: payload.sessionId,
          });
          streamingIdRef.current = newMsg.id;
        } else {
          const current = useChatStore
            .getState()
            .messages.find((m) => m.id === streamingIdRef.current);
          const updated = (current?.content ?? '') + payload.delta;
          updateStreamingMessage(streamingIdRef.current, updated, false);
        }
      }

      if (payload.done) {
        if (streamingIdRef.current) {
          updateStreamingMessage(
            streamingIdRef.current,
            useChatStore
              .getState()
              .messages.find((m) => m.id === streamingIdRef.current)?.content ?? '',
            true,
          );
          streamingIdRef.current = null;
        }
        setTyping(false);
      }

      if (payload.content && !payload.delta) {
        addMessage({
          type: MessageType.CHAT_MESSAGE,
          content: payload.content,
          isUser: false,
          sessionId: payload.sessionId,
        });
        setTyping(false);
      }
    },
    [addMessage, updateStreamingMessage, setTyping],
  );

  const handleExecutionOutput = useCallback(
    (payload: ChatResponsePayload) => {
      if (payload?.content) {
        addMessage({
          type: MessageType.CODE_EXECUTION,
          content: payload.content,
          isUser: false,
        });
      }
    },
    [addMessage],
  );

  const handleError = useCallback(
    (payload: ErrorPayload) => {
      addMessage({
        type: MessageType.ERROR,
        content: payload?.message ?? 'An unexpected error occurred.',
        isUser: false,
      });
      setTyping(false);
      streamingIdRef.current = null;
    },
    [addMessage, setTyping],
  );

  useEffect(() => {
    if (!token || !sessionId) return;

    const socket = wsService.connect(token);

    socket.on('connect', () => {
      wsService.joinSession(sessionId);
    });

    if (wsService.isConnected) {
      wsService.joinSession(sessionId);
    }

    wsService.on('chat_response', handleChatResponse as (...args: unknown[]) => void);
    wsService.on('execution_output', handleExecutionOutput as (...args: unknown[]) => void);
    wsService.on('error', handleError as (...args: unknown[]) => void);

    return () => {
      wsService.off('chat_response', handleChatResponse as (...args: unknown[]) => void);
      wsService.off('execution_output', handleExecutionOutput as (...args: unknown[]) => void);
      wsService.off('error', handleError as (...args: unknown[]) => void);
    };
  }, [token, sessionId, handleChatResponse, handleExecutionOutput, handleError]);

  const sendMessage = useCallback(
    (content: string, attachments?: unknown[]) => {
      if (!sessionId) return;
      setTyping(true);
      const id = uuidv4();
      addMessage({
        type: MessageType.CHAT_MESSAGE,
        content,
        isUser: true,
        sessionId,
        id,
      } as Parameters<typeof addMessage>[0]);
      wsService.sendChatMessage(sessionId, content, attachments);
    },
    [sessionId, addMessage, setTyping],
  );

  return { sendMessage, isConnected: wsService.isConnected };
}
