import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Chat from '@/components/Chat';
import FileExplorer from '@/components/FileExplorer';
import OpenCodeSettings from '@/components/OpenCodeSettings';
import { LoadingSpinner } from '@/components/Common';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useChatStore } from '@/stores/chatStore';
import api from '@/services/api';
import { ArrowLeft, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, setCurrentWorkspace, fetchWorkspaces, workspaces } = useWorkspaceStore();
  const { setSessionId, sessionId } = useChatStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const initWorkspace = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    // Ensure workspace list is loaded
    if (workspaces.length === 0) {
      await fetchWorkspaces();
    }

    const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === id);
    if (ws) {
      setCurrentWorkspace(ws);
    }

    // Create or fetch chat session
    try {
      const { data } = await api.post<{ id: string }>('/chat/sessions', { workspaceId: id });
      setSessionId(data.id);
    } catch {
      // Session creation failed
    }

    setLoading(false);
  }, [id, workspaces.length, fetchWorkspaces, setCurrentWorkspace, setSessionId]);

  useEffect(() => {
    initWorkspace();
    return () => {
      setCurrentWorkspace(null);
    };
  }, [initWorkspace, setCurrentWorkspace]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner label="Loading workspace…" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-surface-50 dark:bg-surface-950">
      {/* Top bar */}
      <header className="flex items-center gap-2 border-b border-surface-200 bg-white px-3 py-2 dark:border-surface-800 dark:bg-surface-900">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm font-medium">{currentWorkspace?.name ?? 'Workspace'}</span>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-1 h-4 w-4" /> Settings
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className={cn('w-64 shrink-0 border-r border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900')}>
            {id && <FileExplorer workspaceId={id} />}
          </aside>
        )}

        {/* Chat area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <Chat sessionId={sessionId} className="flex-1 border-0 rounded-none shadow-none" />
        </main>
      </div>

      {/* Settings dialog */}
      {id && <OpenCodeSettings workspaceId={id} open={settingsOpen} onOpenChange={setSettingsOpen} />}
    </div>
  );
}
