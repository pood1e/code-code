import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  GitBranch,
  Loader2,
  Search,
  ShieldAlert,
  Wrench
} from 'lucide-react';
import {
  GovernanceChangePlanStatus,
  GovernanceChangeUnitStatus,
  GovernanceDeliveryArtifactStatus,
  GovernanceExecutionAttemptStatus,
  type ChangeUnit,
  type DeliveryArtifact,
  type Finding,
  type GovernanceExecutionAttemptSummary,
  type GovernanceIssueDetail,
  type GovernanceIssueSummary,
  type GovernanceReviewQueueItem,
  type GovernanceScopeOverview
} from '@agent-workbench/shared';

import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Badge } from '@/components/ui/badge';
import { GovernanceSessionHistorySheet } from './GovernanceSessionHistorySheet';

type GovernanceOrchestrationBoardProps = {
  scopeId: string;
  projectName: string;
  overview?: GovernanceScopeOverview;
  reviewQueue: GovernanceReviewQueueItem[];
  findings: Finding[];
  issues: GovernanceIssueSummary[];
  selectedIssue?: GovernanceIssueDetail;
  changeUnits: ChangeUnit[];
  deliveryArtifacts: DeliveryArtifact[];
};

type StageTone = 'idle' | 'queued' | 'running' | 'success' | 'attention';

type StageViewModel = {
  key: string;
  label: string;
  summary: string;
  detail: string;
  tone: StageTone;
  statusLabel: string;
  sessionId?: string | null;
  sessionTitle?: string;
};

type ActiveAgentItem = {
  key: string;
  label: string;
  title: string;
  status: GovernanceExecutionAttemptStatus;
  sessionId: string;
  updatedAt: string;
  detail: string;
  sessionTitle: string;
};

const ACTIVE_ATTEMPT_STATUSES = new Set<GovernanceExecutionAttemptStatus>([
  GovernanceExecutionAttemptStatus.Running,
  GovernanceExecutionAttemptStatus.WaitingRepair
]);

export function GovernanceOrchestrationBoard({
  scopeId,
  projectName,
  overview,
  reviewQueue,
  findings,
  issues,
  selectedIssue,
  changeUnits,
  deliveryArtifacts
}: GovernanceOrchestrationBoardProps) {
  const stages = buildStageViewModels({
    projectName,
    overview,
    reviewQueue,
    findings,
    issues,
    selectedIssue,
    changeUnits,
    deliveryArtifacts
  });
  const activeAgents = buildActiveAgentItems({
    projectName,
    overview,
    findings,
    issues,
    changeUnits
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
      <SurfaceCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">治理流水线</h3>
            <p className="text-sm text-muted-foreground">
              像看 GitHub Actions 一样看 baseline、discovery、triage、planning、execution
              和 review 当前卡在哪一步。
            </p>
          </div>
          {selectedIssue ? (
            <Badge variant="secondary">当前 Issue: {selectedIssue.title}</Badge>
          ) : (
            <Badge variant="outline">Project 级视图</Badge>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-[repeat(6,minmax(0,1fr))]">
          {stages.map((stage, index) => (
            <StageCard
              key={stage.key}
              scopeId={scopeId}
              stage={stage}
              showConnector={index < stages.length - 1}
            />
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">运行中 Agent</h3>
            <p className="text-sm text-muted-foreground">
              这里直接列出当前在跑的治理会话，点开就能看实时日志。
            </p>
          </div>
          <Badge variant="secondary">{activeAgents.length}</Badge>
        </div>

        {activeAgents.length > 0 ? (
          <div className="space-y-3">
            {activeAgents.map((agent) => (
              <div
                key={agent.key}
                className="rounded-xl border border-border/60 bg-muted/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{agent.label}</Badge>
                      <AttemptStatusBadge status={agent.status} />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{agent.title}</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {agent.detail}
                    </p>
                  </div>
                  <GovernanceSessionHistorySheet
                    scopeId={scopeId}
                    sessionId={agent.sessionId}
                    title={agent.sessionTitle}
                    description="直接查看当前治理 Agent 的会话历史和实时输出。"
                    triggerVariant="secondary"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="font-mono">session: {agent.sessionId}</span>
                  <span>updated: {formatTimestamp(agent.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            当前没有运行中的治理 Agent。运行 discovery、让 triage/planning/execution
            进入自动化后，这里会直接出现对应会话。
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

function StageCard({
  scopeId,
  stage,
  showConnector
}: {
  scopeId: string;
  stage: StageViewModel;
  showConnector: boolean;
}) {
  const visual = getStageToneVisual(stage.tone);

  return (
    <div className="flex items-stretch gap-2 lg:gap-3">
      <div className="min-w-0 flex-1">
        <div
          className={`relative h-full min-h-[188px] rounded-2xl border px-4 py-4 ${visual.cardClass}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div
              className={`flex size-9 items-center justify-center rounded-full border ${visual.iconShellClass}`}
            >
              <StageIcon stageKey={stage.key} tone={stage.tone} />
            </div>
            <Badge className={visual.badgeClass}>{stage.statusLabel}</Badge>
          </div>

          <div className="mt-4 space-y-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {stage.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {stage.summary}
              </p>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{stage.detail}</p>
          </div>

          {stage.sessionId && stage.sessionTitle ? (
            <div className="mt-4">
              <GovernanceSessionHistorySheet
                scopeId={scopeId}
                sessionId={stage.sessionId}
                title={stage.sessionTitle}
                description={`查看 ${stage.label} 阶段的完整 agent 会话。`}
              />
            </div>
          ) : null}
        </div>
      </div>

      {showConnector ? (
        <div className="hidden items-center justify-center lg:flex">
          <ArrowRight className="size-4 text-muted-foreground/60" />
        </div>
      ) : null}
    </div>
  );
}

function StageIcon({
  stageKey,
  tone
}: {
  stageKey: string;
  tone: StageTone;
}) {
  const iconClassName = getStageToneVisual(tone).iconClass;

  switch (stageKey) {
    case 'baseline':
      return <GitBranch className={iconClassName} />;
    case 'discovery':
      return <Search className={iconClassName} />;
    case 'triage':
      return <ShieldAlert className={iconClassName} />;
    case 'planning':
      return <Wrench className={iconClassName} />;
    case 'execution':
      return <Loader2 className={tone === 'running' ? `${iconClassName} animate-spin` : iconClassName} />;
    case 'review':
      return <AlertTriangle className={iconClassName} />;
    default:
      return <CircleDashed className={iconClassName} />;
  }
}

function AttemptStatusBadge({
  status
}: {
  status: GovernanceExecutionAttemptStatus;
}) {
  const visual = getAttemptStatusVisual(status);

  return <Badge className={visual.className}>{visual.label}</Badge>;
}

function buildStageViewModels(input: {
  projectName: string;
  overview?: GovernanceScopeOverview;
  reviewQueue: GovernanceReviewQueueItem[];
  findings: Finding[];
  issues: GovernanceIssueSummary[];
  selectedIssue?: GovernanceIssueDetail;
  changeUnits: ChangeUnit[];
  deliveryArtifacts: DeliveryArtifact[];
}): StageViewModel[] {
  const baseline = attemptStageView({
    label: 'Baseline',
    summaryFallback: input.overview?.repositoryProfile?.branch
      ? `branch ${input.overview.repositoryProfile.branch}`
      : '等待仓库画像',
    detailFallback: input.overview?.repositoryProfile
      ? `snapshot ${input.overview.repositoryProfile.snapshotAt}`
      : '先刷新仓库画像，生成最新仓库快照。',
    attempt: input.overview?.latestBaselineAttempt,
    sessionTitle: `${input.projectName} · Baseline 日志`
  });

  const discovery = attemptStageView({
    label: 'Discovery',
    summaryFallback:
      (input.overview?.findingCounts.pending ?? 0) > 0
        ? `${input.overview?.findingCounts.pending ?? 0} findings pending`
        : '等待问题发现',
    detailFallback: input.overview?.latestDiscoveryAttempt
      ? '自动发现仓库中的 bug、risk、debt 和治理缺口。'
      : '运行 discovery 后，这里会显示本轮发现状态。',
    attempt: input.overview?.latestDiscoveryAttempt,
    sessionTitle: `${input.projectName} · Discovery 日志`
  });

  const activeTriageFinding = input.findings.find((finding) =>
    isActiveAttempt(finding.latestTriageAttempt)
  );
  const triageAttentionFinding = input.findings.find(
    (finding) =>
      finding.latestTriageAttempt?.status ===
      GovernanceExecutionAttemptStatus.NeedsHumanReview
  );
  const triageAttempt =
    activeTriageFinding?.latestTriageAttempt ??
    triageAttentionFinding?.latestTriageAttempt ??
    null;
  const triageTone = triageAttempt
    ? mapAttemptTone(triageAttempt.status)
    : input.findings.length > 0
      ? 'queued'
      : input.issues.length > 0
        ? 'success'
        : 'idle';
  const triageStatusLabel = triageAttempt
    ? getAttemptStatusVisual(triageAttempt.status).label
    : input.findings.length > 0
      ? '待处理'
      : input.issues.length > 0
        ? 'backlog ready'
        : 'idle';
  const triageSummary = activeTriageFinding
    ? activeTriageFinding.title
    : triageAttentionFinding
      ? triageAttentionFinding.title
      : input.findings.length > 0
        ? `${input.findings.length} findings 等待 triage`
        : input.issues.length > 0
          ? `${input.issues.length} issues 已进入 backlog`
          : '暂无 triage 活动';
  const triageDetail = activeTriageFinding
    ? `自动归并 finding，session ${triageAttempt?.sessionId ?? '—'}`
    : triageAttentionFinding
      ? triageAttentionFinding.latestTriageAttempt?.failureMessage ??
        'triage 需要人工处理'
      : input.findings.length > 0
        ? '待处理 findings 会在这里进入 issue 创建或归并流程。'
        : '当前没有待 triage 的 findings。';

  const selectedPlanningAttempt =
    input.selectedIssue?.latestPlanningAttempt ?? null;
  const listPlanningIssue = input.issues.find((issue) =>
    isActiveAttempt(issue.latestPlanningAttempt)
  );
  const attentionPlanningIssue = input.issues.find(
    (issue) =>
      issue.latestPlanningAttempt?.status ===
      GovernanceExecutionAttemptStatus.NeedsHumanReview
  );
  const planningAttempt =
    selectedPlanningAttempt ??
    listPlanningIssue?.latestPlanningAttempt ??
    attentionPlanningIssue?.latestPlanningAttempt ??
    null;
  const planningOwner =
    input.selectedIssue ??
    listPlanningIssue ??
    attentionPlanningIssue ??
    null;
  const planningTone = planningAttempt
    ? mapAttemptTone(planningAttempt.status)
    : input.selectedIssue?.changePlan ||
        input.issues.some(
          (issue) => issue.latestChangePlanStatus === GovernanceChangePlanStatus.Approved
        )
      ? 'success'
      : input.issues.length > 0
        ? 'queued'
        : 'idle';
  const planningStatusLabel = planningAttempt
    ? getAttemptStatusVisual(planningAttempt.status).label
    : input.selectedIssue?.changePlan ||
        input.issues.some(
          (issue) => issue.latestChangePlanStatus === GovernanceChangePlanStatus.Approved
        )
      ? 'plan ready'
      : input.issues.length > 0
        ? '待规划'
        : 'idle';
  const planningSummary = planningOwner
    ? planningOwner.title
    : input.issues.length > 0
      ? `${input.issues.length} issues 可进入 planning`
      : '暂无 planning 活动';
  const planningDetail = planningAttempt
    ? planningAttempt.failureMessage ?? '生成修复目标、策略和 change units。'
    : input.selectedIssue?.changePlan
      ? '当前选中 issue 已有 change plan。'
      : input.issues.length > 0
        ? '选择一个 issue 后可以看到更细的 planning / execution 分支。'
        : '等待 triage 产出新的 issue。';

  const runningChangeUnits = input.changeUnits.filter((unit) =>
    isActiveAttempt(unit.latestExecutionAttempt)
  );
  const attentionChangeUnit = input.changeUnits.find(
    (unit) =>
      unit.latestExecutionAttempt?.status ===
      GovernanceExecutionAttemptStatus.NeedsHumanReview
  );
  const readyChangeUnits = input.changeUnits.filter((unit) =>
    [GovernanceChangeUnitStatus.Pending, GovernanceChangeUnitStatus.Ready].includes(
      unit.status
    )
  );
  const completedChangeUnits = input.changeUnits.filter((unit) =>
    [
      GovernanceChangeUnitStatus.Verified,
      GovernanceChangeUnitStatus.Committed,
      GovernanceChangeUnitStatus.Merged
    ].includes(unit.status)
  );
  const executionAttempt =
    runningChangeUnits[0]?.latestExecutionAttempt ??
    attentionChangeUnit?.latestExecutionAttempt ??
    null;
  const executionTone = executionAttempt
    ? mapAttemptTone(executionAttempt.status)
    : readyChangeUnits.length > 0
      ? 'queued'
      : completedChangeUnits.length > 0
        ? 'success'
        : 'idle';
  const executionStatusLabel = executionAttempt
    ? getAttemptStatusVisual(executionAttempt.status).label
    : readyChangeUnits.length > 0
      ? 'ready'
      : completedChangeUnits.length > 0
        ? 'verified'
        : 'idle';
  const executionSummary =
    runningChangeUnits.length > 0
      ? runningChangeUnits.length > 1
        ? `${runningChangeUnits.length} change units running`
        : runningChangeUnits[0]!.title
      : attentionChangeUnit
        ? attentionChangeUnit.title
        : readyChangeUnits.length > 0
          ? `${readyChangeUnits.length} change units ready`
          : completedChangeUnits.length > 0
            ? `${completedChangeUnits.length} change units finished`
            : '暂无 execution 活动';
  const executionDetail =
    runningChangeUnits.length > 0
      ? `自动执行变更与验证，当前 attempt ${executionAttempt?.attemptNo ?? '—'}`
      : attentionChangeUnit
        ? attentionChangeUnit.latestExecutionAttempt?.failureMessage ??
          '执行阶段需要人工接管'
        : readyChangeUnits.length > 0
          ? 'change plan 已拆解，等待进入执行。'
          : '当前没有可执行的 change unit。';

  const reviewAttentionItem = input.reviewQueue[0] ?? null;
  const reviewTone =
    input.reviewQueue.length > 0
      ? 'attention'
      : input.deliveryArtifacts.some(
            (artifact) => artifact.status === GovernanceDeliveryArtifactStatus.Submitted
          )
        ? 'queued'
        : input.deliveryArtifacts.length > 0
          ? 'success'
          : 'idle';
  const reviewStatusLabel =
    input.reviewQueue.length > 0
      ? 'needs review'
      : input.deliveryArtifacts.some(
            (artifact) => artifact.status === GovernanceDeliveryArtifactStatus.Submitted
          )
        ? 'submitted'
        : input.deliveryArtifacts.length > 0
          ? 'delivered'
          : 'idle';
  const reviewSummary = reviewAttentionItem
    ? `${input.reviewQueue.length} items waiting review`
    : input.deliveryArtifacts.length > 0
      ? `${input.deliveryArtifacts.length} delivery artifacts`
      : '暂无 review 队列';
  const reviewDetail = reviewAttentionItem
    ? `${reviewAttentionItem.title} · ${reviewAttentionItem.failureMessage ?? reviewAttentionItem.status}`
    : input.deliveryArtifacts.length > 0
      ? '最近交付产物和人工审核队列会统一显示在这里。'
      : '执行结果、delivery artifact 和人工处理项会在这里汇总。';

  return [
    baseline,
    discovery,
    {
      key: 'triage',
      label: 'Triage',
      summary: triageSummary,
      detail: triageDetail,
      tone: triageTone,
      statusLabel: triageStatusLabel,
      sessionId: triageAttempt?.sessionId ?? null,
      sessionTitle: triageAttempt?.sessionId
        ? `${triageSummary} · Triage 日志`
        : undefined
    },
    {
      key: 'planning',
      label: 'Planning',
      summary: planningSummary,
      detail: planningDetail,
      tone: planningTone,
      statusLabel: planningStatusLabel,
      sessionId: planningAttempt?.sessionId ?? null,
      sessionTitle: planningAttempt?.sessionId
        ? `${planningSummary} · Planning 日志`
        : undefined
    },
    {
      key: 'execution',
      label: 'Execution',
      summary: executionSummary,
      detail: executionDetail,
      tone: executionTone,
      statusLabel: executionStatusLabel,
      sessionId: executionAttempt?.sessionId ?? null,
      sessionTitle: executionAttempt?.sessionId
        ? `${executionSummary} · Execution 日志`
        : undefined
    },
    {
      key: 'review',
      label: 'Review',
      summary: reviewSummary,
      detail: reviewDetail,
      tone: reviewTone,
      statusLabel: reviewStatusLabel,
      sessionId: reviewAttentionItem?.sessionId ?? null,
      sessionTitle: reviewAttentionItem?.sessionId
        ? `${reviewAttentionItem.title} · Review 日志`
        : undefined
    }
  ];
}

function buildActiveAgentItems(input: {
  projectName: string;
  overview?: GovernanceScopeOverview;
  findings: Finding[];
  issues: GovernanceIssueSummary[];
  changeUnits: ChangeUnit[];
}) {
  const items: ActiveAgentItem[] = [];
  const seen = new Set<string>();

  const push = (item: ActiveAgentItem | null) => {
    if (!item || seen.has(item.key)) {
      return;
    }
    seen.add(item.key);
    items.push(item);
  };

  const baselineAttempt = input.overview?.latestBaselineAttempt;
  if (baselineAttempt && isActiveAttempt(baselineAttempt) && baselineAttempt.sessionId) {
    push({
      key: `baseline:${baselineAttempt.id}`,
      label: 'Baseline',
      title: '仓库画像生成',
      status: baselineAttempt.status,
      sessionId: baselineAttempt.sessionId,
      updatedAt: baselineAttempt.updatedAt,
      detail: '扫描仓库结构、分支和测试基线。',
      sessionTitle: `${input.projectName} · Baseline 日志`
    });
  }

  const discoveryAttempt = input.overview?.latestDiscoveryAttempt;
  if (
    discoveryAttempt &&
    isActiveAttempt(discoveryAttempt) &&
    discoveryAttempt.sessionId
  ) {
    push({
      key: `discovery:${discoveryAttempt.id}`,
      label: 'Discovery',
      title: '问题发现',
      status: discoveryAttempt.status,
      sessionId: discoveryAttempt.sessionId,
      updatedAt: discoveryAttempt.updatedAt,
      detail: '自动发现当前仓库中的治理问题。',
      sessionTitle: `${input.projectName} · Discovery 日志`
    });
  }

  for (const finding of input.findings) {
    const attempt = finding.latestTriageAttempt;
    if (!attempt || !isActiveAttempt(attempt) || !attempt.sessionId) {
      continue;
    }
    push({
      key: `triage:${attempt.id}`,
      label: 'Triage',
      title: finding.title,
      status: attempt.status,
      sessionId: attempt.sessionId,
      updatedAt: attempt.updatedAt,
      detail: '自动归并 finding 到现有 issue 或创建新 issue。',
      sessionTitle: `${finding.title} · Triage 日志`
    });
  }

  for (const issue of input.issues) {
    const attempt = issue.latestPlanningAttempt;
    if (!attempt || !isActiveAttempt(attempt) || !attempt.sessionId) {
      continue;
    }
    push({
      key: `planning:${attempt.id}`,
      label: 'Planning',
      title: issue.title,
      status: attempt.status,
      sessionId: attempt.sessionId,
      updatedAt: attempt.updatedAt,
      detail: '生成 change plan、change units 和 verification plan。',
      sessionTitle: `${issue.title} · Planning 日志`
    });
  }

  for (const changeUnit of input.changeUnits) {
    const attempt = changeUnit.latestExecutionAttempt;
    if (!attempt || !isActiveAttempt(attempt) || !attempt.sessionId) {
      continue;
    }
    push({
      key: `execution:${attempt.id}`,
      label: 'Execution',
      title: changeUnit.title,
      status: attempt.status,
      sessionId: attempt.sessionId,
      updatedAt: attempt.updatedAt,
      detail: '执行代码修改并跑验证。',
      sessionTitle: `${changeUnit.title} · Execution 日志`
    });
  }

  return items.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

function attemptStageView(input: {
  label: string;
  summaryFallback: string;
  detailFallback: string;
  attempt?: GovernanceExecutionAttemptSummary | null;
  sessionTitle: string;
}): StageViewModel {
  if (!input.attempt) {
    return {
      key: input.label.toLowerCase(),
      label: input.label,
      summary: input.summaryFallback,
      detail: input.detailFallback,
      tone: 'idle',
      statusLabel: 'idle'
    };
  }

  return {
    key: input.label.toLowerCase(),
    label: input.label,
    summary: input.summaryFallback,
    detail: input.attempt.failureMessage ?? input.detailFallback,
    tone: mapAttemptTone(input.attempt.status),
    statusLabel: getAttemptStatusVisual(input.attempt.status).label,
    sessionId: input.attempt.sessionId ?? null,
    sessionTitle: input.attempt.sessionId ? input.sessionTitle : undefined
  };
}

function mapAttemptTone(status: GovernanceExecutionAttemptStatus): StageTone {
  switch (status) {
    case GovernanceExecutionAttemptStatus.Succeeded:
    case GovernanceExecutionAttemptStatus.ResolvedByHuman:
      return 'success';
    case GovernanceExecutionAttemptStatus.Running:
      return 'running';
    case GovernanceExecutionAttemptStatus.Pending:
      return 'queued';
    case GovernanceExecutionAttemptStatus.WaitingRepair:
    case GovernanceExecutionAttemptStatus.Failed:
    case GovernanceExecutionAttemptStatus.NeedsHumanReview:
    case GovernanceExecutionAttemptStatus.Cancelled:
      return 'attention';
  }
}

function getAttemptStatusVisual(status: GovernanceExecutionAttemptStatus) {
  switch (status) {
    case GovernanceExecutionAttemptStatus.Pending:
      return {
        label: 'pending',
        className: 'border border-slate-300/80 bg-slate-100 text-slate-700'
      };
    case GovernanceExecutionAttemptStatus.Running:
      return {
        label: 'running',
        className: 'border border-sky-300/80 bg-sky-100 text-sky-800'
      };
    case GovernanceExecutionAttemptStatus.WaitingRepair:
      return {
        label: 'waiting repair',
        className: 'border border-amber-300/80 bg-amber-100 text-amber-800'
      };
    case GovernanceExecutionAttemptStatus.Succeeded:
      return {
        label: 'succeeded',
        className: 'border border-emerald-300/80 bg-emerald-100 text-emerald-800'
      };
    case GovernanceExecutionAttemptStatus.Failed:
      return {
        label: 'failed',
        className: 'border border-rose-300/80 bg-rose-100 text-rose-800'
      };
    case GovernanceExecutionAttemptStatus.NeedsHumanReview:
      return {
        label: 'needs review',
        className: 'border border-orange-300/80 bg-orange-100 text-orange-800'
      };
    case GovernanceExecutionAttemptStatus.ResolvedByHuman:
      return {
        label: 'resolved',
        className: 'border border-emerald-300/80 bg-emerald-100 text-emerald-800'
      };
    case GovernanceExecutionAttemptStatus.Cancelled:
      return {
        label: 'cancelled',
        className: 'border border-slate-300/80 bg-slate-100 text-slate-700'
      };
  }
}

function getStageToneVisual(tone: StageTone) {
  switch (tone) {
    case 'running':
      return {
        cardClass:
          'border-sky-200 bg-sky-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
        iconShellClass: 'border-sky-300/80 bg-white',
        badgeClass: 'border border-sky-300/80 bg-sky-100 text-sky-800',
        iconClass: 'size-4 text-sky-700'
      };
    case 'success':
      return {
        cardClass:
          'border-emerald-200 bg-emerald-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
        iconShellClass: 'border-emerald-300/80 bg-white',
        badgeClass:
          'border border-emerald-300/80 bg-emerald-100 text-emerald-800',
        iconClass: 'size-4 text-emerald-700'
      };
    case 'attention':
      return {
        cardClass:
          'border-orange-200 bg-orange-50/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
        iconShellClass: 'border-orange-300/80 bg-white',
        badgeClass: 'border border-orange-300/80 bg-orange-100 text-orange-800',
        iconClass: 'size-4 text-orange-700'
      };
    case 'queued':
      return {
        cardClass:
          'border-indigo-200 bg-indigo-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
        iconShellClass: 'border-indigo-300/80 bg-white',
        badgeClass: 'border border-indigo-300/80 bg-indigo-100 text-indigo-800',
        iconClass: 'size-4 text-indigo-700'
      };
    case 'idle':
      return {
        cardClass:
          'border-border/60 bg-muted/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
        iconShellClass: 'border-border/70 bg-background',
        badgeClass: 'border border-border/70 bg-background text-muted-foreground',
        iconClass: 'size-4 text-muted-foreground'
      };
  }
}

function isActiveAttempt(
  attempt: GovernanceExecutionAttemptSummary | null | undefined
): attempt is GovernanceExecutionAttemptSummary {
  return Boolean(attempt && ACTIVE_ATTEMPT_STATUSES.has(attempt.status));
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}
