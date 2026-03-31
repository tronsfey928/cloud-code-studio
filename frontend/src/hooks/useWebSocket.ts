import { useEffect, useRef, useCallback } from 'react';
import wsService from '@/services/websocket';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import type {
  ToolCallData,
  CodeChangeData,
  PlanData,
  DevServerData,
  WorkspaceInfo,
  FileAttachment,
} from '@/types';
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
  const {
    addMessage,
    updateStreamingMessage,
    setTyping,
    setDevServer,
    setWorkspaceInfo,
    planMode,
  } = useChatStore();
  const streamingIdRef = useRef<string | null>(null);

  const handleChatResponse = useCallback(
    (payload: ChatResponsePayload) => {
      if (!payload) return;

      if (payload.delta !== undefined) {
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

  const handleToolCall = useCallback(
    (payload: ToolCallData) => {
      addMessage({
        type: MessageType.TOOL_CALL,
        content: `Tool: ${payload.toolName}`,
        isUser: false,
        toolCall: payload,
      });
    },
    [addMessage],
  );

  const handleCodeChange = useCallback(
    (payload: CodeChangeData) => {
      addMessage({
        type: MessageType.CODE_CHANGE,
        content: `${payload.changeType}: ${payload.filePath}`,
        isUser: false,
        codeChange: payload,
      });
    },
    [addMessage],
  );

  const handlePlanPending = useCallback(
    (payload: PlanData) => {
      addMessage({
        type: MessageType.PLAN,
        content: 'Plan requires your confirmation',
        isUser: false,
        plan: payload,
      });
      setTyping(false);
    },
    [addMessage, setTyping],
  );

  const handleDevServerStarted = useCallback(
    (payload: DevServerData) => {
      setDevServer(payload);
      addMessage({
        type: MessageType.DEV_SERVER,
        content: `Dev server started at ${payload.url}`,
        isUser: false,
        devServer: payload,
      });
    },
    [addMessage, setDevServer],
  );

  const handleWorkspaceInfo = useCallback(
    (payload: WorkspaceInfo) => {
      setWorkspaceInfo(payload);
    },
    [setWorkspaceInfo],
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
    wsService.on('message_chunk', handleChatResponse as (...args: unknown[]) => void);
    wsService.on('message_complete', handleChatResponse as (...args: unknown[]) => void);
    wsService.on('execution_output', handleExecutionOutput as (...args: unknown[]) => void);
    wsService.on('tool_call', handleToolCall as (...args: unknown[]) => void);
    wsService.on('code_change', handleCodeChange as (...args: unknown[]) => void);
    wsService.on('plan_pending', handlePlanPending as (...args: unknown[]) => void);
    wsService.on('dev_server_started', handleDevServerStarted as (...args: unknown[]) => void);
    wsService.on('workspace_info', handleWorkspaceInfo as (...args: unknown[]) => void);
    wsService.on('error', handleError as (...args: unknown[]) => void);

    return () => {
      wsService.off('chat_response', handleChatResponse as (...args: unknown[]) => void);
      wsService.off('message_chunk', handleChatResponse as (...args: unknown[]) => void);
      wsService.off('message_complete', handleChatResponse as (...args: unknown[]) => void);
      wsService.off('execution_output', handleExecutionOutput as (...args: unknown[]) => void);
      wsService.off('tool_call', handleToolCall as (...args: unknown[]) => void);
      wsService.off('code_change', handleCodeChange as (...args: unknown[]) => void);
      wsService.off('plan_pending', handlePlanPending as (...args: unknown[]) => void);
      wsService.off('dev_server_started', handleDevServerStarted as (...args: unknown[]) => void);
      wsService.off('workspace_info', handleWorkspaceInfo as (...args: unknown[]) => void);
      wsService.off('error', handleError as (...args: unknown[]) => void);
    };
  }, [
    token,
    sessionId,
    handleChatResponse,
    handleExecutionOutput,
    handleToolCall,
    handleCodeChange,
    handlePlanPending,
    handleDevServerStarted,
    handleWorkspaceInfo,
    handleError,
  ]);

  const sendMessage = useCallback(
    (content: string, attachments?: FileAttachment[]) => {
      if (!sessionId) return;
      setTyping(true);
      addMessage({
        type: MessageType.CHAT_MESSAGE,
        content,
        isUser: true,
        sessionId,
        attachments,
      });
      wsService.sendChatMessage(sessionId, content, attachments, planMode);
    },
    [sessionId, addMessage, setTyping, planMode],
  );

  const confirmPlan = useCallback(
    (planId: string, confirmed: boolean) => {
      if (!sessionId) return;
      wsService.confirmPlan(sessionId, planId, confirmed);
    },
    [sessionId],
  );

  return { sendMessage, confirmPlan, isConnected: wsService.isConnected };
}
