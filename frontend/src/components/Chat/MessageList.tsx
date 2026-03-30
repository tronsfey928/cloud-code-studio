import React, { useEffect, useRef } from 'react';
import { Avatar, Tag } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import type { ChatMessage } from '@/types';
import { MessageType } from '@/types';
import StreamingMessage from './StreamingMessage';
import { formatTimestamp } from '@/utils/helpers';

interface MessageListProps {
  messages: ChatMessage[];
}

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.isUser;
  const isError = message.type === MessageType.ERROR;
  const isCode = message.type === MessageType.CODE_EXECUTION;

  return (
    <div
      className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        className={isUser ? 'bg-blue-500 shrink-0' : 'bg-green-600 shrink-0'}
      />
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-500 text-white rounded-tr-sm'
              : isError
              ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-sm'
              : isCode
              ? 'bg-gray-900 text-green-400 font-mono rounded-tl-sm'
              : 'bg-white border border-gray-200 shadow-sm rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="m-0 whitespace-pre-wrap">{message.content}</p>
          ) : (
            <StreamingMessage message={message} />
          )}
        </div>
        <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs text-gray-400">
            {formatTimestamp(message.timestamp)}
          </span>
          {isCode && <Tag color="purple" className="text-xs">code output</Tag>}
          {isError && <Tag color="red" className="text-xs">error</Tag>}
        </div>
      </div>
    </div>
  );
};

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
        <RobotOutlined className="text-5xl text-gray-300" />
        <p className="text-base">Start a conversation with your AI assistant</p>
        <p className="text-sm">Ask questions, request code, or explore your workspace</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-4 overflow-y-auto h-full">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
