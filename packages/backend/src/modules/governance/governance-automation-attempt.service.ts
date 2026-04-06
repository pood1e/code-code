import { Injectable } from '@nestjs/common';

import {
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceExecutionAttemptStatus
} from '@agent-workbench/shared';

import { GovernanceOutputParserService } from './governance-output-parser.service';
import { GovernancePromptService } from './governance-prompt.service';
import {
  GovernanceRepository,
  type GovernanceExecutionAttemptRecord
} from './governance.repository';
import { GovernanceRunnerBridgeService } from './governance-runner-bridge.service';

type LeaseWindow = {
  now: Date;
  leaseExpiresAt: Date;
};

type ClaimOrCreateAttemptInput = {
  stageType: GovernanceAutomationStage;
  subjectType: GovernanceAutomationSubjectType;
  subjectId: string;
  scopeId: string;
  ownerLeaseToken: string;
  maxAutoRetries: number;
  createLeaseWindow: () => LeaseWindow;
  inputSnapshotBuilder: (attemptNo: number) => Record<string, unknown>;
};

type RunAgentAttemptInput = {
  stageType: GovernanceAutomationStage;
  scopeId: string;
  runnerId: string;
  attempt: GovernanceExecutionAttemptRecord;
  prompt: string;
  ownerLeaseToken: string;
  maxAutoRetries: number;
  createLeaseWindow: () => LeaseWindow;
  onSuccess: (parsedOutput: Record<string, unknown>) => Promise<void>;
};

@Injectable()
export class GovernanceAutomationAttemptService {
  constructor(
    private readonly governanceRepository: GovernanceRepository,
    private readonly governanceRunnerBridge: GovernanceRunnerBridgeService,
    private readonly governancePromptService: GovernancePromptService,
    private readonly governanceOutputParser: GovernanceOutputParserService
  ) {}

  isAttemptBusy(attempt: GovernanceExecutionAttemptRecord | null) {
    return Boolean(
      attempt &&
        [
          GovernanceExecutionAttemptStatus.Running,
          GovernanceExecutionAttemptStatus.WaitingRepair,
          GovernanceExecutionAttemptStatus.NeedsHumanReview
        ].includes(attempt.status)
    );
  }

  async markAttemptRunningIfPending(input: {
    attempt: GovernanceExecutionAttemptRecord;
    ownerLeaseToken: string;
    createLeaseWindow: () => LeaseWindow;
  }) {
    if (input.attempt.status !== GovernanceExecutionAttemptStatus.Pending) {
      return true;
    }

    return this.governanceRepository.markAutomationAttemptRunning({
      attemptId: input.attempt.id,
      ownerLeaseToken: input.ownerLeaseToken,
      leaseExpiresAt: input.createLeaseWindow().leaseExpiresAt
    });
  }

  async claimOrCreateAttempt(input: ClaimOrCreateAttemptInput) {
    const latestAttempt = await this.governanceRepository.findLatestAutomationAttempt({
      stageType: input.stageType,
      subjectType: input.subjectType,
      subjectId: input.subjectId
    });

    if (latestAttempt) {
      if (
        [
          GovernanceExecutionAttemptStatus.Pending,
          GovernanceExecutionAttemptStatus.Running,
          GovernanceExecutionAttemptStatus.WaitingRepair
        ].includes(latestAttempt.status)
      ) {
        return this.governanceRepository.claimAutomationAttempt({
          attemptId: latestAttempt.id,
          ownerLeaseToken: input.ownerLeaseToken,
          ...input.createLeaseWindow()
        });
      }

      if (latestAttempt.status === GovernanceExecutionAttemptStatus.NeedsHumanReview) {
        return null;
      }

      if (latestAttempt.attemptNo >= input.maxAutoRetries + 1) {
        return null;
      }
    }

    const nextAttemptNo = (latestAttempt?.attemptNo ?? 0) + 1;
    return this.governanceRepository.createAutomationAttempt({
      scopeId: input.scopeId,
      stageType: input.stageType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      inputSnapshot: input.inputSnapshotBuilder(nextAttemptNo),
      ownerLeaseToken: input.ownerLeaseToken,
      leaseExpiresAt: input.createLeaseWindow().leaseExpiresAt
    });
  }

  async runAgentAttempt(input: RunAgentAttemptInput) {
    if (
      !(await this.markAttemptRunningIfPending({
        attempt: input.attempt,
        ownerLeaseToken: input.ownerLeaseToken,
        createLeaseWindow: input.createLeaseWindow
      }))
    ) {
      return false;
    }

    let sessionId = input.attempt.sessionId;
    let activeRequestMessageId = input.attempt.activeRequestMessageId;

    if (!sessionId) {
      const created = await this.governanceRunnerBridge.createSessionAndSendPrompt({
        scopeId: input.scopeId,
        runnerId: input.runnerId,
        prompt: input.prompt
      });
      sessionId = created.sessionId;
      activeRequestMessageId = created.messageId;
      const attached = await this.governanceRepository.attachAutomationAttemptSession({
        attemptId: input.attempt.id,
        ownerLeaseToken: input.ownerLeaseToken,
        sessionId,
        activeRequestMessageId
      });
      if (!attached) {
        return false;
      }
    }

    if (!sessionId) {
      return false;
    }

    if (input.attempt.status === GovernanceExecutionAttemptStatus.WaitingRepair) {
      return this.resumeWaitingRepairAttempt({
        stageType: input.stageType,
        attempt: input.attempt,
        sessionId,
        ownerLeaseToken: input.ownerLeaseToken,
        maxAutoRetries: input.maxAutoRetries,
        onSuccess: input.onSuccess
      });
    }

    const result = await this.governanceRunnerBridge.waitForResult(
      sessionId,
      activeRequestMessageId
    );

    return this.handleCompletedAgentResponse({
      stageType: input.stageType,
      attempt: input.attempt,
      sessionId,
      ownerLeaseToken: input.ownerLeaseToken,
      maxAutoRetries: input.maxAutoRetries,
      result,
      onSuccess: input.onSuccess,
      allowRepair: true
    });
  }

  private async handleCompletedAgentResponse(input: {
    stageType: GovernanceAutomationStage;
    attempt: GovernanceExecutionAttemptRecord;
    sessionId: string;
    ownerLeaseToken: string;
    maxAutoRetries: number;
    result: Awaited<ReturnType<GovernanceRunnerBridgeService['waitForResult']>>;
    onSuccess: (parsedOutput: Record<string, unknown>) => Promise<void>;
    allowRepair: boolean;
  }): Promise<boolean> {
    if (input.result.status !== 'completed') {
      return this.handleAgentFailure({
        attempt: input.attempt,
        ownerLeaseToken: input.ownerLeaseToken,
        maxAutoRetries: input.maxAutoRetries,
        errorCode:
          input.result.status === 'timeout' ? 'AGENT_TIMEOUT' : input.result.code,
        errorMessage:
          input.result.status === 'timeout'
            ? `${input.stageType} stage timed out`
            : input.result.message,
        candidateOutput:
          input.result.status === 'error' ? input.result.outputText : null
      });
    }

    try {
      const parsedOutput = this.governanceOutputParser.parse(
        input.stageType,
        input.result.outputText
      ) as Record<string, unknown>;
      await input.onSuccess(parsedOutput);
      return this.governanceRepository.markAutomationAttemptSucceeded({
        attemptId: input.attempt.id,
        ownerLeaseToken: input.ownerLeaseToken,
        activeRequestMessageId: input.result.messageId,
        candidateOutput: input.result.outputText,
        parsedOutput
      });
    } catch (error) {
      if (!input.allowRepair) {
        return this.handleAgentFailure({
          attempt: input.attempt,
          ownerLeaseToken: input.ownerLeaseToken,
          maxAutoRetries: input.maxAutoRetries,
          errorCode: 'PARSE_FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
          candidateOutput: input.result.outputText
        });
      }

      return this.sendRepairPromptAndHandle({
        stageType: input.stageType,
        attempt: input.attempt,
        sessionId: input.sessionId,
        ownerLeaseToken: input.ownerLeaseToken,
        maxAutoRetries: input.maxAutoRetries,
        parseError: error instanceof Error ? error.message : String(error),
        candidateOutput: input.result.outputText,
        onSuccess: input.onSuccess
      });
    }
  }

  private async sendRepairPromptAndHandle(input: {
    stageType: GovernanceAutomationStage;
    attempt: GovernanceExecutionAttemptRecord;
    sessionId: string;
    ownerLeaseToken: string;
    maxAutoRetries: number;
    parseError: string;
    candidateOutput: string;
    onSuccess: (parsedOutput: Record<string, unknown>) => Promise<void>;
  }) {
    const repairMessageId = await this.governanceRunnerBridge.sendFollowUpPrompt({
      sessionId: input.sessionId,
      prompt: this.governancePromptService.buildRepairPrompt(
        input.stageType,
        input.parseError
      )
    });

    const markedWaitingRepair =
      await this.governanceRepository.markAutomationAttemptWaitingRepair({
        attemptId: input.attempt.id,
        ownerLeaseToken: input.ownerLeaseToken,
        activeRequestMessageId: repairMessageId,
        failureCode: 'PARSE_FAILED',
        failureMessage: input.parseError,
        candidateOutput: input.candidateOutput
      });
    if (!markedWaitingRepair) {
      return false;
    }

    return this.waitForRepairResult({
      stageType: input.stageType,
      attempt: input.attempt,
      sessionId: input.sessionId,
      ownerLeaseToken: input.ownerLeaseToken,
      maxAutoRetries: input.maxAutoRetries,
      repairMessageId,
      onSuccess: input.onSuccess
    });
  }

  private async resumeWaitingRepairAttempt(input: {
    stageType: GovernanceAutomationStage;
    attempt: GovernanceExecutionAttemptRecord;
    sessionId: string;
    ownerLeaseToken: string;
    maxAutoRetries: number;
    onSuccess: (parsedOutput: Record<string, unknown>) => Promise<void>;
  }) {
    let repairMessageId = input.attempt.activeRequestMessageId;

    if (repairMessageId) {
      const trackedMessage =
        await this.governanceRunnerBridge.getAssistantMessageSnapshot(
          input.sessionId,
          repairMessageId
        );
      if (!trackedMessage) {
        const latestMessage =
          await this.governanceRunnerBridge.getLatestAssistantMessageSnapshot(
            input.sessionId
          );
        if (latestMessage && latestMessage.id !== repairMessageId) {
          repairMessageId = latestMessage.id;
          const updated = await this.governanceRepository.updateAutomationAttemptMessage(
            {
              attemptId: input.attempt.id,
              ownerLeaseToken: input.ownerLeaseToken,
              activeRequestMessageId: repairMessageId
            }
          );
          if (!updated) {
            return false;
          }
        }
      }
    } else {
      const latestMessage =
        await this.governanceRunnerBridge.getLatestAssistantMessageSnapshot(
          input.sessionId
        );
      if (latestMessage) {
        repairMessageId = latestMessage.id;
        const updated = await this.governanceRepository.updateAutomationAttemptMessage(
          {
            attemptId: input.attempt.id,
            ownerLeaseToken: input.ownerLeaseToken,
            activeRequestMessageId: repairMessageId
          }
        );
        if (!updated) {
          return false;
        }
      }
    }

    if (!repairMessageId) {
      return this.sendRepairPromptAndHandle({
        stageType: input.stageType,
        attempt: input.attempt,
        sessionId: input.sessionId,
        ownerLeaseToken: input.ownerLeaseToken,
        maxAutoRetries: input.maxAutoRetries,
        parseError:
          input.attempt.failureMessage ?? 'Previous repair request is missing.',
        candidateOutput:
          typeof input.attempt.candidateOutput === 'string'
            ? input.attempt.candidateOutput
            : JSON.stringify(input.attempt.candidateOutput ?? null),
        onSuccess: input.onSuccess
      });
    }

    return this.waitForRepairResult({
      stageType: input.stageType,
      attempt: input.attempt,
      sessionId: input.sessionId,
      ownerLeaseToken: input.ownerLeaseToken,
      maxAutoRetries: input.maxAutoRetries,
      repairMessageId,
      onSuccess: input.onSuccess
    });
  }

  private async waitForRepairResult(input: {
    stageType: GovernanceAutomationStage;
    attempt: GovernanceExecutionAttemptRecord;
    sessionId: string;
    ownerLeaseToken: string;
    maxAutoRetries: number;
    repairMessageId: string | null;
    onSuccess: (parsedOutput: Record<string, unknown>) => Promise<void>;
  }) {
    const result = await this.governanceRunnerBridge.waitForResult(
      input.sessionId,
      input.repairMessageId
    );

    return this.handleCompletedAgentResponse({
      stageType: input.stageType,
      attempt: input.attempt,
      sessionId: input.sessionId,
      ownerLeaseToken: input.ownerLeaseToken,
      maxAutoRetries: input.maxAutoRetries,
      result,
      onSuccess: input.onSuccess,
      allowRepair: false
    });
  }

  private async handleAgentFailure(input: {
    attempt: GovernanceExecutionAttemptRecord;
    ownerLeaseToken: string;
    maxAutoRetries: number;
    errorCode: string;
    errorMessage: string;
    candidateOutput?: unknown;
  }) {
    const needsHumanReview = input.attempt.attemptNo >= input.maxAutoRetries + 1;

    return this.governanceRepository.markAutomationAttemptFailed({
      attemptId: input.attempt.id,
      ownerLeaseToken: input.ownerLeaseToken,
      failureCode: input.errorCode,
      failureMessage: input.errorMessage,
      candidateOutput: input.candidateOutput,
      needsHumanReview
    });
  }
}
