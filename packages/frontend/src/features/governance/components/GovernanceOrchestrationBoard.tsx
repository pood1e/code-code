import {
  AlertTriangle,
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
import { cn } from '@/lib/utils';

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
  mode?: 'summary' | 'workspace';
};

type StageTone = 'idle' | 'queued' | 'running' | 'success' | 'attention';

type StageViewModel = {
  key: string;
  label: string;
  summary: string;
  detail?: string;
  tone: StageTone;
  statusLabel: string;
  activeCount?: number;
  sessionId?: string | null;
  sessionTitle?: string;
};

type StageVisual = {
  cardClass: string;
  iconShellClass: string;
  badgeClass: string;
  chipClass: string;
  iconClass: string;
  accentClass: string;
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
  deliveryArtifacts,
  mode = 'workspace'
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
  const isSummaryMode = mode === 'summary';

  return (
    <SurfaceCard className="border-border/60 bg-card p-3 shadow-none sm:p-4">
      <div
        className={cn(
          'grid gap-1.5',
          'sm:grid-cols-2 xl:grid-cols-6'
        )}
      >
        {stages.map((stage, index) => (
          <StageStripItem
            key={stage.key}
            scopeId={scopeId}
            stage={stage}
            stageIndex={index + 1}
            mode={isSummaryMode ? 'summary' : 'workspace'}
          />
        ))}
      </div>
    </SurfaceCard>
  );
}

function StageStripItem({
  scopeId,
  stage,
  stageIndex,
  mode
}: {
  scopeId: string;
  stage: StageViewModel;
  stageIndex: number;
  mode: 'summary' | 'workspace';
}) {
  const visual = getStageToneVisual(stage.tone);
  const isSummaryMode = mode === 'summary';
  const detailText = isSummaryMode
    ? stage.tone === 'attention'
      ? stage.detail
      : undefined
    : stage.detail;

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5',
        isSummaryMode ? 'min-h-[84px]' : 'min-h-[82px]',
        visual.cardClass
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground/80">
          {String(stageIndex).padStart(2, '0')}
        </span>
        <div
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full border',
            visual.iconShellClass
          )}
        >
          <StageIcon stageKey={stage.key} tone={stage.tone} />
        </div>
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {stage.label}
        </p>
      </div>

      <div className="mt-2 space-y-0.5">
        <p className="line-clamp-1 text-sm font-semibold leading-5 text-foreground">
          {stage.summary}
        </p>
        {detailText ? (
          <p className="line-clamp-1 text-xs leading-5 text-muted-foreground">
            {detailText}
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex min-h-[22px] items-end justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge className={visual.badgeClass}>{stage.statusLabel}</Badge>
          {stage.activeCount && stage.activeCount > 1 ? (
            <span className="text-[11px] text-muted-foreground">
              {stage.activeCount} active
            </span>
          ) : null}
        </div>
        {stage.sessionId && stage.sessionTitle ? (
          <GovernanceSessionHistorySheet
            scopeId={scopeId}
            sessionId={stage.sessionId}
            title={stage.sessionTitle}
            description={`查看 ${stage.label} 阶段的完整 agent 会话。`}
            triggerVariant="ghost"
          />
        ) : null}
      </div>
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
      return (
        <Loader2
          className={tone === 'running' ? `${iconClassName} animate-spin` : iconClassName}
        />
      );
    case 'review':
      return <AlertTriangle className={iconClassName} />;
    default:
      return <CircleDashed className={iconClassName} />;
  }
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
  const triageActiveFindings = input.findings.filter((finding) =>
    isActiveAttempt(finding.latestTriageAttempt)
  );
  const planningActiveIssues = input.issues.filter((issue) =>
    isActiveAttempt(issue.latestPlanningAttempt)
  );
  const executionRunningUnits = input.changeUnits.filter((unit) =>
    isActiveAttempt(unit.latestExecutionAttempt)
  );

  const baseline = attemptStageView({
    label: 'Baseline',
    summaryFallback: input.overview?.repositoryProfile?.branch
      ? `branch ${input.overview.repositoryProfile.branch}`
      : '等待仓库画像',
    detailFallback: input.overview?.repositoryProfile
      ? `snapshot ${input.overview.repositoryProfile.snapshotAt}`
      : undefined,
    attempt: input.overview?.latestBaselineAttempt,
    sessionTitle: `${input.projectName} · Baseline 日志`
  });

  const discovery = attemptStageView({
    label: 'Discovery',
    summaryFallback:
      (input.overview?.findingCounts.pending ?? 0) > 0
        ? `${input.overview.findingCounts.pending} findings`
        : '等待问题发现',
    detailFallback: undefined,
    attempt: input.overview?.latestDiscoveryAttempt,
    sessionTitle: `${input.projectName} · Discovery 日志`
  });

  const triageAttentionFinding = input.findings.find(
    (finding) =>
      finding.latestTriageAttempt?.status ===
      GovernanceExecutionAttemptStatus.NeedsHumanReview
  );
  const triageAttempt =
    triageActiveFindings[0]?.latestTriageAttempt ??
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
        ? 'ready'
        : 'idle';
  const triageSummary = triageActiveFindings.length > 1
    ? `${triageActiveFindings.length} findings running`
    : triageActiveFindings[0]
      ? triageActiveFindings[0].title
      : triageAttentionFinding
        ? triageAttentionFinding.title
        : input.findings.length > 0
          ? `${input.findings.length} findings 等待 triage`
          : input.issues.length > 0
            ? `${input.issues.length} issues 已入 backlog`
            : '暂无 triage';
  const triageDetail = triageAttentionFinding
    ? triageAttentionFinding.latestTriageAttempt?.failureMessage ?? '需要人工处理'
    : triageActiveFindings[0]
      ? undefined
      : undefined;

  const selectedPlanningAttempt =
    input.selectedIssue?.latestPlanningAttempt ?? null;
  const attentionPlanningIssue = input.issues.find(
    (issue) =>
      issue.latestPlanningAttempt?.status ===
      GovernanceExecutionAttemptStatus.NeedsHumanReview
  );
  const planningAttempt =
    selectedPlanningAttempt ??
    planningActiveIssues[0]?.latestPlanningAttempt ??
    attentionPlanningIssue?.latestPlanningAttempt ??
    null;
  const planningOwner =
    input.selectedIssue ??
    planningActiveIssues[0] ??
    attentionPlanningIssue ??
    null;
  const planningTone = planningAttempt
    ? mapAttemptTone(planningAttempt.status)
    : input.selectedIssue?.changePlan ||
        input.issues.some(
          (issue) =>
            issue.latestChangePlanStatus === GovernanceChangePlanStatus.Approved
        )
      ? 'success'
      : input.issues.length > 0
        ? 'queued'
        : 'idle';
  const planningStatusLabel = planningAttempt
    ? getAttemptStatusVisual(planningAttempt.status).label
    : input.selectedIssue?.changePlan ||
        input.issues.some(
          (issue) =>
            issue.latestChangePlanStatus === GovernanceChangePlanStatus.Approved
        )
      ? 'ready'
      : input.issues.length > 0
        ? '待规划'
        : 'idle';
  const planningSummary = planningActiveIssues.length > 1
    ? `${planningActiveIssues.length} issues running`
    : planningOwner
      ? planningOwner.title
      : input.issues.length > 0
        ? `${input.issues.length} issues 可规划`
        : '暂无 planning';
  const planningDetail = attentionPlanningIssue
    ? attentionPlanningIssue.latestPlanningAttempt?.failureMessage ?? '需要人工处理'
    : planningAttempt && planningAttempt.failureMessage
      ? planningAttempt.failureMessage
      : undefined;

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
    executionRunningUnits[0]?.latestExecutionAttempt ??
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
  const executionSummary = executionRunningUnits.length > 1
    ? `${executionRunningUnits.length} units running`
    : executionRunningUnits[0]
      ? executionRunningUnits[0].title
      : attentionChangeUnit
        ? attentionChangeUnit.title
        : readyChangeUnits.length > 0
          ? `${readyChangeUnits.length} units ready`
          : completedChangeUnits.length > 0
            ? `${completedChangeUnits.length} units finished`
            : '暂无 execution';
  const executionDetail = attentionChangeUnit
    ? attentionChangeUnit.latestExecutionAttempt?.failureMessage ?? '需要人工处理'
    : executionAttempt?.failureMessage ?? undefined;

  const reviewAttentionItem = input.reviewQueue[0] ?? null;
  const submittedArtifacts = input.deliveryArtifacts.filter(
    (artifact) => artifact.status === GovernanceDeliveryArtifactStatus.Submitted
  );
  const reviewTone =
    input.reviewQueue.length > 0
      ? 'attention'
      : submittedArtifacts.length > 0
        ? 'queued'
        : input.deliveryArtifacts.length > 0
          ? 'success'
          : 'idle';
  const reviewStatusLabel =
    input.reviewQueue.length > 0
      ? 'needs review'
      : submittedArtifacts.length > 0
        ? 'submitted'
        : input.deliveryArtifacts.length > 0
          ? 'delivered'
          : 'idle';
  const reviewSummary = reviewAttentionItem
    ? `${input.reviewQueue.length} items waiting`
    : input.deliveryArtifacts.length > 0
      ? `${input.deliveryArtifacts.length} artifacts`
      : '暂无 review';
  const reviewDetail = reviewAttentionItem
    ? reviewAttentionItem.failureMessage ?? reviewAttentionItem.status
    : undefined;

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
      activeCount: triageActiveFindings.length,
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
      activeCount: planningActiveIssues.length,
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
      activeCount: executionRunningUnits.length,
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
      activeCount: input.reviewQueue.length,
      sessionId: reviewAttentionItem?.sessionId ?? null,
      sessionTitle: reviewAttentionItem?.sessionId
        ? `${reviewAttentionItem.title} · Review 日志`
        : undefined
    }
  ];
}

function attemptStageView(input: {
  label: string;
  summaryFallback: string;
  detailFallback?: string;
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
        className:
          'border border-border/60 bg-background/80 text-muted-foreground'
      };
    case GovernanceExecutionAttemptStatus.Running:
      return {
        label: 'running',
        className: 'border border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300'
      };
    case GovernanceExecutionAttemptStatus.WaitingRepair:
      return {
        label: 'waiting',
        className: 'border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      };
    case GovernanceExecutionAttemptStatus.Succeeded:
      return {
        label: 'succeeded',
        className: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      };
    case GovernanceExecutionAttemptStatus.Failed:
      return {
        label: 'failed',
        className: 'border border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300'
      };
    case GovernanceExecutionAttemptStatus.NeedsHumanReview:
      return {
        label: 'needs review',
        className: 'border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      };
    case GovernanceExecutionAttemptStatus.ResolvedByHuman:
      return {
        label: 'resolved',
        className: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      };
    case GovernanceExecutionAttemptStatus.Cancelled:
      return {
        label: 'cancelled',
        className:
          'border border-border/60 bg-background/80 text-muted-foreground'
      };
  }
}

function getStageToneVisual(tone: StageTone) {
  switch (tone) {
    case 'running':
      return {
        cardClass: 'border-sky-500/25 bg-sky-500/[0.05]',
        iconShellClass: 'border-sky-500/25 bg-sky-500/[0.08]',
        badgeClass: 'border border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300',
        chipClass: 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300',
        iconClass: 'size-3.5 text-sky-600 dark:text-sky-300',
        accentClass: 'bg-sky-400/80'
      } satisfies StageVisual;
    case 'success':
      return {
        cardClass: 'border-emerald-500/20 bg-emerald-500/[0.04]',
        iconShellClass: 'border-emerald-500/25 bg-emerald-500/[0.08]',
        badgeClass: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        chipClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        iconClass: 'size-3.5 text-emerald-700 dark:text-emerald-300',
        accentClass: 'bg-emerald-400/80'
      } satisfies StageVisual;
    case 'attention':
      return {
        cardClass: 'border-amber-500/25 bg-amber-500/[0.05]',
        iconShellClass: 'border-amber-500/25 bg-amber-500/[0.08]',
        badgeClass: 'border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        chipClass: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        iconClass: 'size-3.5 text-amber-700 dark:text-amber-300',
        accentClass: 'bg-amber-400/80'
      } satisfies StageVisual;
    case 'queued':
      return {
        cardClass: 'border-border/60 bg-muted/20',
        iconShellClass: 'border-border/60 bg-background/80',
        badgeClass: 'border border-border/60 bg-background/80 text-muted-foreground',
        chipClass: 'border-border/60 bg-background/80 text-muted-foreground',
        iconClass: 'size-3.5 text-muted-foreground',
        accentClass: 'bg-border/70'
      } satisfies StageVisual;
    case 'idle':
      return {
        cardClass: 'border-border/60 bg-background/70',
        iconShellClass: 'border-border/60 bg-background/80',
        badgeClass: 'border border-border/60 bg-background/80 text-muted-foreground',
        chipClass: 'border-border/60 bg-background/80 text-muted-foreground',
        iconClass: 'size-3.5 text-muted-foreground',
        accentClass: 'bg-border/70'
      } satisfies StageVisual;
  }
}

function isActiveAttempt(
  attempt: GovernanceExecutionAttemptSummary | null | undefined
): attempt is GovernanceExecutionAttemptSummary {
  return Boolean(attempt && ACTIVE_ATTEMPT_STATUSES.has(attempt.status));
}
