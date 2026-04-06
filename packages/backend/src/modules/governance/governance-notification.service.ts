import { Injectable, Logger } from '@nestjs/common';

import {
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceChangeUnitStatus,
  GovernanceDeliveryArtifactStatus,
  GovernanceExecutionAttemptStatus,
  NotificationSeverity
} from '@agent-workbench/shared';

import { NotificationReceiverService } from '../notifications/notification-receiver.service';

type AttemptNotificationInput = {
  type: string;
  scopeId: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  stageType: GovernanceAutomationStage;
  subjectType: GovernanceAutomationSubjectType;
  subjectId: string;
  attemptId: string;
  attemptNo: number;
  sessionId: string | null;
  issueId?: string | null;
  status?: string;
  failureCode?: string | null;
  failureMessage?: string | null;
};

@Injectable()
export class GovernanceNotificationService {
  private readonly logger = new Logger(GovernanceNotificationService.name);

  constructor(
    private readonly notificationReceiver: NotificationReceiverService
  ) {}

  notifyBaselineSucceeded(input: {
    scopeId: string;
    attemptId: string;
    attemptNo: number;
    sessionId: string | null;
    branch: string;
  }) {
    return this.sendAttemptNotification({
      type: 'governance.baseline.succeeded',
      scopeId: input.scopeId,
      title: '治理 Baseline 已完成',
      body: `仓库画像已生成，分支：${input.branch}`,
      severity: NotificationSeverity.Success,
      stageType: GovernanceAutomationStage.Baseline,
      subjectType: GovernanceAutomationSubjectType.Scope,
      subjectId: input.scopeId,
      attemptId: input.attemptId,
      attemptNo: input.attemptNo,
      sessionId: input.sessionId,
      status: GovernanceExecutionAttemptStatus.Succeeded
    });
  }

  notifyDiscoverySucceeded(input: {
    scopeId: string;
    attemptId: string;
    attemptNo: number;
    sessionId: string | null;
    findingCount: number;
  }) {
    return this.sendAttemptNotification({
      type: 'governance.discovery.succeeded',
      scopeId: input.scopeId,
      title: '治理 Discovery 已完成',
      body: `本次 discovery 发现 ${input.findingCount} 条 finding。`,
      severity: NotificationSeverity.Success,
      stageType: GovernanceAutomationStage.Discovery,
      subjectType: GovernanceAutomationSubjectType.Scope,
      subjectId: input.scopeId,
      attemptId: input.attemptId,
      attemptNo: input.attemptNo,
      sessionId: input.sessionId,
      status: GovernanceExecutionAttemptStatus.Succeeded
    });
  }

  notifyTriageIssueCreated(input: {
    scopeId: string;
    attemptId: string;
    attemptNo: number;
    sessionId: string | null;
    findingId: string;
    issueId: string;
    issueTitle: string;
  }) {
    return this.sendAttemptNotification({
      type: 'governance.triage.issue_created',
      scopeId: input.scopeId,
      title: '治理 Triage 已创建 Issue',
      body: `Finding 已进入 backlog：${input.issueTitle}`,
      severity: NotificationSeverity.Success,
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectId: input.findingId,
      attemptId: input.attemptId,
      attemptNo: input.attemptNo,
      sessionId: input.sessionId,
      issueId: input.issueId,
      status: GovernanceExecutionAttemptStatus.Succeeded
    });
  }

  notifyTriageIssueMerged(input: {
    scopeId: string;
    attemptId: string;
    attemptNo: number;
    sessionId: string | null;
    findingId: string;
    issueId: string;
    issueTitle: string;
  }) {
    return this.sendAttemptNotification({
      type: 'governance.triage.issue_merged',
      scopeId: input.scopeId,
      title: '治理 Triage 已归并到现有 Issue',
      body: `Finding 已归并到：${input.issueTitle}`,
      severity: NotificationSeverity.Info,
      stageType: GovernanceAutomationStage.Triage,
      subjectType: GovernanceAutomationSubjectType.Finding,
      subjectId: input.findingId,
      attemptId: input.attemptId,
      attemptNo: input.attemptNo,
      sessionId: input.sessionId,
      issueId: input.issueId,
      status: GovernanceExecutionAttemptStatus.Succeeded
    });
  }

  notifyPlanningPlanCreated(input: {
    scopeId: string;
    attemptId: string;
    attemptNo: number;
    sessionId: string | null;
    issueId: string;
    issueTitle: string;
    changePlanId: string;
  }) {
    return this.sendAttemptNotification({
      type: 'governance.planning.plan_created',
      scopeId: input.scopeId,
      title: '治理 Planning 已生成 Change Plan',
      body: `已为 Issue 生成草案计划：${input.issueTitle}`,
      severity: NotificationSeverity.Success,
      stageType: GovernanceAutomationStage.Planning,
      subjectType: GovernanceAutomationSubjectType.Issue,
      subjectId: input.issueId,
      attemptId: input.attemptId,
      attemptNo: input.attemptNo,
      sessionId: input.sessionId,
      issueId: input.issueId,
      status: GovernanceExecutionAttemptStatus.Succeeded
    });
  }

  notifyExecutionUnitVerified(input: {
    scopeId: string;
    attemptId: string;
    attemptNo: number;
    sessionId: string | null;
    issueId: string;
    changeUnitId: string;
    changeUnitTitle: string;
  }) {
    return this.sendAttemptNotification({
      type: 'governance.execution.unit_verified',
      scopeId: input.scopeId,
      title: '治理 Execution 已验证通过',
      body: `变更单元已完成验证：${input.changeUnitTitle}`,
      severity: NotificationSeverity.Success,
      stageType: GovernanceAutomationStage.Execution,
      subjectType: GovernanceAutomationSubjectType.ChangeUnit,
      subjectId: input.changeUnitId,
      attemptId: input.attemptId,
      attemptNo: input.attemptNo,
      sessionId: input.sessionId,
      issueId: input.issueId,
      status: GovernanceChangeUnitStatus.Verified
    });
  }

  notifyExecutionUnitExhausted(input: {
    scopeId: string;
    attemptId: string;
    attemptNo: number;
    sessionId: string | null;
    issueId: string;
    changeUnitId: string;
    changeUnitTitle: string;
    failureCode: string | null;
    failureMessage: string | null;
  }) {
    return this.sendAttemptNotification({
      type: 'governance.execution.unit_exhausted',
      scopeId: input.scopeId,
      title: '治理 Execution 需要人工处理',
      body: `变更单元已耗尽自动重试：${input.changeUnitTitle}`,
      severity: NotificationSeverity.Warning,
      stageType: GovernanceAutomationStage.Execution,
      subjectType: GovernanceAutomationSubjectType.ChangeUnit,
      subjectId: input.changeUnitId,
      attemptId: input.attemptId,
      attemptNo: input.attemptNo,
      sessionId: input.sessionId,
      issueId: input.issueId,
      status: GovernanceChangeUnitStatus.Exhausted,
      failureCode: input.failureCode
    });
  }

  notifyDeliveryReviewRequestSubmitted(input: {
    scopeId: string;
    issueId: string;
    deliveryArtifactId: string;
    title: string;
  }) {
    return this.send({
      scopeId: input.scopeId,
      type: 'governance.delivery.review_request_submitted',
      title: '治理交付已提交审批',
      body: `已生成 review request：${input.title}`,
      severity: NotificationSeverity.Info,
      metadata: {
        scopeId: input.scopeId,
        issueId: input.issueId,
        subjectType: 'delivery_artifact',
        subjectId: input.deliveryArtifactId,
        status: GovernanceDeliveryArtifactStatus.Submitted
      }
    });
  }

  notifyDeliveryApproved(input: {
    scopeId: string;
    issueId: string;
    deliveryArtifactId: string;
    title: string;
  }) {
    return this.send({
      scopeId: input.scopeId,
      type: 'governance.delivery.approved',
      title: '治理交付已批准',
      body: `交付项已通过审批：${input.title}`,
      severity: NotificationSeverity.Success,
      metadata: {
        scopeId: input.scopeId,
        issueId: input.issueId,
        subjectType: 'delivery_artifact',
        subjectId: input.deliveryArtifactId,
        status: GovernanceDeliveryArtifactStatus.Merged
      }
    });
  }

  notifyDeliveryRejected(input: {
    scopeId: string;
    issueId: string;
    deliveryArtifactId: string;
    title: string;
  }) {
    return this.send({
      scopeId: input.scopeId,
      type: 'governance.delivery.rejected',
      title: '治理交付被拒绝',
      body: `交付项被退回：${input.title}`,
      severity: NotificationSeverity.Warning,
      metadata: {
        scopeId: input.scopeId,
        issueId: input.issueId,
        subjectType: 'delivery_artifact',
        subjectId: input.deliveryArtifactId,
        status: GovernanceDeliveryArtifactStatus.Closed
      }
    });
  }

  notifyAttemptNeedsHumanReview(input: AttemptNotificationInput) {
    return this.sendAttemptNotification(input);
  }

  private sendAttemptNotification(input: AttemptNotificationInput) {
    return this.send({
      scopeId: input.scopeId,
      type: input.type,
      title: input.title,
      body: input.body,
      severity: input.severity,
      metadata: {
        scopeId: input.scopeId,
        stageType: input.stageType,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        attemptId: input.attemptId,
        attemptNo: input.attemptNo,
        sessionId: input.sessionId,
        issueId: input.issueId ?? null,
        status: input.status ?? GovernanceExecutionAttemptStatus.NeedsHumanReview,
        failureCode: input.failureCode ?? null,
        failureMessage: input.failureMessage ?? null
      }
    });
  }

  private async send(input: {
    scopeId: string;
    type: string;
    title: string;
    body: string;
    severity: NotificationSeverity;
    metadata: Record<string, unknown>;
  }) {
    try {
      await this.notificationReceiver.receive(input);
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue governance notification ${input.type}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
