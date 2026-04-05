import { SessionWorkspaceResourceKind } from '@agent-workbench/shared';
import { FolderTree, SlidersHorizontal } from 'lucide-react';
import { Controller, type Control } from 'react-hook-form';

import { FormField } from '@/components/app/FormField';
import { Input } from '@/components/ui/input';
import type { CreateSessionFormValues } from '@/pages/projects/project-sessions.form';

import { SessionResourcePicker } from '../components/SessionResourcePicker';
import { SetupSection } from '../components/SetupSection';
import type { CreateSessionResources } from './use-create-session-panel-state';

export function CreateSessionAdvancedSettings({
  control,
  resources,
  selectedWorkspaceResources,
  selectedSkillIds,
  selectedRuleIds,
  selectedMcpIds,
  onToggleSelection
}: {
  control: Control<CreateSessionFormValues>;
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
    <section className="rounded-2xl border border-border/40 bg-muted/10 px-3 py-3 sm:px-4">
      <CreateSessionAdvancedHeader />

      <div className="space-y-4">
        <SetupSection title="工作目录">
          <p className="text-sm text-muted-foreground">
            会话固定运行在项目 Workspace 根目录下的独立目录：
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              {'{workspacePath}/{sessionId}'}
            </code>
            。
          </p>
          <div className="mt-3 grid gap-2.5">
            <WorkspaceResourceOption
              control={control}
              title="Code"
              description="git clone 项目代码到当前会话目录"
              fieldName="workspaceResourceConfig.code.branch"
              branchDescription="可选。留空使用远端默认分支。"
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
              control={control}
              title="Doc"
              description="初始化 docs 目录，可从项目文档地址拉取或复制"
              fieldName="workspaceResourceConfig.doc.branch"
              branchDescription="可选。仅 Git 文档地址支持 branch；本地目录会直接复制。"
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
          <SessionResourcePicker
            resources={resources}
            selectedSkillIds={selectedSkillIds}
            selectedRuleIds={selectedRuleIds}
            selectedMcpIds={selectedMcpIds}
            onToggleSelection={(fieldName, resourceId) =>
              onToggleSelection(fieldName, resourceId)
            }
          />
        </SetupSection>
      </div>
    </section>
  );
}

function WorkspaceResourceOption({
  control,
  title,
  description,
  fieldName,
  branchDescription,
  checked,
  onToggle
}: {
  control: Control<CreateSessionFormValues>;
  title: string;
  description: string;
  fieldName:
    | 'workspaceResourceConfig.code.branch'
    | 'workspaceResourceConfig.doc.branch';
  branchDescription: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/80 px-3 py-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={checked}
          onChange={onToggle}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FolderTree className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{title}</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </label>

      {checked ? (
        <div className="mt-3 border-t border-border/40 pt-3">
          <Controller
            control={control}
            name={fieldName}
            render={({ field }) => (
              <FormField
                label={`${title} Branch`}
                htmlFor={fieldName}
                description={branchDescription}
              >
                <Input
                  id={fieldName}
                  placeholder="例如：main"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormField>
            )}
          />
        </div>
      ) : null}
    </div>
  );
}

function CreateSessionAdvancedHeader() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <SlidersHorizontal className="size-4 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">工作区与资源</p>
      <p className="text-xs text-muted-foreground">会话目录初始化与资源挂载</p>
    </div>
  );
}
