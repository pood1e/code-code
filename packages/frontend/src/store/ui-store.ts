import type { ResourceKind } from '@agent-workbench/shared';
import { create } from 'zustand';

type UiState = {
  sidebarCollapsed: boolean;
  agentRunnerSearch: string;
  resourceSearch: Record<ResourceKind, string>;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAgentRunnerSearch: (value: string) => void;
  setResourceSearch: (kind: ResourceKind, value: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  agentRunnerSearch: '',
  resourceSearch: {
    skills: '',
    mcps: '',
    rules: ''
  },
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setAgentRunnerSearch: (agentRunnerSearch) => set({ agentRunnerSearch }),
  setResourceSearch: (kind, value) =>
    set((state) => ({
      resourceSearch: {
        ...state.resourceSearch,
        [kind]: value
      }
    }))
}));
