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

  // Store the latest callbacks in refs so the effect's listeners never go stale.
  // This avoids the memory-leak problem of registering/unregistering listeners
  // every time a callback dependency changes.
  const handlersRef = useRef({
    addMessage,
    updateStreamingMessage,
    setTyping,
    setDevServer,
    setWorkspaceInfo,
  });
  handlersRef.current = {
    addMessage,
    updateStreamingMessage,
    setTyping,
    setDevServer,
    setWorkspaceInfo,
  };

  const planModeRef = useRef(planMode);
  planModeRef.current = planMode;

  // Stable connection effect that only re-runs when token or sessionId change
  useEffect(() => {
    if (!token || !sessionId) return;

    const socket = wsService.connect(token);

    const onConnect = () => {
      wsService.joinSession(sessionId);
    };

    const onChatResponse = (payload: ChatResponsePayload) => {
      if (!payload) return;
      const { addMessage: add, updateStreamingMessage: update, setTyping: typing } = handlersRef.current;

      if (payload.delta !== undefined) {
        if (!streamingIdRef.current) {
          const newMsg = add({
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
          update(streamingIdRef.current, updated, false);
        }
      }

      if (payload.done) {
        if (streamingIdRef.current) {
          update(
            streamingIdRef.current,
            useChatStore
              .getState()
              .messages.find((m) => m.id === streamingIdRef.current)?.content ?? '',
            true,
          );
          streamingIdRef.current = null;
        }
        typing(false);
      }

      if (payload.content && !payload.delta) {
        add({
          type: MessageType.CHAT_MESSAGE,
          content: payload.content,
          isUser: false,
          sessionId: payload.sessionId,
        });
        typing(false);
      }
    };

    const onExecutionOutput = (payload: ChatResponsePayload) => {
      if (payload?.content) {
        handlersRef.current.addMessage({
          type: MessageType.CODE_EXECUTION,
          content: payload.content,
          isUser: false,
        });
      }
    };

    const onToolCall = (payload: ToolCallData) => {
      handlersRef.current.addMessage({
        type: MessageType.TOOL_CALL,
        content: `Tool: ${payload.toolName}`,
        isUser: false,
        toolCall: payload,
      });
    };

    const onCodeChange = (payload: CodeChangeData) => {
      handlersRef.current.addMessage({
        type: MessageType.CODE_CHANGE,
        content: `${payload.changeType}: ${payload.filePath}`,
        isUser: false,
        codeChange: payload,
      });
    };

    const onPlanPending = (payload: PlanData) => {
      handlersRef.current.addMessage({
        type: MessageType.PLAN,
        content: 'Plan requires your confirmation',
        isUser: false,
        plan: payload,
      });
      handlersRef.current.setTyping(false);
    };

    const onDevServerStarted = (payload: DevServerData) => {
      handlersRef.current.setDevServer(payload);
      handlersRef.current.addMessage({
        type: MessageType.DEV_SERVER,
        content: `Dev server started at ${payload.url}`,
        isUser: false,
        devServer: payload,
      });
    };

    const onWorkspaceInfo = (payload: WorkspaceInfo) => {
      handlersRef.current.setWorkspaceInfo(payload);
    };

    const onError = (payload: ErrorPayload) => {
      handlersRef.current.addMessage({
        type: MessageType.ERROR,
        content: payload?.message ?? 'An unexpected error occurred.',
        isUser: false,
      });
      handlersRef.current.setTyping(false);
      streamingIdRef.current = null;
    };

    socket.on('connect', onConnect);

    if (wsService.isConnected) {
      wsService.joinSession(sessionId);
    }

    wsService.on('chat_response', onChatResponse as (...args: unknown[]) => void);
    wsService.on('message_chunk', onChatResponse as (...args: unknown[]) => void);
    wsService.on('message_complete', onChatResponse as (...args: unknown[]) => void);
    wsService.on('execution_output', onExecutionOutput as (...args: unknown[]) => void);
    wsService.on('tool_call', onToolCall as (...args: unknown[]) => void);
    wsService.on('code_change', onCodeChange as (...args: unknown[]) => void);
    wsService.on('plan_pending', onPlanPending as (...args: unknown[]) => void);
    wsService.on('dev_server_started', onDevServerStarted as (...args: unknown[]) => void);
    wsService.on('workspace_info', onWorkspaceInfo as (...args: unknown[]) => void);
    wsService.on('error', onError as (...args: unknown[]) => void);

    return () => {
      socket.off('connect', onConnect);
      wsService.off('chat_response', onChatResponse as (...args: unknown[]) => void);
      wsService.off('message_chunk', onChatResponse as (...args: unknown[]) => void);
      wsService.off('message_complete', onChatResponse as (...args: unknown[]) => void);
      wsService.off('execution_output', onExecutionOutput as (...args: unknown[]) => void);
      wsService.off('tool_call', onToolCall as (...args: unknown[]) => void);
      wsService.off('code_change', onCodeChange as (...args: unknown[]) => void);
      wsService.off('plan_pending', onPlanPending as (...args: unknown[]) => void);
      wsService.off('dev_server_started', onDevServerStarted as (...args: unknown[]) => void);
      wsService.off('workspace_info', onWorkspaceInfo as (...args: unknown[]) => void);
      wsService.off('error', onError as (...args: unknown[]) => void);
    };
  }, [token, sessionId]);

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
      wsService.sendChatMessage(sessionId, content, attachments, planModeRef.current);
    },
    [sessionId, addMessage, setTyping],
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
