import React from 'react';
import { Badge, Tooltip } from 'antd';
import { WifiOutlined, DisconnectOutlined } from '@ant-design/icons';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { FileAttachment } from '@/types';

interface ChatProps {
  sessionId: string | null;
}

const Chat: React.FC<ChatProps> = ({ sessionId }) => {
  const { messages, isTyping } = useChatStore();
  const { sendMessage, isConnected } = useWebSocket(sessionId);

  const handleSend = (content: string, attachments?: FileAttachment[]) => {
    sendMessage(content, attachments);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700">AI Assistant</span>
          {sessionId && (
            <span className="text-xs text-gray-400 font-mono truncate max-w-[160px]">
              #{sessionId.slice(-8)}
            </span>
          )}
        </div>
        <Tooltip title={isConnected ? 'Connected' : 'Disconnected'}>
          <Badge
            status={isConnected ? 'success' : 'error'}
            text={
              <span className="text-xs text-gray-500 flex items-center gap-1">
                {isConnected ? (
                  <WifiOutlined className="text-green-500" />
                ) : (
                  <DisconnectOutlined className="text-red-400" />
                )}
                {isConnected ? 'Live' : 'Offline'}
              </span>
            }
          />
        </Tooltip>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} />
      </div>

      {/* Typing indicator */}
      {isTyping && <TypingIndicator />}

      {/* Input */}
      <MessageInput onSend={handleSend} disabled={!isConnected || !sessionId} />
    </div>
  );
};

export default Chat;
