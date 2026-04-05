import type { Project } from '@agent-workbench/shared';

import { CompactNativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import type { ProjectTabKey } from '@/types/projects';

type ProjectSectionHeaderProps = {
  projects: Project[];
  currentProjectId: string;
  activeTab: ProjectTabKey;
  onProjectChange: (id: string) => void;
  onTabChange: (tab: ProjectTabKey) => void;
};

const tabItems: { key: ProjectTabKey; label: string }[] = [
  { key: 'dashboard', label: '概览' },
  { key: 'chats', label: '会话' },
  { key: 'config', label: '配置' }
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
      <CompactNativeSelect
        aria-label="选择当前 Project"
        containerClassName="sm:min-w-40"
        className="h-8 w-full rounded-xl bg-background/80 text-sm"
        value={currentProjectId}
        onChange={(event) => onProjectChange(event.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </CompactNativeSelect>

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
