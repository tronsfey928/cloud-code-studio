import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { cn } from '@/lib/utils';
import type { FileTreeNode } from '@/types';

interface FileExplorerProps {
  workspaceId: string;
  onFileSelect?: (path: string) => void;
  className?: string;
}

function TreeNode({ node, depth, onSelect }: { node: FileTreeNode; depth: number; onSelect?: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const isDir = node.type === 'directory';

  if (!isDir) {
    return (
      <button
        onClick={() => onSelect?.(node.path)}
        className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm hover:bg-surface-100 active:bg-surface-200 dark:hover:bg-surface-800"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <File className="h-4 w-4 shrink-0 text-surface-400" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm font-medium hover:bg-surface-100 active:bg-surface-200 dark:hover:bg-surface-800"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          {open ? <FolderOpen className="h-4 w-4 shrink-0 text-primary-500" /> : <Folder className="h-4 w-4 shrink-0 text-primary-500" />}
          <span className="truncate">{node.name}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {node.children?.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onSelect={onSelect} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function FileExplorer({ workspaceId, onFileSelect, className }: FileExplorerProps) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<FileTreeNode[]>(`/files/tree/${workspaceId}`);
      setTree(Array.isArray(data) ? data : []);
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center justify-between border-b border-surface-200 px-3 py-2 dark:border-surface-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">Files</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchTree} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {tree.length === 0 && !loading && (
          <p className="p-4 text-center text-xs text-surface-400">No files found</p>
        )}
        {tree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} onSelect={onFileSelect} />
        ))}
      </ScrollArea>
    </div>
  );
}
