import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { SessionStatusBadge } from '../components/SessionStatusBadge';
import { SetupSection } from '../components/SetupSection';
import {
  ReadonlyRunnerConfigSection,
  RunnerSchemaSection
} from '../components/RunnerConfigSections';
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
  session,
  runnerDetail,
  runnerType,
  runners,
  resources
}: {
  open: boolean;
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

  return (
    <div
      className={cn(
        'grid transition-all duration-300 ease-in-out',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      )}
    >
      <div className="overflow-hidden">
        <div className="border-b border-border/40 bg-muted/10 px-5 py-4">
          {/* Compact summary row */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/30 bg-background/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                状态
              </p>
              <div className="mt-1">
                <SessionStatusBadge status={session.status} />
              </div>
            </div>
            <div className="rounded-lg border border-border/30 bg-background/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Runner
              </p>
              <p className="mt-1 truncate text-sm text-foreground">
                {runnerName}
              </p>
            </div>
            <div className="rounded-lg border border-border/30 bg-background/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Type
              </p>
              <p className="mt-1 truncate text-sm text-foreground">
                {session.runnerType}
              </p>
            </div>
            <div className="rounded-lg border border-border/30 bg-background/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                更新时间
              </p>
              <p className="mt-1 truncate text-sm text-foreground">
                {new Date(session.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Expandable detail sections */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <ReadonlyRunnerConfigSection
                title="Runner Config"
                schema={runnerType?.runnerConfigSchema}
                values={runnerDetail?.runnerConfig}
              />
              <ReadonlyRunnerConfigSection
                title="Session Config"
                schema={runnerType?.runnerSessionConfigSchema}
                values={session.runnerSessionConfig}
              />
              <ReadonlyRunnerConfigSection
                title="Default Runtime Config"
                schema={runnerType?.runtimeConfigSchema}
                values={session.defaultRuntimeConfig ?? undefined}
              />
            </div>

            <div className="space-y-4">
              <SetupSection title="CWD">
                <p className="break-all text-sm text-muted-foreground">
                  {session.platformSessionConfig.cwd}
                </p>
              </SetupSection>

              <SetupSection title="资源快照">
                <div className="space-y-3">
                  <SessionDetailList label="Skills" values={skillNames} />
                  <SessionDetailList label="Rules" values={ruleNames} />
                  <SessionDetailList label="MCPs" values={mcpNames} />
                </div>
              </SetupSection>

              <RunnerSchemaSection
                title="Input Schema"
                schema={runnerType?.inputSchema}
                description="消息输入按 RunnerType 的 input schema 解释。"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
