import { SessionWorkspaceResourceKind } from '@agent-workbench/shared';
import { useEffect, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SessionStatusBadge } from '../components/SessionStatusBadge';
import { SetupSection } from '../components/SetupSection';
import { ReadonlyRunnerConfigSection } from '../components/RunnerConfigSections';
import { cn } from '@/lib/utils';
import type {
  ResourceByKind,
  RunnerTypeResponse,
  SessionDetail
} from '@agent-workbench/shared';
import { listAgentRunners } from '@/api/agent-runners';

function SessionDetailList({
  label,
  values,
  emptyLabel = '未配置'
}: {
  label: string;
  values: string[];
  emptyLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Badge
              key={`${label}-${value}`}
              variant="outline"
              className="rounded-md text-xs"
            >
              {value}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionTagList({
  values
}: {
  values: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <Badge
          key={value}
          variant="outline"
          className="rounded-md text-xs"
        >
          {value}
        </Badge>
      ))}
    </div>
  );
}

function SessionTextRow({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div
        className={cn(
          'text-sm text-foreground',
          valueClassName
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function SessionDetailsPanel({
  open,
  onClose,
  session,
  runnerType,
  runners,
  resources
}: {
  open: boolean;
  onClose?: () => void;
  session: SessionDetail;
  runnerType?: RunnerTypeResponse;
  runners: Awaited<ReturnType<typeof listAgentRunners>>;
  resources: {
    skills: ResourceByKind['skills'][];
    mcps: ResourceByKind['mcps'][];
    rules: ResourceByKind['rules'][];
  };
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const runnerName = useMemo(
    () =>
      runners.find((runner) => runner.id === session.runnerId)?.name ??
      session.runnerId,
    [runners, session.runnerId]
  );
  const skillNames = useMemo(
    () =>
      session.platformSessionConfig.skillIds.map(
        (resourceId) =>
          resources.skills.find((item) => item.id === resourceId)?.name ??
          resourceId
      ),
    [resources.skills, session.platformSessionConfig.skillIds]
  );
  const ruleNames = useMemo(
    () =>
      session.platformSessionConfig.ruleIds.map(
        (resourceId) =>
          resources.rules.find((item) => item.id === resourceId)?.name ??
          resourceId
      ),
    [resources.rules, session.platformSessionConfig.ruleIds]
  );
  const mcpNames = useMemo(
    () =>
      session.platformSessionConfig.mcps.map((item) => {
        const name =
          resources.mcps.find((resource) => resource.id === item.resourceId)
            ?.name ?? item.resourceId;
        return item.configOverride ? `${name} · override` : name;
      }),
    [resources.mcps, session.platformSessionConfig.mcps]
  );
  const attachedResourceTags = useMemo(
    () => [
      ...skillNames.map((name) => `Skill · ${name}`),
      ...ruleNames.map((name) => `Rule · ${name}`),
      ...mcpNames.map((name) => `MCP · ${name}`)
    ],
    [mcpNames, ruleNames, skillNames]
  );
  const hasSessionConfig =
    Object.keys(session.runnerSessionConfig).length > 0;
  const hasResources =
    skillNames.length > 0 || ruleNames.length > 0 || mcpNames.length > 0;
  const workspaceResourceLabels = useMemo(
    () =>
      session.platformSessionConfig.workspaceResources.map((resource) =>
        getWorkspaceResourceLabel(resource)
      ),
    [session.platformSessionConfig.workspaceResources]
  );
  const workspaceResourceConfigLabels = useMemo(
    () =>
      getWorkspaceResourceConfigLabels(
        session.platformSessionConfig.workspaceResourceConfig
      ),
    [session.platformSessionConfig.workspaceResourceConfig]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        onClose?.();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="会话设置"
      className={cn(
        'absolute top-full right-4 z-20 mt-2 w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/90'
      )}
    >
      <div className="max-h-[min(70vh,42rem)] overflow-y-auto px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/40 pb-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">会话设置</h2>
              <SessionStatusBadge status={session.status} />
            </div>
            <div className="space-y-1">
              <p className="truncate text-sm text-foreground">{runnerName}</p>
              <p className="text-xs text-muted-foreground">
                工作区、资源与会话参数。
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="收起会话设置"
          >
            收起
          </Button>
        </div>

        <div className="space-y-4">
          <SetupSection title="工作区">
            <div className="space-y-4">
              <div className="space-y-3 border-b border-border/40 pb-4">
                {session.platformSessionConfig.sessionRoot ? (
                  <SessionTextRow
                    label="Session 目录"
                    value={session.platformSessionConfig.sessionRoot}
                    valueClassName="break-all"
                  />
                ) : null}
                <SessionTextRow
                  label="运行目录"
                  value={session.platformSessionConfig.cwd}
                  valueClassName="break-all"
                />
                <SessionTextRow
                  label="工作区根目录"
                  value={session.platformSessionConfig.workspaceRoot}
                  valueClassName="break-all"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SessionDetailList
                  label="模式"
                  values={[session.platformSessionConfig.workspaceMode]}
                />
                <SessionDetailList
                  label="目录挂载"
                  values={workspaceResourceLabels}
                  emptyLabel="未初始化附加目录"
                />
                <SessionDetailList
                  label="代码 / 文档分支"
                  values={workspaceResourceConfigLabels}
                  emptyLabel="未指定额外分支"
                />
              </div>
            </div>
          </SetupSection>

          {hasResources ? (
            <SetupSection title="附加资源">
              <SessionTagList values={attachedResourceTags} />
            </SetupSection>
          ) : null}

          {hasSessionConfig ? (
            <ReadonlyRunnerConfigSection
              title="会话参数"
              schema={runnerType?.runnerSessionConfigSchema}
              values={session.runnerSessionConfig}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getWorkspaceResourceLabel(resource: SessionWorkspaceResourceKind) {
  switch (resource) {
    case SessionWorkspaceResourceKind.Code:
      return 'Code';
    case SessionWorkspaceResourceKind.Doc:
      return 'Doc';
  }
}

function getWorkspaceResourceConfigLabels(
  config: SessionDetail['platformSessionConfig']['workspaceResourceConfig'] | undefined
) {
  if (!config) {
    return [];
  }

  const labels: string[] = [];

  if (config.code?.branch) {
    labels.push(`Code · ${config.code.branch}`);
  }

  if (config.doc?.branch) {
    labels.push(`Doc · ${config.doc.branch}`);
  }

  return labels;
}
