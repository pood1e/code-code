import type { ResourceKind } from '@agent-workbench/shared';
import { create } from 'zustand';

type UiState = {
  sidebarCollapsed: boolean;
  resourceSearch: Record<ResourceKind, string>;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setResourceSearch: (kind: ResourceKind, value: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  resourceSearch: {
    skills: '',
    mcps: '',
    rules: ''
  },
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setResourceSearch: (kind, value) =>
    set((state) => ({
      resourceSearch: {
        ...state.resourceSearch,
        [kind]: value
      }
    }))
}));
