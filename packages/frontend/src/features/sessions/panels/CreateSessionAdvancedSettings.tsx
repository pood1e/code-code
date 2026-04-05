import { SessionWorkspaceResourceKind } from '@agent-workbench/shared';
import { SlidersHorizontal } from 'lucide-react';
import type { Control } from 'react-hook-form';

import { cn } from '@/lib/utils';
import type { RunnerConfigField } from '@/lib/runner-config-schema';
import type { CreateSessionFormValues } from '@/pages/projects/project-sessions.form';

import { DynamicConfigFieldInput } from '../components/DynamicConfigFieldInput';
import { ResourceSelectionSection } from '../components/ResourceSelectionSection';
import { SetupSection } from '../components/SetupSection';
import type { CreateSessionResources } from './use-create-session-panel-state';

type CreateSessionConfigFieldPrefix =
  | 'initialInputConfig'
  | 'runnerSessionConfig'
  | 'initialRuntimeConfig';

type RunnerContextOptions =
  | Record<string, Array<{ label: string; value: string } | string>>
  | undefined;

export function CreateSessionAdvancedSettings({
  open,
  control,
  additionalInputFields,
  sessionConfigFields,
  runtimeFields,
  runnerContext,
  resources,
  selectedWorkspaceResources,
  selectedSkillIds,
  selectedRuleIds,
  selectedMcpIds,
  onToggleSelection
}: {
  open: boolean;
  control: Control<CreateSessionFormValues>;
  additionalInputFields: RunnerConfigField[];
  sessionConfigFields: RunnerConfigField[];
  runtimeFields: RunnerConfigField[];
  runnerContext: RunnerContextOptions;
  resources: CreateSessionResources;
  selectedWorkspaceResources: SessionWorkspaceResourceKind[];
  selectedSkillIds: string[];
  selectedRuleIds: string[];
  selectedMcpIds: string[];
  onToggleSelection: (
    fieldName: 'workspaceResources' | 'skillIds' | 'ruleIds' | 'mcpIds',
    resourceId: string
  ) => void;
}) {
  return (
    <div
      className={cn(
        'grid transition-all duration-300 ease-in-out',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      )}
    >
      <div className="overflow-hidden">
        <div className="mx-auto max-w-4xl border-t border-border/30 px-5 py-5">
          <CreateSessionAdvancedHeader />

          <div className="space-y-5">
            <ConfigFieldsSection
              title="输入参数"
              fields={additionalInputFields}
              namePrefix="initialInputConfig"
              control={control}
              runnerContext={runnerContext}
            />
            <ConfigFieldsSection
              title="会话参数 (Session Config)"
              fields={sessionConfigFields}
              namePrefix="runnerSessionConfig"
              control={control}
              runnerContext={runnerContext}
            />
            <ConfigFieldsSection
              title="运行参数 (Runtime Config)"
              fields={runtimeFields}
              namePrefix="initialRuntimeConfig"
              control={control}
              runnerContext={runnerContext}
            />

            <SetupSection title="工作目录">
              <p className="text-sm text-muted-foreground">
                会话固定运行在项目 Workspace 根目录下的独立目录：
                <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                  {'{workspacePath}/{sessionId}'}
                </code>
                。
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <WorkspaceResourceOption
                  title="Code"
                  description="创建会话时自动 git clone 项目代码到该目录"
                  checked={selectedWorkspaceResources.includes(
                    SessionWorkspaceResourceKind.Code
                  )}
                  onToggle={() =>
                    onToggleSelection(
                      'workspaceResources',
                      SessionWorkspaceResourceKind.Code
                    )
                  }
                />
                <WorkspaceResourceOption
                  title="Doc"
                  description="创建会话时在该目录下初始化 docs 子目录"
                  checked={selectedWorkspaceResources.includes(
                    SessionWorkspaceResourceKind.Doc
                  )}
                  onToggle={() =>
                    onToggleSelection(
                      'workspaceResources',
                      SessionWorkspaceResourceKind.Doc
                    )
                  }
                />
              </div>
            </SetupSection>

            <SetupSection title="资源">
              <div className="grid gap-5 xl:grid-cols-2">
                <ResourceSelectionSection
                  label="技能"
                  items={resources.skills}
                  value={selectedSkillIds}
                  onToggle={(resourceId) =>
                    onToggleSelection('skillIds', resourceId)
                  }
                />
                <ResourceSelectionSection
                  label="规则"
                  items={resources.rules}
                  value={selectedRuleIds}
                  onToggle={(resourceId) =>
                    onToggleSelection('ruleIds', resourceId)
                  }
                />
                <ResourceSelectionSection
                  label="MCP"
                  items={resources.mcps}
                  value={selectedMcpIds}
                  onToggle={(resourceId) =>
                    onToggleSelection('mcpIds', resourceId)
                  }
                  getHint={(item) =>
                    typeof item.content === 'object' && item.content
                      ? item.content.command
                      : undefined
                  }
                />
              </div>
            </SetupSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceResourceOption({
  title,
  description,
  checked,
  onToggle
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/40 bg-background/70 px-3 py-3">
      <input
        type="checkbox"
        className="mt-0.5 size-4"
        checked={checked}
        onChange={onToggle}
      />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}

function CreateSessionAdvancedHeader() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <SlidersHorizontal className="size-4 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">高级设置</p>
      <p className="text-xs text-muted-foreground">资源、输入参数和会话参数</p>
    </div>
  );
}

function ConfigFieldsSection({
  title,
  fields,
  namePrefix,
  control,
  runnerContext
}: {
  title: string;
  fields: RunnerConfigField[];
  namePrefix: CreateSessionConfigFieldPrefix;
  control: Control<CreateSessionFormValues>;
  runnerContext: RunnerContextOptions;
}) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <SetupSection title={title}>
      <div className="grid gap-4">
        {fields.map((field) => (
          <DynamicConfigFieldInput
            key={field.name}
            field={field}
            namePrefix={namePrefix}
            control={control}
            discoveredOptions={runnerContext}
          />
        ))}
      </div>
    </SetupSection>
  );
}
