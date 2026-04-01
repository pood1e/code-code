import {
  type ReactNode,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import type {
  Profile,
  ResourceByKind,
  RunnerTypeResponse,
  SessionDetail,
  SessionMessageDetail,
  SessionStatus,
  SessionSummary
} from '@agent-workbench/shared';
import {
  SessionStatus as SessionStatusEnum,
  sendSessionMessageInputSchema
} from '@agent-workbench/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  LoaderCircle,
  MessageSquarePlus,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';

import { listAgentRunners, listAgentRunnerTypes } from '@/api/agent-runners';
import { getProfile, listProfiles } from '@/api/profiles';
import { listResources } from '@/api/resources';
import {
  cancelSession,
  createSession,
  createSessionEventSource,
  disposeSession,
  editSessionMessage,
  getSession,
  listSessionMessages,
  listSessions,
  parseSessionEvent,
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
import { SessionAssistantThread } from '@/features/chat/runtime/assistant-ui/SessionAssistantThread';
import type {
  SessionMessageRuntimeMap
} from '@/features/chat/runtime/assistant-ui/thread-adapter';
import {
  getSessionLastEventId
} from '@/features/chat/runtime/assistant-ui/thread-adapter';
import {
  buildRunnerConfigInitialValues,
  getRunnerConfigFieldValue,
  normalizeRunnerConfigValues,
  parseRunnerConfigSchema,
  type RunnerConfigField
} from '@/pages/agent-runners/agent-runner.utils';
import { ProjectSectionHeader } from '@/pages/projects/ProjectSectionHeader';
import {
  applyOutputChunkToMessages,
  buildCreateSessionFormValues,
  buildCreateSessionPayload,
  createSessionFormSchema,
  getSessionStatusLabel,
  type CreateSessionFormValues
} from '@/pages/projects/project-sessions.utils';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { queryKeys } from '@/query/query-keys';

const selectClassName =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50';
const emptyRunnerTypes: RunnerTypeResponse[] = [];
const emptyProfiles: Profile[] = [];
const emptySkills: ResourceByKind['skills'][] = [];
const emptyMcps: ResourceByKind['mcps'][] = [];
const emptyRules: ResourceByKind['rules'][] = [];
const sessionQueryKeys = queryKeys.sessions;

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
  runners,
  resources
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  session: SessionDetail;
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
  const runnerSessionConfigText =
    Object.keys(session.runnerSessionConfig).length > 0
      ? JSON.stringify(session.runnerSessionConfig, null, 2)
      : null;

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

          <SetupSection title="资源快照">
            <div className="space-y-4">
              <SessionDetailList label="Skills" values={skillNames} />
              <SessionDetailList label="Rules" values={ruleNames} />
              <SessionDetailList label="MCPs" values={mcpNames} />
            </div>
          </SetupSection>

          {runnerSessionConfigText ? (
            <SetupSection title="Runner Session Config">
              <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-foreground">
                {runnerSessionConfigText}
              </pre>
            </SetupSection>
          ) : null}
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

      return createSession(
        buildCreateSessionPayload(projectId, {
          ...values,
          runnerSessionConfig
        }, profileDetailQuery.data)
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
      if (error instanceof Error && error.message === 'Session 配置校验失败') {
        return;
      }
      const apiError = toApiRequestError(error);
      setSubmitError(apiError.message);
      handleError(error);
    }
  });

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">新建 Session</h1>
          </div>
          {canCancel ? (
            <Button variant="outline" onClick={onCancel}>
              取消
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>创建失败</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
          <div className="space-y-5">
            <SetupSection title="基础设置">
              <div className="space-y-4">
                <FormField
                  label="AgentRunner"
                  error={form.formState.errors.runnerId?.message}
                >
                  <select
                    className={selectClassName}
                    value={selectedRunnerId}
                    onChange={(event) => form.setValue('runnerId', event.target.value)}
                  >
                    {runners.map((runner) => (
                      <option key={runner.id} value={runner.id}>
                        {runner.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Profile 快捷填充">
                  <select
                    className={selectClassName}
                    value={selectedProfileId ?? ''}
                    onChange={(event) => form.setValue('profileId', event.target.value)}
                  >
                    <option value="">不使用 Profile</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </SetupSection>

            {sessionConfigSchema.supported && sessionConfigSchema.fields.length > 0 ? (
              <SetupSection title="Runner Session Config">
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
          </div>

          <SetupSection title="资源">
            <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              <ResourceSelectionSection
                label="Skills"
                items={resources.skills}
                value={selectedSkillIds}
                onToggle={(resourceId) => toggleSelection('skillIds', resourceId)}
              />
              <ResourceSelectionSection
                label="Rules"
                items={resources.rules}
                value={selectedRuleIds}
                onToggle={(resourceId) => toggleSelection('ruleIds', resourceId)}
              />
              <ResourceSelectionSection
                label="MCPs"
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
      </div>

      <div className="border-t border-border/70 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            已选 {selectedSkillIds.length} Skills · {selectedRuleIds.length} Rules ·{' '}
            {selectedMcpIds.length} MCPs
          </p>
          <Button onClick={() => void handleSubmit()} disabled={createMutation.isPending}>
            {createMutation.isPending ? <LoaderCircle className="animate-spin" /> : null}
            创建并进入会话
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}

function SessionList({
  sessions,
  selectedSessionId,
  isCreating,
  onSelect,
  onCreate
}: {
  sessions: SessionSummary[];
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
            <p className="text-sm font-semibold text-foreground">Sessions</p>
            <p className="text-xs text-muted-foreground">{sessions.length}</p>
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
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                className={`w-full border-b border-border/60 px-4 py-4 text-left transition-colors sm:px-5 ${
                  isSelected
                    ? 'bg-muted/35 shadow-[inset_2px_0_0_0_hsl(var(--primary))]'
                    : 'hover:bg-muted/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {session.runnerType}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {session.id.slice(0, 8)} ·{' '}
                      {new Date(session.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <SessionStatusBadge status={session.status} />
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
  const [streamNonce, setStreamNonce] = useState(0);
  const [runtimeStateBySessionId, setRuntimeStateBySessionId] = useState<
    Record<string, SessionMessageRuntimeMap>
  >({});
  const reconnectTimerRef = useRef<number | null>(null);
  const lastEventIdRef = useRef(0);
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

  const selectedSession = sessionDetailQuery.data;
  const runnerTypes = runnerTypesQuery.data ?? emptyRunnerTypes;
  const runners = runnersQuery.data ?? [];
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
  const showCreatePanel =
    createPanelOpen || (sessionsQuery.data?.length ?? 0) === 0;

  useEffect(() => {
    const queryError =
      sessionsQuery.error ??
      sessionDetailQuery.error ??
      sessionMessagesQuery.error ??
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

  useEffect(() => {
    const messages = sessionMessagesQuery.data ?? [];
    lastEventIdRef.current = getSessionLastEventId(messages);
  }, [sessionMessagesQuery.data, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      return;
    }

    const sessionId = selectedSessionId;
    let cancelled = false;
    const source = createSessionEventSource(sessionId, lastEventIdRef.current);

    const onChunk = (event: Event) => {
      if (cancelled) {
        return;
      }

      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
        return;
      }

      const chunk = parseSessionEvent(event);
      lastEventIdRef.current = Math.max(lastEventIdRef.current, chunk.eventId);

      if (chunk.kind === 'session_status') {
        queryClient.setQueryData<SessionDetail | undefined>(
          sessionQueryKeys.detail(sessionId),
          (current) =>
            current
              ? {
                  ...current,
                  status: chunk.data.status
                }
              : current
        );
        queryClient.setQueryData<SessionSummary[] | undefined>(
          id ? sessionQueryKeys.list(id) : sessionQueryKeys.lists(),
          (current) =>
            current?.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    status: chunk.data.status
                  }
                : session
            )
        );
        if (chunk.data.status !== SessionStatusEnum.Running) {
          setRuntimeStateBySessionId((current) => ({
            ...current,
            [sessionId]: Object.fromEntries(
              Object.entries(current[sessionId] ?? {}).map(
                ([messageId, value]) => [
                  messageId,
                  value
                    ? {
                        ...value,
                        thinkingText: undefined
                      }
                    : value
                ]
              )
            )
          }));
        }
        return;
      }

      if (chunk.kind === 'thinking_delta' && chunk.messageId) {
        const messageId = chunk.messageId;
        setRuntimeStateBySessionId((current) => ({
          ...current,
          [sessionId]: {
            ...(current[sessionId] ?? {}),
            [messageId]: {
              ...(current[sessionId]?.[messageId] ?? {}),
              thinkingText:
                chunk.data.accumulatedText ??
                `${current[sessionId]?.[messageId]?.thinkingText ?? ''}${chunk.data.deltaText}`
            }
          }
        }));
        return;
      }

      if (chunk.kind === 'usage' && chunk.messageId) {
        const messageId = chunk.messageId;
        setRuntimeStateBySessionId((current) => ({
          ...current,
          [sessionId]: {
            ...(current[sessionId] ?? {}),
            [messageId]: {
              ...(current[sessionId]?.[messageId] ?? {}),
              usage: chunk.data
            }
          }
        }));
        return;
      }

      if (
        chunk.kind === 'message_delta' ||
        chunk.kind === 'message_result' ||
        chunk.kind === 'error' ||
        chunk.kind === 'tool_use'
      ) {
        queryClient.setQueryData<SessionMessageDetail[] | undefined>(
          sessionQueryKeys.messages(sessionId),
          (current) =>
            current ? applyOutputChunkToMessages(current, chunk) : current
        );

        if (
          (chunk.kind === 'message_result' || chunk.kind === 'error') &&
          chunk.messageId
        ) {
          const messageId = chunk.messageId;
          setRuntimeStateBySessionId((current) => ({
            ...current,
            [sessionId]: {
              ...(current[sessionId] ?? {}),
              [messageId]: {
                ...(current[sessionId]?.[messageId] ?? {}),
                thinkingText: undefined,
                cancelledAt:
                  chunk.kind === 'error' && chunk.data.code === 'USER_CANCELLED'
                    ? new Date(chunk.timestampMs).toISOString()
                    : undefined
              }
            }
          }));
        }
      }
    };

    source.addEventListener('thinking_delta', onChunk);
    source.addEventListener('message_delta', onChunk);
    source.addEventListener('message_result', onChunk);
    source.addEventListener('error', onChunk);
    source.addEventListener('tool_use', onChunk);
    source.addEventListener('usage', onChunk);
    source.addEventListener('session_status', onChunk);
    source.addEventListener('done', onChunk);
    source.addEventListener('heartbeat', () => {});
    source.onerror = () => {
      source.close();
      if (cancelled) {
        return;
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        setStreamNonce((value) => value + 1);
      }, 1000);
    };

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      source.close();
    };
  }, [id, queryClient, selectedSessionId, streamNonce]);

  const sendMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof sendSessionMessageInputSchema.parse>) => {
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
      payload: ReturnType<typeof sendSessionMessageInputSchema.parse>;
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

      <div className="grid items-start gap-4 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
        <SessionList
          sessions={sessionsQuery.data ?? []}
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
            <SurfaceCard className="flex min-h-[42rem] flex-col overflow-hidden p-0 xl:h-[calc(100vh-14rem)]">
              <div className="border-b border-border/70 px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SessionStatusBadge status={selectedSession.status} />
                      <span className="text-sm font-medium text-foreground">
                        {selectedSession.runnerType}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {selectedSession.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {new Date(selectedSession.updatedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDetailsSheetOpen(true)}
                    >
                      <PanelRightOpen />
                      配置
                    </Button>
                    <Button
                      variant="outline"
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
                      刷新
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={
                        selectedSession.status === SessionStatusEnum.Disposing ||
                        selectedSession.status === SessionStatusEnum.Disposed ||
                        disposeMutation.isPending
                      }
                      onClick={() => {
                        void disposeMutation.mutateAsync().catch(handleError);
                      }}
                    >
                      <Trash2 />
                      销毁
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
