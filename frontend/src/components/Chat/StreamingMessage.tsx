import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '@/types';

interface StreamingMessageProps {
  message: ChatMessage;
}

const StreamingMessage: React.FC<StreamingMessageProps> = ({ message }) => (
  <div className="prose prose-sm max-w-none text-gray-800">
    <ReactMarkdown>{message.content}</ReactMarkdown>
    {message.isStreaming && (
      <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 animate-pulse align-middle rounded-sm" />
    )}
  </div>
);

export default StreamingMessage;
