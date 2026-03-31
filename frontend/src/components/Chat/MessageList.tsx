import React, { useEffect, useRef } from 'react';
import { Avatar, Tag, Button, Steps, Collapse } from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  ToolOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  GlobalOutlined,
  DiffOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { ChatMessage } from '@/types';
import { MessageType } from '@/types';
import StreamingMessage from './StreamingMessage';
import { formatTimestamp } from '@/utils/helpers';

interface MessageListProps {
  messages: ChatMessage[];
  onConfirmPlan?: (planId: string, confirmed: boolean) => void;
}

/** Card for displaying tool call info */
const ToolCallCard: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const tc = message.toolCall;
  if (!tc) return null;

  const statusIcon =
    tc.status === 'running' ? (
      <LoadingOutlined className="text-blue-500" />
    ) : tc.status === 'completed' ? (
      <CheckCircleOutlined className="text-green-500" />
    ) : (
      <CloseCircleOutlined className="text-red-500" />
    );

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <ToolOutlined className="text-purple-500" />
        <span className="font-medium text-sm text-gray-700">{tc.toolName}</span>
        {statusIcon}
      </div>
      {tc.input && (
        <Collapse
          size="small"
          items={[
            {
              key: 'input',
              label: <span className="text-xs text-gray-500">Input</span>,
              children: (
                <pre className="text-xs font-mono bg-gray-900 text-green-400 p-2 rounded overflow-x-auto m-0 whitespace-pre-wrap">
                  {tc.input}
                </pre>
              ),
            },
          ]}
        />
      )}
      {tc.output && (
        <pre className="text-xs font-mono bg-gray-100 text-gray-700 p-2 rounded mt-2 overflow-x-auto m-0 whitespace-pre-wrap max-h-40 overflow-y-auto">
          {tc.output}
        </pre>
      )}
    </div>
  );
};

/** Card for displaying code change info */
const CodeChangeCard: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const cc = message.codeChange;
  if (!cc) return null;

  const changeIcon =
    cc.changeType === 'created' ? (
      <PlusCircleOutlined className="text-green-500" />
    ) : cc.changeType === 'deleted' ? (
      <DeleteOutlined className="text-red-500" />
    ) : (
      <EditOutlined className="text-blue-500" />
    );

  const changeColor =
    cc.changeType === 'created'
      ? 'green'
      : cc.changeType === 'deleted'
      ? 'red'
      : 'blue';

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 p-3">
      <div className="flex items-center gap-2 mb-1">
        {changeIcon}
        <span className="font-mono text-sm text-gray-700">{cc.filePath}</span>
        <Tag color={changeColor} className="text-xs">
          {cc.changeType}
        </Tag>
      </div>
      {cc.diff && (
        <pre className="text-xs font-mono bg-gray-900 text-gray-200 p-2 rounded mt-2 overflow-x-auto m-0 whitespace-pre-wrap max-h-60 overflow-y-auto">
          {cc.diff.split('\n').map((line, i) => {
            let cls = '';
            if (line.startsWith('+')) cls = 'text-green-400';
            else if (line.startsWith('-')) cls = 'text-red-400';
            else if (line.startsWith('@@')) cls = 'text-cyan-400';
            return (
              <span key={i} className={cls}>
                {line}
                {'\n'}
              </span>
            );
          })}
        </pre>
      )}
    </div>
  );
};

/** Card for plan confirmation */
const PlanCard: React.FC<{
  message: ChatMessage;
  onConfirm?: (planId: string, confirmed: boolean) => void;
}> = ({ message, onConfirm }) => {
  const plan = message.plan;
  if (!plan) return null;

  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50 p-3">
      <div className="flex items-center gap-2 mb-3">
        <FileTextOutlined className="text-amber-600" />
        <span className="font-semibold text-sm text-amber-800">Development Plan</span>
        <Tag color={plan.status === 'pending' ? 'orange' : plan.status === 'confirmed' ? 'green' : 'red'}>
          {plan.status}
        </Tag>
      </div>
      <Steps
        direction="vertical"
        size="small"
        current={-1}
        className="mb-3"
        items={plan.steps.map((step) => ({
          title: <span className="text-sm">{step.description}</span>,
          status:
            step.status === 'completed'
              ? 'finish'
              : step.status === 'in_progress'
              ? 'process'
              : step.status === 'skipped'
              ? 'error'
              : 'wait',
        }))}
      />
      {plan.status === 'pending' && onConfirm && (
        <div className="flex gap-2 mt-2">
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => onConfirm(plan.id, true)}
          >
            Approve Plan
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => onConfirm(plan.id, false)}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
};

/** Card for dev server status */
const DevServerCard: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const ds = message.devServer;
  if (!ds) return null;

  return (
    <div className="border border-green-200 rounded-lg bg-green-50 p-3">
      <div className="flex items-center gap-2">
        <GlobalOutlined className="text-green-600" />
        <span className="font-medium text-sm text-green-800">Dev Server</span>
        <Tag color={ds.status === 'running' ? 'green' : ds.status === 'error' ? 'red' : 'blue'}>
          {ds.status}
        </Tag>
      </div>
      <p className="text-xs text-gray-600 mt-1 font-mono">
        Port {ds.port} — {ds.url}
      </p>
    </div>
  );
};

const MessageBubble: React.FC<{
  message: ChatMessage;
  onConfirmPlan?: (planId: string, confirmed: boolean) => void;
}> = ({ message, onConfirmPlan }) => {
  const isUser = message.isUser;
  const isError = message.type === MessageType.ERROR;
  const isCode = message.type === MessageType.CODE_EXECUTION;
  const isToolCall = message.type === MessageType.TOOL_CALL;
  const isCodeChange = message.type === MessageType.CODE_CHANGE;
  const isPlan = message.type === MessageType.PLAN;
  const isDevServer = message.type === MessageType.DEV_SERVER;

  // Structured events use custom cards instead of bubbles
  if (isToolCall) {
    return (
      <div className="flex gap-3 mb-4 flex-row">
        <Avatar icon={<ToolOutlined />} className="bg-purple-500 shrink-0" size="small" />
        <div className="max-w-[85%] flex flex-col gap-1">
          <ToolCallCard message={message} />
          <span className="text-xs text-gray-400">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  if (isCodeChange) {
    return (
      <div className="flex gap-3 mb-4 flex-row">
        <Avatar icon={<DiffOutlined />} className="bg-blue-500 shrink-0" size="small" />
        <div className="max-w-[85%] flex flex-col gap-1">
          <CodeChangeCard message={message} />
          <span className="text-xs text-gray-400">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  if (isPlan) {
    return (
      <div className="flex gap-3 mb-4 flex-row">
        <Avatar icon={<FileTextOutlined />} className="bg-amber-500 shrink-0" size="small" />
        <div className="max-w-[85%] flex flex-col gap-1">
          <PlanCard message={message} onConfirm={onConfirmPlan} />
          <span className="text-xs text-gray-400">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  if (isDevServer) {
    return (
      <div className="flex gap-3 mb-4 flex-row">
        <Avatar icon={<GlobalOutlined />} className="bg-green-500 shrink-0" size="small" />
        <div className="max-w-[85%] flex flex-col gap-1">
          <DevServerCard message={message} />
          <span className="text-xs text-gray-400">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        className={isUser ? 'bg-blue-500 shrink-0' : 'bg-green-600 shrink-0'}
      />
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Image attachments */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {message.attachments
              .filter((a) => a.mimeType?.startsWith('image/') && a.data)
              .map((a, i) => (
                <img
                  key={i}
                  src={a.data}
                  alt={a.name}
                  className="max-w-[200px] max-h-[150px] rounded-lg border border-gray-200 object-cover"
                />
              ))}
          </div>
        )}
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

const MessageList: React.FC<MessageListProps> = ({ messages, onConfirmPlan }) => {
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
        <MessageBubble key={msg.id} message={msg} onConfirmPlan={onConfirmPlan} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
