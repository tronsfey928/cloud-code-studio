import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Save } from 'lucide-react';
import api from '@/services/api';
import type { OpenCodeConfig, McpServer } from '@/types';

interface OpenCodeSettingsProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OpenCodeSettings({ workspaceId, open, onOpenChange }: OpenCodeSettingsProps) {
  const [config, setConfig] = useState<OpenCodeConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<OpenCodeConfig>(`/opencode/${workspaceId}/config`);
      setConfig(data);
    } catch {
      // Config may not exist yet
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) fetchConfig();
  }, [open, fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.put(`/opencode/${workspaceId}/config`, {
        codingProvider: config.codingProvider,
        llmProvider: config.llmProvider,
        llmModel: config.llmModel,
        llmApiKey: config.llmApiKey,
        llmBaseUrl: config.llmBaseUrl,
        skills: config.skills,
        mcpServers: config.mcpServers,
        setupCommands: config.setupCommands,
      });
      onOpenChange(false);
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  const addMcpServer = () => {
    if (!config) return;
    const newServer: McpServer = { name: '', url: '', enabled: true };
    setConfig({ ...config, mcpServers: [...config.mcpServers, newServer] });
  };

  const removeMcpServer = (index: number) => {
    if (!config) return;
    setConfig({ ...config, mcpServers: config.mcpServers.filter((_, i) => i !== index) });
  };

  const updateMcpServer = (index: number, field: keyof McpServer, value: string | boolean) => {
    if (!config) return;
    const updated = [...config.mcpServers];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, mcpServers: updated });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>Configure your coding provider and AI settings.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-8 text-center text-sm text-surface-400">Loading settings…</p>
        ) : config ? (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Provider */}
              <div className="space-y-2">
                <Label>Coding Provider</Label>
                <Select value={config.codingProvider} onValueChange={(v) => setConfig({ ...config, codingProvider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude_code">Claude Code</SelectItem>
                    <SelectItem value="codex">Codex (OpenAI)</SelectItem>
                    <SelectItem value="copilot_cli">GitHub Copilot CLI</SelectItem>
                    <SelectItem value="opencode">OpenCode</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* LLM Config */}
              <div className="space-y-2">
                <Label>LLM Provider</Label>
                <Input value={config.llmProvider} onChange={(e) => setConfig({ ...config, llmProvider: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={config.llmModel ?? ''} onChange={(e) => setConfig({ ...config, llmModel: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" value={config.llmApiKey ?? ''} onChange={(e) => setConfig({ ...config, llmApiKey: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Base URL (optional)</Label>
                <Input value={config.llmBaseUrl ?? ''} onChange={(e) => setConfig({ ...config, llmBaseUrl: e.target.value || null })} />
              </div>

              <Separator />

              {/* MCP Servers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>MCP Servers</Label>
                  <Button variant="outline" size="sm" onClick={addMcpServer}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                {config.mcpServers.map((server, i) => (
                  <div key={i} className="space-y-2 rounded-md border border-surface-200 p-3 dark:border-surface-700">
                    <div className="flex items-center justify-between">
                      <Input
                        placeholder="Server name"
                        value={server.name}
                        onChange={(e) => updateMcpServer(i, 'name', e.target.value)}
                        className="mr-2"
                      />
                      <div className="flex items-center gap-2">
                        <Switch checked={server.enabled} onCheckedChange={(v) => updateMcpServer(i, 'enabled', v)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger-500" onClick={() => removeMcpServer(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Input placeholder="URL" value={server.url} onChange={(e) => updateMcpServer(i, 'url', e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <p className="py-8 text-center text-sm text-surface-400">No configuration found.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !config}>
            <Save className="mr-1 h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
