import { create } from 'zustand';

type ProjectState = {
  currentProjectId: string | null;
  setCurrentProject: (id: string | null) => void;
};

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  setCurrentProject: (currentProjectId) => set({ currentProjectId })
}));
