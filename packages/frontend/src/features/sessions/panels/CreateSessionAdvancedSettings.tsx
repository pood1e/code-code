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
  selectedSkillIds: string[];
  selectedRuleIds: string[];
  selectedMcpIds: string[];
  onToggleSelection: (
    fieldName: 'skillIds' | 'ruleIds' | 'mcpIds',
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
