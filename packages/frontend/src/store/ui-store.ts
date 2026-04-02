import type { ResourceKind } from '@agent-workbench/shared';
import { create } from 'zustand';

type UiState = {
  agentRunnerSearch: string;
  resourceSearch: Record<ResourceKind, string>;
  setAgentRunnerSearch: (value: string) => void;
  setResourceSearch: (kind: ResourceKind, value: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  agentRunnerSearch: '',
  resourceSearch: {
    skills: '',
    mcps: '',
    rules: ''
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
