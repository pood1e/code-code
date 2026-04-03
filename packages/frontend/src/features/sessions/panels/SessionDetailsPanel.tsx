import { useEffect, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SessionStatusBadge } from '../components/SessionStatusBadge';
import { SetupSection } from '../components/SetupSection';
import { ReadonlyRunnerConfigSection } from '../components/RunnerConfigSections';
import { cn } from '@/lib/utils';
import type {
  AgentRunnerDetail,
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

export function SessionDetailsPanel({
  open,
  onClose,
  session,
  runnerDetail,
  runnerType,
  runners,
  resources
}: {
  open: boolean;
  onClose?: () => void;
  session: SessionDetail;
  runnerDetail?: AgentRunnerDetail;
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
  const hasSessionConfig =
    Object.keys(session.runnerSessionConfig).length > 0;
  const hasRuntimeConfig =
    Object.keys(session.defaultRuntimeConfig ?? {}).length > 0;
  const hasResources =
    skillNames.length > 0 || ruleNames.length > 0 || mcpNames.length > 0;

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
        'absolute top-full right-4 z-20 mt-2 w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/90'
      )}
    >
      <div className="max-h-[min(70vh,42rem)] overflow-y-auto px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">会话设置</h2>
            <p className="text-sm text-muted-foreground">
              只展示当前会话真正影响运行的配置。
            </p>
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

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">状态</p>
            <div className="mt-1">
              <SessionStatusBadge status={session.status} />
            </div>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Runner</p>
            <p className="mt-1 truncate text-sm text-foreground">{runnerName}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">工作目录</p>
            <p className="mt-1 line-clamp-2 break-all text-sm text-foreground">
              {session.platformSessionConfig.cwd}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {hasResources ? (
            <SetupSection title="资源快照">
              <div className="space-y-3">
                <SessionDetailList label="Skills" values={skillNames} />
                <SessionDetailList label="Rules" values={ruleNames} />
                <SessionDetailList label="MCPs" values={mcpNames} />
              </div>
            </SetupSection>
          ) : null}

          {hasSessionConfig ? (
            <ReadonlyRunnerConfigSection
              title="会话参数"
              schema={runnerType?.runnerSessionConfigSchema}
              values={session.runnerSessionConfig}
            />
          ) : null}

          {hasRuntimeConfig ? (
            <ReadonlyRunnerConfigSection
              title="默认运行参数"
              schema={runnerType?.runtimeConfigSchema}
              values={session.defaultRuntimeConfig ?? undefined}
            />
          ) : null}

          {!hasResources && !hasSessionConfig && !hasRuntimeConfig ? (
            <SetupSection title="额外设置">
              <p className="text-sm text-muted-foreground">
                当前会话没有额外资源或参数覆盖。
              </p>
            </SetupSection>
          ) : null}

          {runnerDetail?.description ? (
            <SetupSection title="Runner 说明">
              <p className="text-sm text-muted-foreground">
                {runnerDetail.description}
              </p>
            </SetupSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
