import type { ResourceKind } from '@agent-workbench/shared';
import { create } from 'zustand';

type UiState = {
  sidebarCollapsed: boolean;
  agentRunnerSearch: string;
  resourceSearch: Record<ResourceKind, string>;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAgentRunnerSearch: (value: string) => void;
  setResourceSearch: (kind: ResourceKind, value: string) => void;
};

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: loadSidebarCollapsed(),
  agentRunnerSearch: '',
  resourceSearch: {
    skills: '',
    mcps: '',
    rules: ''
  },
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        /* no-op */
      }
      return { sidebarCollapsed: next };
    }),
  setSidebarCollapsed: (sidebarCollapsed) => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      /* no-op */
    }
    set({ sidebarCollapsed });
  },
  setAgentRunnerSearch: (agentRunnerSearch) => set({ agentRunnerSearch }),
  setResourceSearch: (kind, value) =>
    set((state) => ({
      resourceSearch: {
        ...state.resourceSearch,
        [kind]: value
      }
    }))
}));
