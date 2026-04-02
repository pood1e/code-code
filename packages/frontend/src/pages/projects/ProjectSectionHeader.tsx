import type { Project } from '@agent-workbench/shared';

import { cn } from '@/lib/utils';

type ProjectTab = 'config' | 'sessions' | 'dashboard';

type ProjectSectionHeaderProps = {
  projects: Project[];
  currentProjectId: string;
  activeTab: ProjectTab;
  onProjectChange: (id: string) => void;
  onTabChange: (tab: ProjectTab) => void;
};

const tabItems: { key: ProjectTab; label: string }[] = [
  { key: 'config', label: '配置' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'dashboard', label: 'Dashboard' }
];

export function ProjectSectionHeader({
  projects,
  currentProjectId,
  activeTab,
  onProjectChange,
  onTabChange
}: ProjectSectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/40 bg-background/95 px-4 py-2 backdrop-blur-sm sm:px-5">
      <select
        aria-label="选择当前 Project"
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:min-w-40"
        value={currentProjectId}
        onChange={(event) => onProjectChange(event.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-0.5">
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'rounded-md px-2.5 py-1 text-sm transition-colors',
              activeTab === tab.key
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
