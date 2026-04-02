import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { SessionStatusBadge } from '../components/SessionStatusBadge';
import { SetupSection } from '../components/SetupSection';
import { ReadonlyRunnerConfigSection, RunnerSchemaSection } from '../components/RunnerConfigSections';
import type { AgentRunnerDetail, ResourceByKind, RunnerConfigJsonSchema, RunnerTypeResponse, SessionDetail } from '@agent-workbench/shared';
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
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Badge key={`${label}-${value}`} variant="outline" className="rounded-md">
              {value}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function isRunnerConfigJsonSchema(value: unknown): value is RunnerConfigJsonSchema {
  return typeof value === 'object' && value !== null;
}

function toRunnerConfigJsonSchema(value: unknown): RunnerConfigJsonSchema | undefined {
  return isRunnerConfigJsonSchema(value) ? value : undefined;
}

export function SessionDetailsSheet({
  open,
  onOpenChange,
  projectName,
  session,
  runnerDetail,
  runnerType,
  runners,
  resources
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
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
  const runnerName =
    runners.find((runner) => runner.id === session.runnerId)?.name ?? session.runnerId;
  const skillNames = session.platformSessionConfig.skillIds.map(
    (resourceId) =>
      resources.skills.find((item) => item.id === resourceId)?.name ?? resourceId
  );
  const ruleNames = session.platformSessionConfig.ruleIds.map(
    (resourceId) =>
      resources.rules.find((item) => item.id === resourceId)?.name ?? resourceId
  );
  const mcpNames = session.platformSessionConfig.mcps.map((item) => {
    const name =
      resources.mcps.find((resource) => resource.id === item.resourceId)?.name ??
      item.resourceId;
    return item.configOverride ? `${name} · override` : name;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="border-b border-border/40 px-5 py-4 text-left">
          <SheetTitle>Session 配置</SheetTitle>
          <SheetDescription>
            {projectName} · {session.runnerType}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                状态
              </p>
              <div className="mt-2">
                <SessionStatusBadge status={session.status} />
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                更新时间
              </p>
              <p className="mt-2 text-sm text-foreground">
                {new Date(session.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <SetupSection title="运行信息">
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Runner</span> {runnerName}
              </p>
              <p>
                <span className="font-medium text-foreground">Runner Type</span>{' '}
                {session.runnerType}
              </p>
              <p>
                <span className="font-medium text-foreground">CWD</span>{' '}
                {session.platformSessionConfig.cwd}
              </p>
            </div>
          </SetupSection>

          <ReadonlyRunnerConfigSection
            title="Runner Config"
            schema={runnerType?.runnerConfigSchema}
            values={runnerDetail?.runnerConfig}
          />

          <ReadonlyRunnerConfigSection
            title="Runner Session Config"
            schema={runnerType?.runnerSessionConfigSchema}
            values={session.runnerSessionConfig}
          />

          <SetupSection title="资源快照">
            <div className="space-y-4">
              <SessionDetailList label="Skills" values={skillNames} />
              <SessionDetailList label="Rules" values={ruleNames} />
              <SessionDetailList label="MCPs" values={mcpNames} />
            </div>
          </SetupSection>

          <RunnerSchemaSection
            title="Input Schema"
            schema={toRunnerConfigJsonSchema(runnerType?.inputSchema)}
            description="消息输入按 RunnerType 的 input schema 解释。"
          />

          <RunnerSchemaSection
            title="Runtime Schema"
            schema={toRunnerConfigJsonSchema(runnerType?.runtimeConfigSchema)}
            description="运行时动态参数 schema，当前页面只展示，不直接编辑。"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
