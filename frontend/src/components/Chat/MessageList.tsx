import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { StreamingMessage } from './StreamingMessage';
import { formatTimestamp } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';
import { MessageType } from '@/types';
import { Bot, User, Wrench, FileCode, ListChecks, Globe } from 'lucide-react';

interface MessageListProps {
  messages: ChatMessage[];
  className?: string;
}

function MessageIcon({ type, isUser }: { type: MessageType; isUser?: boolean }) {
  if (isUser) return <User className="h-4 w-4" />;
  switch (type) {
    case MessageType.TOOL_CALL:
      return <Wrench className="h-4 w-4" />;
    case MessageType.CODE_CHANGE:
      return <FileCode className="h-4 w-4" />;
    case MessageType.PLAN:
      return <ListChecks className="h-4 w-4" />;
    case MessageType.DEV_SERVER:
      return <Globe className="h-4 w-4" />;
    default:
      return <Bot className="h-4 w-4" />;
  }
}

function typeBadge(type: MessageType) {
  switch (type) {
    case MessageType.TOOL_CALL:
      return <Badge variant="secondary" className="text-xs">Tool Call</Badge>;
    case MessageType.CODE_CHANGE:
      return <Badge variant="outline" className="text-xs">Code Change</Badge>;
    case MessageType.PLAN:
      return <Badge variant="warning" className="text-xs">Plan</Badge>;
    case MessageType.DEV_SERVER:
      return <Badge variant="success" className="text-xs">Dev Server</Badge>;
    case MessageType.ERROR:
      return <Badge variant="destructive" className="text-xs">Error</Badge>;
    default:
      return null;
  }
}

export function MessageList({ messages, className }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={cn('flex flex-1 items-center justify-center text-surface-400', className)}>
        <p className="text-sm">No messages yet. Start a conversation!</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('flex-1', className)}>
      <div className="space-y-4 p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3',
              msg.isUser ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className={msg.isUser ? 'bg-primary-100 text-primary-700' : 'bg-accent-100 text-accent-700'}>
                <MessageIcon type={msg.type} isUser={msg.isUser} />
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                'max-w-[75%] rounded-lg px-3 py-2',
                msg.isUser
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-100 text-surface-900 dark:bg-surface-800 dark:text-surface-100',
                msg.type === MessageType.ERROR && 'border border-danger-300 bg-danger-50 text-danger-800 dark:bg-danger-700/20 dark:text-danger-200',
              )}
            >
              {typeBadge(msg.type)}
              {msg.isStreaming ? (
                <StreamingMessage content={msg.content} />
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
              <span className="mt-1 block text-[10px] opacity-60">
                {formatTimestamp(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
