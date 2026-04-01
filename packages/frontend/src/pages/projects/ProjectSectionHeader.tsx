import type { Project } from '@agent-workbench/shared';

import { cn } from '@/lib/utils';

const tabButtonClassName =
  'border-b-2 px-1 pb-2 text-sm font-medium transition-colors';
const selectClassName =
  'flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 sm:w-auto sm:min-w-[16rem]';

type ProjectTab = 'config' | 'sessions' | 'dashboard';

type ProjectSectionHeaderProps = {
  projects: Project[];
  currentProjectId: string;
  activeTab: ProjectTab;
  onProjectChange: (id: string) => void;
  onTabChange: (tab: ProjectTab) => void;
};

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
          <p className="text-sm font-medium text-foreground">Project 切换器</p>
          <select
            aria-label="选择当前 Project"
            className={selectClassName}
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onTabChange('config')}
            className={cn(
              tabButtonClassName,
              activeTab === 'config'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            配置
          </button>
          <button
            type="button"
            onClick={() => onTabChange('sessions')}
            className={cn(
              tabButtonClassName,
              activeTab === 'sessions'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            Sessions
          </button>
          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={cn(
              tabButtonClassName,
              activeTab === 'dashboard'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
