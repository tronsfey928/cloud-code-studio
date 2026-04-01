import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChatProps {
  sessionId: string | null;
  className?: string;
}

export default function Chat({ sessionId, className }: ChatProps) {
  const { messages, isTyping } = useChatStore();
  const { sendMessage } = useWebSocket(sessionId);

  return (
    <Card className={cn('flex h-full flex-col overflow-hidden', className)}>
      <div className="flex items-center border-b border-surface-200 px-4 py-3 dark:border-surface-800">
        <h2 className="text-sm font-semibold">Chat</h2>
      </div>
      <MessageList messages={messages} className="flex-1" />
      {isTyping && <TypingIndicator />}
      <MessageInput onSend={sendMessage} disabled={!sessionId} />
    </Card>
  );
}
