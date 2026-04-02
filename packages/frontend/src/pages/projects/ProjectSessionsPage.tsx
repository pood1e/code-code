import {
  type ReactNode,
  useCallback,
  startTransition,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import type {
  AgentRunnerDetail,
  Profile,
  ResourceByKind,
  RunnerConfigJsonSchema,
  RunnerTypeResponse,
  SendSessionMessageInput,
  SessionDetail,
  SessionStatus,
  SessionSummary
} from '@agent-workbench/shared';
import { SessionStatus as SessionStatusEnum } from '@agent-workbench/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  LoaderCircle,
  MessageSquarePlus,
  PanelRightOpen,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';

import {
  getAgentRunner,
  listAgentRunners,
  listAgentRunnerTypes
} from '@/api/agent-runners';
import { getProfile, listProfiles } from '@/api/profiles';
import { listResources } from '@/api/resources';
import {
  cancelSession,
  createSession,
  disposeSession,
  editSessionMessage,
  getSession,
  listSessionMessages,
  listSessions,
  reloadSession,
  sendSessionMessage
} from '@/api/sessions';
import {
  ApiRequestError,
  toApiRequestError,
  useErrorMessage
} from '@/api/client';
import { EmptyState } from '@/components/app/EmptyState';
import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { parseSessionInputText } from '@/features/chat/runtime/assistant-ui/input-payload';
import { SessionAssistantThread } from '@/features/chat/runtime/assistant-ui/SessionAssistantThread';
import {
  buildAdditionalInputInitialValues,
  buildStructuredMessagePayload,
  getAdditionalInputFields,
  getPrimaryInputField
} from '@/features/chat/runtime/assistant-ui/input-schema';
import type {
  SessionMessageRuntimeMap
} from '@/features/chat/runtime/assistant-ui/thread-adapter';
import {
  buildRunnerConfigInitialValues,
  getRunnerConfigFieldValue,
  normalizeRunnerConfigValues,
  parseRunnerConfigSchema,
  type RunnerConfigField
} from '@/lib/runner-config-schema';
import { ProjectSectionHeader } from '@/pages/projects/ProjectSectionHeader';
import {
  buildCreateSessionFormValues,
  buildCreateSessionPayload,
  createSessionFormSchema,
  getSessionStatusLabel,
  type CreateSessionFormValues
} from '@/pages/projects/project-sessions.utils';
import { useSessionEventStream } from '@/pages/projects/use-session-event-stream';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { queryKeys } from '@/query/query-keys';

const selectClassName =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50';
const emptyRunnerTypes: RunnerTypeResponse[] = [];
const emptyRunnerSummaries: Awaited<ReturnType<typeof listAgentRunners>> = [];
const emptyProfiles: Profile[] = [];
const emptySkills: ResourceByKind['skills'][] = [];
const emptyMcps: ResourceByKind['mcps'][] = [];
const emptyRules: ResourceByKind['rules'][] = [];
const sessionQueryKeys = queryKeys.sessions;

function formatRelativeTime(value: string) {
  const targetTime = new Date(value).getTime();
  const deltaMs = targetTime - Date.now();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const formatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });

  if (Math.abs(deltaMs) < hourMs) {
    return formatter.format(Math.round(deltaMs / minuteMs), 'minute');
  }

  if (Math.abs(deltaMs) < dayMs) {
    return formatter.format(Math.round(deltaMs / hourMs), 'hour');
  }

  return formatter.format(Math.round(deltaMs / dayMs), 'day');
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-[calc(var(--radius)*1.1)] bg-muted/70" />
      <div className="grid gap-4 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
        <div className="h-[36rem] animate-pulse rounded-[calc(var(--radius)*1.1)] bg-muted/60" />
        <div className="h-[36rem] animate-pulse rounded-[calc(var(--radius)*1.1)] bg-muted/55" />
      </div>
    </div>
  );
}

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const variant =
    status === SessionStatusEnum.Ready
      ? 'default'
      : status === SessionStatusEnum.Running
        ? 'secondary'
        : status === SessionStatusEnum.Error
          ? 'destructive'
          : 'outline';

  return <Badge variant={variant}>{getSessionStatusLabel(status)}</Badge>;
}

function ResourceSelectionSection<K extends 'skills' | 'mcps' | 'rules'>({
  label,
  items,
  value,
  onToggle,
  getHint
}: {
  label: string;
  items: ResourceByKind[K][];
  value: string[];
  onToggle: (resourceId: string) => void;
  getHint?: (item: ResourceByKind[K]) => string | undefined;
}) {
  const [pendingResourceId, setPendingResourceId] = useState('');
  const selectedItems = useMemo(
    () => value.map((resourceId) => items.find((item) => item.id === resourceId)).filter(Boolean),
    [items, value]
  );
  const availableItems = useMemo(
    () => items.filter((item) => !value.includes(item.id)),
    [items, value]
  );

  const handleAdd = () => {
    if (!pendingResourceId) {
      return;
    }

    onToggle(pendingResourceId);
    setPendingResourceId('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <span className="text-xs text-muted-foreground">已选 {value.length}</span>
      </div>

      <div className="flex gap-2">
        <select
          className={`${selectClassName} min-w-0 flex-1`}
          value={pendingResourceId}
          onChange={(event) => setPendingResourceId(event.target.value)}
          disabled={availableItems.length === 0}
        >
          <option value="">
            {availableItems.length === 0 ? `没有可添加的${label}` : `选择一个${label}`}
          </option>
          {availableItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!pendingResourceId}
        >
          <Plus />
          添加
        </Button>
      </div>

      <div className="min-h-24 space-y-2 rounded-[calc(var(--radius)*0.95)] border border-border/70 bg-muted/20 p-3">
        {selectedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">未添加</p>
        ) : (
          selectedItems.map((item) => {
            if (!item) {
              return null;
            }

            return (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/75 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {getHint?.(item) ?? item.description?.trim() ?? item.id}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onToggle(item.id)}
                  className="shrink-0"
                >
                  <X />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function RunnerSessionConfigFieldInput({
  field,
  control
}: {
  field: RunnerConfigField;
  control: ReturnType<typeof useForm<CreateSessionFormValues>>['control'];
}) {
  return (
    <Controller
      control={control}
      name={`runnerSessionConfig.${field.name}`}
      render={({ field: controllerField, fieldState }) => {
        if (field.kind === 'boolean') {
          return (
            <FormField
              label={field.label}
              description={field.description}
              error={fieldState.error?.message}
            >
              <label className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-3">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={Boolean(controllerField.value)}
                  onChange={(event) => controllerField.onChange(event.target.checked)}
                />
                <span className="text-sm text-foreground">启用</span>
              </label>
            </FormField>
          );
        }

        if (field.kind === 'enum') {
          return (
            <FormField
              label={field.label}
              description={field.description}
              error={fieldState.error?.message}
            >
              <select
                className={selectClassName}
                value={getRunnerConfigFieldValue(field, controllerField.value)}
                onChange={(event) => controllerField.onChange(event.target.value)}
              >
                {!field.required ? <option value="">未设置</option> : null}
                {field.enumOptions?.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          );
        }

        return (
          <FormField
            label={field.label}
            description={field.description}
            error={fieldState.error?.message}
          >
            <Input
              type={
                field.kind === 'number' || field.kind === 'integer'
                  ? 'number'
                  : 'text'
              }
              value={getRunnerConfigFieldValue(field, controllerField.value)}
              onChange={(event) => controllerField.onChange(event.target.value)}
            />
          </FormField>
        );
      }}
    />
  );
}

function InitialInputConfigFieldInput({
  field,
  control
}: {
  field: RunnerConfigField;
  control: ReturnType<typeof useForm<CreateSessionFormValues>>['control'];
}) {
  return (
    <Controller
      control={control}
      name={`initialInputConfig.${field.name}`}
      render={({ field: controllerField, fieldState }) => {
        if (field.kind === 'boolean') {
          return (
            <FormField
              label={field.label}
              description={field.description}
              error={fieldState.error?.message}
            >
              <label className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-3">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={Boolean(controllerField.value)}
                  onChange={(event) => controllerField.onChange(event.target.checked)}
                />
                <span className="text-sm text-foreground">启用</span>
              </label>
            </FormField>
          );
        }

        if (field.kind === 'enum') {
          return (
            <FormField
              label={field.label}
              description={field.description}
              error={fieldState.error?.message}
            >
              <select
                className={selectClassName}
                value={getRunnerConfigFieldValue(field, controllerField.value)}
                onChange={(event) => controllerField.onChange(event.target.value)}
              >
                {!field.required ? <option value="">未设置</option> : null}
                {field.enumOptions?.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          );
        }

        return (
          <FormField
            label={field.label}
            description={field.description}
            error={fieldState.error?.message}
          >
            <Input
              type={
                field.kind === 'number' || field.kind === 'integer'
                  ? 'number'
                  : 'text'
              }
              value={getRunnerConfigFieldValue(field, controllerField.value)}
              onChange={(event) => controllerField.onChange(event.target.value)}
            />
          </FormField>
        );
      }}
    />
  );
}

function SetupSection({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[calc(var(--radius)*1.0)] border border-border/70 bg-muted/15 p-4 ${className ?? ''}`}
    >
      <div className="mb-4">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function formatConfigValue(value: unknown) {
  if (value == null) {
    return '未设置';
  }

  if (typeof value === 'boolean') {
    return value ? '启用' : '关闭';
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function formatFieldKindLabel(field: RunnerConfigField) {
  switch (field.kind) {
    case 'string':
      return 'string';
    case 'url':
      return 'url';
    case 'number':
      return 'number';
    case 'integer':
      return 'integer';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return 'enum';
    default:
      return field.kind;
  }
}

function isRunnerConfigJsonSchema(value: unknown): value is RunnerConfigJsonSchema {
  return typeof value === 'object' && value !== null;
}

function toRunnerConfigJsonSchema(value: unknown): RunnerConfigJsonSchema | undefined {
  return isRunnerConfigJsonSchema(value) ? value : undefined;
}

function ReadonlyRunnerConfigSection({
  title,
  schema,
  values,
  emptyLabel = '未配置'
}: {
  title: string;
  schema: RunnerConfigJsonSchema | undefined;
  values: Record<string, unknown> | undefined;
  emptyLabel?: string;
}) {
  const parsedSchema = useMemo(() => parseRunnerConfigSchema(schema), [schema]);
  const hasValues = Boolean(values && Object.keys(values).length > 0);

  return (
    <SetupSection title={title}>
      {!hasValues ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : parsedSchema.supported && parsedSchema.fields.length > 0 ? (
        <div className="space-y-3">
          {parsedSchema.fields.map((field) => (
            <div
              key={field.name}
              className="rounded-lg border border-border/70 bg-background/70 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{field.label}</p>
                <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {formatFieldKindLabel(field)}
                </span>
              </div>
              {field.description ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {field.description}
                </p>
              ) : null}
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/30 px-2 py-1.5 text-xs text-foreground">
                {formatConfigValue(values?.[field.name])}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-foreground">
          {JSON.stringify(values, null, 2)}
        </pre>
      )}
    </SetupSection>
  );
}

function RunnerSchemaSection({
  title,
  schema,
  description,
  emptyLabel = '当前未提供 schema'
}: {
  title: string;
  schema: RunnerConfigJsonSchema | undefined;
  description?: string;
  emptyLabel?: string;
}) {
  const parsedSchema = useMemo(() => parseRunnerConfigSchema(schema), [schema]);

  return (
    <SetupSection title={title} description={description}>
      {!schema ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : parsedSchema.supported && parsedSchema.fields.length > 0 ? (
        <div className="space-y-3">
          {parsedSchema.fields.map((field) => (
            <div
              key={field.name}
              className="rounded-lg border border-border/70 bg-background/70 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{field.label}</p>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>{formatFieldKindLabel(field)}</span>
                  {field.required ? <span>required</span> : null}
                </div>
              </div>
              {field.description ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {field.description}
                </p>
              ) : null}
              {field.defaultValue !== undefined ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  默认值: {formatConfigValue(field.defaultValue)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-foreground">
          {JSON.stringify(schema, null, 2)}
        </pre>
      )}
    </SetupSection>
  );
}

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

function SessionDetailsSheet({
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
        <SheetHeader className="border-b border-border/70 px-5 py-4 text-left">
          <SheetTitle>Session 配置</SheetTitle>
          <SheetDescription>
            {projectName} · {session.runnerType}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                状态
              </p>
              <div className="mt-2">
                <SessionStatusBadge status={session.status} />
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
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

function CreateSessionPanel({
  projectId,
  runnerTypes,
  runners,
  profiles,
  resources,
  canCancel,
  onCancel,
  onCreated
}: {
  projectId: string;
  runnerTypes: RunnerTypeResponse[];
  runners: Awaited<ReturnType<typeof listAgentRunners>>;
  profiles: Profile[];
  resources: {
    skills: ResourceByKind['skills'][];
    mcps: ResourceByKind['mcps'][];
    rules: ResourceByKind['rules'][];
  };
  canCancel: boolean;
  onCancel: () => void;
  onCreated: (session: SessionDetail) => void;
}) {
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<CreateSessionFormValues>({
    resolver: zodResolver(createSessionFormSchema),
    defaultValues: buildCreateSessionFormValues()
  });
  const selectedRunnerId = useWatch({
    control: form.control,
    name: 'runnerId'
  });
  const selectedProfileId = useWatch({
    control: form.control,
    name: 'profileId'
  });
  const selectedSkillIds = useWatch({
    control: form.control,
    name: 'skillIds'
  });
  const selectedRuleIds = useWatch({
    control: form.control,
    name: 'ruleIds'
  });
  const selectedMcpIds = useWatch({
    control: form.control,
    name: 'mcpIds'
  });
  const initialMessageText = useWatch({
    control: form.control,
    name: 'initialMessageText'
  });
  const initialRawInput = useWatch({
    control: form.control,
    name: 'initialRawInput'
  });

  const selectedRunner = useMemo(
    () => runners.find((runner) => runner.id === selectedRunnerId),
    [runners, selectedRunnerId]
  );
  const selectedRunnerType = useMemo(
    () =>
      runnerTypes.find((runnerType) => runnerType.id === selectedRunner?.type),
    [runnerTypes, selectedRunner?.type]
  );
  const sessionConfigSchema = useMemo(
    () => parseRunnerConfigSchema(selectedRunnerType?.runnerSessionConfigSchema),
    [selectedRunnerType]
  );
  const inputConfigSchema = useMemo(
    () => parseRunnerConfigSchema(selectedRunnerType?.inputSchema),
    [selectedRunnerType]
  );
  const structuredInputSchema = inputConfigSchema.supported ? inputConfigSchema : undefined;
  const primaryInputField = useMemo(() => {
    if (!structuredInputSchema) {
      return undefined;
    }

    return getPrimaryInputField(structuredInputSchema.fields);
  }, [structuredInputSchema]);
  const additionalInputFields = useMemo(() => {
    if (!structuredInputSchema) {
      return [];
    }

    return getAdditionalInputFields(structuredInputSchema, primaryInputField);
  }, [primaryInputField, structuredInputSchema]);
  const supportsStructuredInitialInput = Boolean(
    structuredInputSchema && primaryInputField
  );
  const hasInitialMessageDraft = supportsStructuredInitialInput
    ? (initialMessageText?.trim().length ?? 0) > 0
    : (initialRawInput?.trim().length ?? 0) > 0;

  const profileDetailQuery = useQuery({
    queryKey: selectedProfileId
      ? queryKeys.profiles.detail(selectedProfileId)
      : queryKeys.profiles.list(),
    queryFn: () => getProfile(selectedProfileId!),
    enabled: Boolean(selectedProfileId)
  });

  useEffect(() => {
    if (runners.length > 0 && !selectedRunnerId) {
      form.setValue('runnerId', runners[0].id);
    }
  }, [form, runners, selectedRunnerId]);

  useEffect(() => {
    if (!sessionConfigSchema.supported) {
      form.setValue('runnerSessionConfig', {});
      return;
    }

    form.setValue(
      'runnerSessionConfig',
      buildRunnerConfigInitialValues(sessionConfigSchema.fields)
    );
  }, [form, selectedRunnerType?.id, sessionConfigSchema]);

  useEffect(() => {
    if (!structuredInputSchema) {
      form.setValue('initialInputConfig', {});
      form.setValue('initialMessageText', '');
      form.setValue('initialRawInput', '');
      return;
    }

    form.setValue(
      'initialInputConfig',
      buildAdditionalInputInitialValues(additionalInputFields)
    );
    form.setValue('initialMessageText', '');
    form.setValue('initialRawInput', '');
  }, [additionalInputFields, form, selectedRunnerType?.id, structuredInputSchema]);

  useEffect(() => {
    if (!selectedProfileId || !profileDetailQuery.data) {
      return;
    }

    form.setValue(
      'skillIds',
      profileDetailQuery.data.skills.map((item) => item.id)
    );
    form.setValue(
      'ruleIds',
      profileDetailQuery.data.rules.map((item) => item.id)
    );
    form.setValue(
      'mcpIds',
      profileDetailQuery.data.mcps.map((item) => item.id)
    );
  }, [form, profileDetailQuery.data, selectedProfileId]);

  const createMutation = useMutation({
    mutationFn: async (values: CreateSessionFormValues) => {
      let runnerSessionConfig = values.runnerSessionConfig;
      if (sessionConfigSchema.supported) {
        const normalized = normalizeRunnerConfigValues(
          sessionConfigSchema.fields,
          values.runnerSessionConfig
        );
        const validationResult = sessionConfigSchema.validationSchema.safeParse(
          normalized
        );
        if (!validationResult.success) {
          for (const issue of validationResult.error.issues) {
            const fieldName = issue.path[0];
            if (typeof fieldName === 'string') {
              form.setError(`runnerSessionConfig.${fieldName}`, {
                message: issue.message
              });
            }
          }
          throw new Error('Session 配置校验失败');
        }

        runnerSessionConfig = validationResult.data;
      }

      const initialMessageTextValue = values.initialMessageText?.trim() ?? '';
      const initialRawInputValue = values.initialRawInput?.trim() ?? '';
      const initialInput = supportsStructuredInitialInput
        ? initialMessageTextValue.length > 0
          ? buildStructuredMessagePayload({
              schema: structuredInputSchema!,
              primaryField: primaryInputField!,
              composerText: initialMessageTextValue,
              additionalValues: values.initialInputConfig
            }).input
          : undefined
        : initialRawInputValue.length > 0
          ? (() => {
              const parsed = parseSessionInputText(initialRawInputValue);
              if (!parsed.data) {
                throw new Error(parsed.error ?? '首条消息输入校验失败');
              }
              return parsed.data.input;
            })()
          : undefined;

      return createSession(
        buildCreateSessionPayload(projectId, {
          ...values,
          runnerSessionConfig
        }, profileDetailQuery.data, initialInput)
      );
    },
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.list(projectId)
      });
      queryClient.setQueryData(sessionQueryKeys.detail(session.id), session);
      onCreated(session);
    }
  });

  const toggleSelection = (
    fieldName: 'skillIds' | 'ruleIds' | 'mcpIds',
    resourceId: string
  ) => {
    const currentValue = form.getValues(fieldName);
    const nextValue = currentValue.includes(resourceId)
      ? currentValue.filter((id) => id !== resourceId)
      : [...currentValue, resourceId];
    form.setValue(fieldName, nextValue, {
      shouldDirty: true
    });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createMutation.mutateAsync(values);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'Session 配置校验失败' ||
          error.message === '首条消息输入校验失败')
      ) {
        return;
      }
      const apiError = toApiRequestError(error);
      setSubmitError(apiError.message);
      handleError(error);
    }
  });

  return (
    <div className="flex min-h-[36rem] flex-col xl:min-h-[calc(100vh-14rem)]">
      <div className="flex flex-1 flex-col px-2 py-2 sm:px-4 sm:py-4">
        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>创建失败</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col pt-10 sm:pt-14">
          <div className="rounded-[30px] border border-border/60 bg-background/95 p-5 shadow-[0_28px_80px_-36px_hsl(var(--foreground)/0.18)] sm:p-6">
            {supportsStructuredInitialInput ? (
              <FormField label="" error={form.formState.errors.initialMessageText?.message}>
                <Textarea
                  rows={9}
                  placeholder="发一条消息开始新会话"
                  className="min-h-40 resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-7 shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-44"
                  {...form.register('initialMessageText')}
                />
              </FormField>
            ) : (
              <FormField
                label=""
                error={form.formState.errors.initialRawInput?.message}
                description="当前 RunnerType 的 input schema 不适合文本输入，请直接填写原始 JSON。"
              >
                <Textarea
                  rows={10}
                  placeholder='{\n  "prompt": ""\n}'
                  className="min-h-36 resize-none border-0 bg-transparent px-0 py-0 font-mono text-sm shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-40"
                  {...form.register('initialRawInput')}
                />
              </FormField>
            )}

            <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
                <select
                  className={`${selectClassName} h-9 w-auto min-w-[8.5rem] rounded-full bg-background/80 px-3 py-1.5 text-xs whitespace-nowrap`}
                  value={selectedRunnerId}
                  onChange={(event) => form.setValue('runnerId', event.target.value)}
                >
                  {runners.map((runner) => (
                    <option key={runner.id} value={runner.id}>
                      {runner.name}
                    </option>
                  ))}
                </select>

                <select
                  className={`${selectClassName} h-9 w-auto min-w-[8rem] rounded-full bg-background/80 px-3 py-1.5 text-xs whitespace-nowrap`}
                  value={selectedProfileId ?? ''}
                  onChange={(event) => form.setValue('profileId', event.target.value)}
                >
                  <option value="">Profile</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full px-3 text-xs text-muted-foreground whitespace-nowrap"
                  onClick={() => setAdvancedOpen(true)}
                >
                  <SlidersHorizontal />
                  高级设置
                </Button>
              </div>

              <div className="flex items-center justify-end gap-2">
                {canCancel ? (
                  <Button variant="ghost" size="sm" onClick={onCancel}>
                    取消
                  </Button>
                ) : null}
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={createMutation.isPending || !hasInitialMessageDraft}
                  className="h-10 min-w-24 rounded-full px-5 shadow-sm"
                >
                  {createMutation.isPending ? <LoaderCircle className="animate-spin" /> : null}
                  发送
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="border-b border-border/70 px-5 py-4 text-left">
            <SheetTitle>高级设置</SheetTitle>
            <SheetDescription>资源、输入参数和会话参数。</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-5 py-5">
            {additionalInputFields.length > 0 ? (
              <SetupSection title="输入参数">
                <div className="grid gap-4">
                  {additionalInputFields.map((field) => (
                    <InitialInputConfigFieldInput
                      key={field.name}
                      field={field}
                      control={form.control}
                    />
                  ))}
                </div>
              </SetupSection>
            ) : null}

            {sessionConfigSchema.supported && sessionConfigSchema.fields.length > 0 ? (
              <SetupSection title="会话参数">
                <div className="grid gap-4">
                  {sessionConfigSchema.fields.map((field) => (
                    <RunnerSessionConfigFieldInput
                      key={field.name}
                      field={field}
                      control={form.control}
                    />
                  ))}
                </div>
              </SetupSection>
            ) : null}

            <SetupSection title="资源">
              <div className="grid gap-5 xl:grid-cols-2">
                <ResourceSelectionSection
                  label="技能"
                  items={resources.skills}
                  value={selectedSkillIds}
                  onToggle={(resourceId) => toggleSelection('skillIds', resourceId)}
                />
                <ResourceSelectionSection
                  label="规则"
                  items={resources.rules}
                  value={selectedRuleIds}
                  onToggle={(resourceId) => toggleSelection('ruleIds', resourceId)}
                />
                <ResourceSelectionSection
                  label="MCP"
                  items={resources.mcps}
                  value={selectedMcpIds}
                  onToggle={(resourceId) => toggleSelection('mcpIds', resourceId)}
                  getHint={(item) =>
                    typeof item.content === 'object' && item.content
                      ? item.content.command
                      : undefined
                  }
                />
              </div>
            </SetupSection>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SessionList({
  sessions,
  runnerNameById,
  selectedSessionId,
  isCreating,
  onSelect,
  onCreate
}: {
  sessions: SessionSummary[];
  runnerNameById: Record<string, string>;
  selectedSessionId: string | null;
  isCreating: boolean;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
}) {
  return (
    <SurfaceCard className="self-start overflow-hidden p-0 xl:sticky xl:top-8">
      <div className="border-b border-border/70 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">会话</p>
            <p className="text-xs text-muted-foreground">{sessions.length} 条</p>
          </div>
          <Button size="sm" onClick={onCreate} variant={isCreating ? 'secondary' : 'default'}>
            <Plus />
            新建
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-5">
          {isCreating ? (
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium text-foreground">正在配置新 Session</p>
              <p className="text-sm text-muted-foreground">
                创建完成后，这里会出现你的会话列表。
              </p>
            </div>
          ) : (
            <EmptyState
              title="还没有 Session"
              description="先创建一个 Session，再开始发送消息。"
              action={
                <Button onClick={onCreate}>
                  <MessageSquarePlus />
                  新建 Session
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => {
            const isSelected = session.id === selectedSessionId;
            const title = runnerNameById[session.runnerId] ?? session.runnerType;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                className={`w-full border-b border-border/60 px-4 py-3.5 text-left transition-colors sm:px-5 ${
                  isSelected
                    ? 'bg-muted/35 shadow-[inset_2px_0_0_0_hsl(var(--primary))]'
                    : 'hover:bg-muted/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {title}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {formatRelativeTime(session.updatedAt)}
                    </p>
                  </div>
                  <Badge variant={isSelected ? 'secondary' : 'outline'} className="rounded-full">
                    {getSessionStatusLabel(session.status)}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </SurfaceCard>
  );
}

export function ProjectSessionsPage() {
  const handleError = useErrorMessage();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [runtimeStateBySessionId, setRuntimeStateBySessionId] = useState<
    Record<string, SessionMessageRuntimeMap>
  >({});
  const {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects,
    goToProjectTab
  } = useProjectPageData();

  const [
    runnerTypesQuery,
    runnersQuery,
    profilesQuery,
    skillsQuery,
    mcpsQuery,
    rulesQuery
  ] = useQueries({
    queries: [
      {
        queryKey: queryKeys.agentRunnerTypes.all,
        queryFn: listAgentRunnerTypes
      },
      {
        queryKey: queryKeys.agentRunners.list(),
        queryFn: () => listAgentRunners()
      },
      {
        queryKey: queryKeys.profiles.list(),
        queryFn: listProfiles
      },
      {
        queryKey: queryKeys.resources.list('skills'),
        queryFn: () => listResources('skills')
      },
      {
        queryKey: queryKeys.resources.list('mcps'),
        queryFn: () => listResources('mcps')
      },
      {
        queryKey: queryKeys.resources.list('rules'),
        queryFn: () => listResources('rules')
      }
    ]
  });
  const sessionsQuery = useQuery({
    queryKey: id ? sessionQueryKeys.list(id) : sessionQueryKeys.lists(),
    queryFn: () => listSessions(id!),
    enabled: Boolean(id)
  });

  const selectedSessionId = searchParams.get('sessionId');
  const sessionDetailQuery = useQuery({
    queryKey: selectedSessionId
      ? sessionQueryKeys.detail(selectedSessionId)
      : sessionQueryKeys.all,
    queryFn: () => getSession(selectedSessionId!),
    enabled: Boolean(selectedSessionId)
  });
  const sessionMessagesQuery = useQuery({
    queryKey: selectedSessionId
      ? sessionQueryKeys.messages(selectedSessionId)
      : sessionQueryKeys.all,
    queryFn: () => listSessionMessages(selectedSessionId!),
    enabled: Boolean(selectedSessionId)
  });
  const selectedRunnerQuery = useQuery({
    queryKey: sessionDetailQuery.data?.runnerId
      ? queryKeys.agentRunners.detail(sessionDetailQuery.data.runnerId)
      : queryKeys.agentRunners.all,
    queryFn: () => getAgentRunner(sessionDetailQuery.data!.runnerId),
    enabled: Boolean(sessionDetailQuery.data?.runnerId)
  });

  const selectedSession = sessionDetailQuery.data;
  const runnerTypes = runnerTypesQuery.data ?? emptyRunnerTypes;
  const runners = runnersQuery.data ?? emptyRunnerSummaries;
  const profiles = profilesQuery.data ?? emptyProfiles;
  const resources = useMemo(
    () => ({
      skills: skillsQuery.data ?? emptySkills,
      mcps: mcpsQuery.data ?? emptyMcps,
      rules: rulesQuery.data ?? emptyRules
    }),
    [mcpsQuery.data, rulesQuery.data, skillsQuery.data]
  );
  const selectedRunnerType = useMemo(() => {
    if (!selectedSession) {
      return undefined;
    }

    return runnerTypes.find(
      (runnerType) => runnerType.id === selectedSession.runnerType
    );
  }, [runnerTypes, selectedSession]);
  const selectedRuntimeState = useMemo(
    () =>
      (selectedSessionId
        ? runtimeStateBySessionId[selectedSessionId]
        : undefined) ?? {},
    [runtimeStateBySessionId, selectedSessionId]
  );
  const selectedRunnerLabel = useMemo(() => {
    if (!selectedSession) {
      return '';
    }

    return (
      runners.find((runner) => runner.id === selectedSession.runnerId)?.name ??
      selectedSession.runnerType
    );
  }, [runners, selectedSession]);
  const runnerNameById = useMemo(
    () =>
      Object.fromEntries(runners.map((runner) => [runner.id, runner.name] as const)),
    [runners]
  );
  const selectedSessionMessagesReady = sessionMessagesQuery.status === 'success';
  const showCreatePanel =
    createPanelOpen || (sessionsQuery.data?.length ?? 0) === 0;

  const updateSessionRuntimeMessageState = useCallback(
    (
      sessionId: string,
      messageId: string,
      updater: (
        current: SessionMessageRuntimeMap[string]
      ) => SessionMessageRuntimeMap[string]
    ) => {
      setRuntimeStateBySessionId((current) => ({
        ...current,
        [sessionId]: {
          ...(current[sessionId] ?? {}),
          [messageId]: updater(current[sessionId]?.[messageId])
        }
      }));
    },
    []
  );

  useEffect(() => {
    const queryError =
      sessionsQuery.error ??
      sessionDetailQuery.error ??
      sessionMessagesQuery.error ??
      selectedRunnerQuery.error ??
      runnerTypesQuery.error ??
      runnersQuery.error ??
      profilesQuery.error ??
      skillsQuery.error ??
      mcpsQuery.error ??
      rulesQuery.error;

    if (!queryError) {
      return;
    }

    handleError(queryError);
  }, [
    handleError,
    mcpsQuery.error,
    profilesQuery.error,
    rulesQuery.error,
    selectedRunnerQuery.error,
    runnerTypesQuery.error,
    runnersQuery.error,
    sessionDetailQuery.error,
    sessionMessagesQuery.error,
    sessionsQuery.error,
    skillsQuery.error
  ]);

  useEffect(() => {
    const sessions = sessionsQuery.data ?? [];
    if (sessions.length === 0) {
      if (selectedSessionId) {
        startTransition(() => {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('sessionId');
            return next;
          });
        });
      }
      return;
    }

    if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) {
      return;
    }

    startTransition(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('sessionId', sessions[0].id);
        return next;
      });
    });
  }, [selectedSessionId, sessionsQuery.data, setSearchParams]);

  useSessionEventStream({
    scopeId: id,
    session: selectedSession,
    messages: sessionMessagesQuery.data ?? [],
    messagesReady: selectedSessionMessagesReady,
    queryClient,
    setRuntimeStateBySessionId,
    updateSessionRuntimeMessageState
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: SendSessionMessageInput) => {
      return sendSessionMessage(selectedSessionId!, payload);
    },
    onSuccess: (messages) => {
      if (!selectedSessionId) {
        return;
      }

      queryClient.setQueryData(sessionQueryKeys.messages(selectedSessionId), messages);
    }
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelSession(selectedSessionId!)
  });
  const reloadMutation = useMutation({
    mutationFn: () => reloadSession(selectedSessionId!)
  });
  const editMutation = useMutation({
    mutationFn: ({
      messageId,
      payload
    }: {
      messageId: string;
      payload: SendSessionMessageInput;
    }) => editSessionMessage(selectedSessionId!, messageId, payload)
  });
  const disposeMutation = useMutation({
    mutationFn: () => disposeSession(selectedSessionId!),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQueryKeys.detail(session.id), session);
      if (id) {
        queryClient.invalidateQueries({
          queryKey: sessionQueryKeys.list(id)
        }).catch(() => undefined);
      }
    }
  });

  const invalidateSessionThreadState = async (sessionId: string, scopeId: string) => {
    setRuntimeStateBySessionId((current) => ({
      ...current,
      [sessionId]: {}
    }));

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.messages(sessionId)
      }),
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.detail(sessionId)
      }),
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.list(scopeId)
      })
    ]);
  };

  if (isLoading || sessionsQuery.isPending) {
    return <LoadingState />;
  }

  if (isNotFound) {
    return (
      <EmptyState
        title="Project 不存在"
        description="当前 Project 不存在或已被删除。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  if (!id || !project || projects.length === 0) {
    return (
      <EmptyState
        title="暂无可用 Project"
        description="请先回到 Project 列表创建或选择一个 Project。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ProjectSectionHeader
        projects={projects}
        currentProjectId={id}
        activeTab="sessions"
        onProjectChange={(nextId) => goToProjectTab(nextId, 'sessions')}
        onTabChange={(tab) => goToProjectTab(id, tab)}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]">
        <SessionList
          sessions={sessionsQuery.data ?? []}
          runnerNameById={runnerNameById}
          selectedSessionId={selectedSessionId}
          isCreating={showCreatePanel}
          onSelect={(sessionId) => {
            setDetailsSheetOpen(false);
            setCreatePanelOpen(false);
            startTransition(() => {
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set('sessionId', sessionId);
                return next;
              });
            });
          }}
          onCreate={() => {
            setDetailsSheetOpen(false);
            setCreatePanelOpen(true);
          }}
        />

        <div className="min-w-0">
          {showCreatePanel ? (
            <CreateSessionPanel
              projectId={id}
              runnerTypes={runnerTypes}
              runners={runners}
              profiles={profiles}
              resources={resources}
              canCancel={(sessionsQuery.data?.length ?? 0) > 0}
              onCancel={() => {
                setDetailsSheetOpen(false);
                setCreatePanelOpen(false);
              }}
              onCreated={(session) => {
                setDetailsSheetOpen(false);
                setCreatePanelOpen(false);
                startTransition(() => {
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set('sessionId', session.id);
                    return next;
                  });
                });
              }}
            />
          ) : selectedSession ? (
            <SurfaceCard className="flex min-h-[44rem] flex-col overflow-hidden p-0 xl:h-[calc(100vh-11.5rem)]">
              <div className="border-b border-border/70 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {selectedRunnerLabel}
                      </span>
                      <SessionStatusBadge status={selectedSession.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(selectedSession.updatedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="查看配置"
                      title="查看配置"
                      onClick={() => setDetailsSheetOpen(true)}
                    >
                      <PanelRightOpen />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="刷新会话"
                      title="刷新会话"
                      onClick={() => {
                        void Promise.all([
                          queryClient.invalidateQueries({
                            queryKey: sessionQueryKeys.list(id)
                          }),
                          queryClient.invalidateQueries({
                            queryKey: sessionQueryKeys.detail(selectedSession.id)
                          }),
                          queryClient.invalidateQueries({
                            queryKey: sessionQueryKeys.messages(selectedSession.id)
                          })
                        ]).catch(handleError);
                      }}
                    >
                      <RefreshCw />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="销毁会话"
                      title="销毁会话"
                      disabled={
                        selectedSession.status === SessionStatusEnum.Disposing ||
                        selectedSession.status === SessionStatusEnum.Disposed ||
                        disposeMutation.isPending
                      }
                      onClick={() => {
                        void disposeMutation.mutateAsync().catch(handleError);
                      }}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>

              <SessionAssistantThread
                key={selectedSession.id}
                session={selectedSession}
                messages={sessionMessagesQuery.data ?? []}
                runnerType={selectedRunnerType}
                runtimeState={selectedRuntimeState}
                onSend={async (payload) => {
                  try {
                    await sendMutation.mutateAsync(payload);
                  } catch (error) {
                    const apiError = toApiRequestError(error);
                    throw new ApiRequestError({
                      code: apiError.code,
                      message: apiError.message,
                      data: apiError.data
                    });
                  }
                }}
                onCancel={async () => {
                  try {
                    await cancelMutation.mutateAsync();
                  } catch (error) {
                    const apiError = toApiRequestError(error);
                    throw new ApiRequestError({
                      code: apiError.code,
                      message: apiError.message,
                      data: apiError.data
                    });
                  }
                }}
                onReload={async () => {
                  if (!id) {
                    return;
                  }

                  try {
                    await reloadMutation.mutateAsync();
                    await invalidateSessionThreadState(selectedSession.id, id);
                  } catch (error) {
                    const apiError = toApiRequestError(error);
                    throw new ApiRequestError({
                      code: apiError.code,
                      message: apiError.message,
                      data: apiError.data
                    });
                  }
                }}
                onEdit={async (messageId, payload) => {
                  if (!id) {
                    return;
                  }

                  try {
                    await editMutation.mutateAsync({
                      messageId,
                      payload
                    });
                    await invalidateSessionThreadState(selectedSession.id, id);
                  } catch (error) {
                    const apiError = toApiRequestError(error);
                    throw new ApiRequestError({
                      code: apiError.code,
                      message: apiError.message,
                      data: apiError.data
                    });
                  }
                }}
              />

              <SessionDetailsSheet
                open={detailsSheetOpen && !showCreatePanel}
                onOpenChange={setDetailsSheetOpen}
                projectName={project.name}
                session={selectedSession}
                runnerDetail={selectedRunnerQuery.data}
                runnerType={selectedRunnerType}
                runners={runners}
                resources={resources}
              />
            </SurfaceCard>
          ) : (
            <SurfaceCard className="flex min-h-[32rem] items-center justify-center">
              <EmptyState
                title="选择 Session"
                description="或新建一个"
                action={
                  <Button
                    onClick={() => {
                      setDetailsSheetOpen(false);
                      setCreatePanelOpen(true);
                    }}
                  >
                    <Plus />
                    新建 Session
                  </Button>
                }
              />
            </SurfaceCard>
          )}
        </div>
      </div>

    </div>
  );
}
