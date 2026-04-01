import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface StreamingMessageProps {
  content: string;
  className?: string;
}

export function StreamingMessage({ content, className }: StreamingMessageProps) {
  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
      <span className="inline-block h-4 w-1 animate-pulse bg-primary-500 align-text-bottom" />
    </div>
  );
}
