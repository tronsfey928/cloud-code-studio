import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuth } from '@/hooks/useAuth';
import { getWorkspaceStatusColor, formatTimestamp } from '@/utils/helpers';
import { Plus, MoreVertical, Trash2, ExternalLink, LogOut } from 'lucide-react';
import { LoadingSpinner } from '@/components/Common';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { workspaces, loading, fetchWorkspaces, createWorkspace, deleteWorkspace } = useWorkspaceStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const ws = await createWorkspace({
        name,
        repositoryUrl: repoUrl || undefined,
        branch: branch || undefined,
      });
      setCreateOpen(false);
      setName('');
      setRepoUrl('');
      setBranch('');
      navigate(`/workspace/${ws.id}`);
    } catch {
      // Error handled by store
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteWorkspace(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="border-b border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <h1 className="text-lg font-bold text-surface-900 dark:text-surface-100">CloudCode Studio</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-surface-500">{user?.username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Workspaces</h2>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Workspace
          </Button>
        </div>

        {loading && workspaces.length === 0 ? (
          <LoadingSpinner className="py-20" label="Loading workspaces…" />
        ) : workspaces.length === 0 ? (
          <Card className="py-16 text-center">
            <CardContent>
              <p className="text-surface-400">No workspaces yet. Create one to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Card key={ws.id} className="group transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{ws.name}</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/workspace/${ws.id}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Open
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-danger-600"
                          disabled={!!deletingId}
                          onClick={() => handleDelete(ws.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {deletingId === ws.id ? 'Deleting…' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="truncate">{ws.repositoryUrl || 'Local workspace'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge className={cn(getWorkspaceStatusColor(ws.status), 'text-xs')} variant="secondary">
                      {ws.status}
                    </Badge>
                    {ws.branch && (
                      <Badge variant="outline" className="text-xs">{ws.branch}</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-surface-400">
                    Created {formatTimestamp(new Date(ws.createdAt).getTime())}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>Set up a new coding workspace.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-project" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-repo">Repository URL (optional)</Label>
              <Input id="ws-repo" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/user/repo.git" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-branch">Branch (optional)</Label>
              <Input id="ws-branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
