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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            当前 Project
          </p>
          <select
            aria-label="选择当前 Project"
            className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-56"
            value={currentProjectId}
            onChange={(event) => onProjectChange(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
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
    </div>
  );
}
