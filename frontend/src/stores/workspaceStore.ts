import { create } from 'zustand';
import api from '@/services/api';
import type { Workspace, CreateWorkspacePayload } from '@/types';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (payload: CreateWorkspacePayload) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
  startWorkspace: (id: string) => Promise<void>;
  stopWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  loading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<Workspace[]>('/workspaces');
      set({ workspaces: data, loading: false });
    } catch (err) {
      set({ error: 'Failed to fetch workspaces', loading: false });
      throw err;
    }
  },

  createWorkspace: async (payload) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post<Workspace>('/workspaces', payload);
      set((state) => ({
        workspaces: [...state.workspaces, data],
        loading: false,
      }));
      return data;
    } catch (err) {
      set({ error: 'Failed to create workspace', loading: false });
      throw err;
    }
  },

  deleteWorkspace: async (id) => {
    try {
      await api.delete(`/workspaces/${id}`);
      set((state) => ({
        workspaces: state.workspaces.filter((w) => w.id !== id),
        currentWorkspace:
          state.currentWorkspace?.id === id ? null : state.currentWorkspace,
      }));
    } catch (err) {
      set({ error: 'Failed to delete workspace' });
      throw err;
    }
  },

  startWorkspace: async (id) => {
    try {
      const { data } = await api.post<Workspace>(`/workspaces/${id}/start`);
      set((state) => ({
        workspaces: state.workspaces.map((w) => (w.id === id ? data : w)),
        currentWorkspace:
          state.currentWorkspace?.id === id ? data : state.currentWorkspace,
      }));
    } catch (err) {
      set({ error: 'Failed to start workspace' });
      throw err;
    }
  },

  stopWorkspace: async (id) => {
    try {
      const { data } = await api.post<Workspace>(`/workspaces/${id}/stop`);
      set((state) => ({
        workspaces: state.workspaces.map((w) => (w.id === id ? data : w)),
        currentWorkspace:
          state.currentWorkspace?.id === id ? data : state.currentWorkspace,
      }));
    } catch (err) {
      set({ error: 'Failed to stop workspace' });
      throw err;
    }
  },

  setCurrentWorkspace: (workspace) => {
    const { workspaces } = get();
    if (workspace) {
      const full = workspaces.find((w) => w.id === workspace.id) ?? workspace;
      set({ currentWorkspace: full });
    } else {
      set({ currentWorkspace: null });
    }
  },
}));
