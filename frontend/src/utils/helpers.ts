import { formatDistanceToNow } from 'date-fns';

export function formatTimestamp(ts: number): string {
  return formatDistanceToNow(new Date(ts), { addSuffix: true });
}

export function truncate(str: string, max = 80): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

export function getWorkspaceStatusColor(
  status: 'creating' | 'ready' | 'error',
): string {
  const map: Record<string, string> = {
    creating: 'processing',
    ready: 'success',
    error: 'error',
  };
  return map[status] ?? 'default';
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function bytesToHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
