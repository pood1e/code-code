import { Injectable } from '@nestjs/common';

import {
  GovernanceAutomationStage,
  GovernanceExecutionAttemptStatus,
  type GovernanceStageAgentStrategy
} from '@agent-workbench/shared';

import { GovernanceOutputParserService } from './governance-output-parser.service';
import {
  GovernanceRepository,
  type GovernanceExecutionAttemptRecord
} from './governance.repository';
import {
  GovernanceRunnerBridgeService,
  type GovernanceSessionResult
} from './governance-runner-bridge.service';

type LeaseWindow = {
  now: Date;
  leaseExpiresAt: Date;
};

export type GovernanceFanoutSuccessCandidate = {
  runnerId: string;
  sessionId: string;
  messageId: string;
  outputText: string;
  parsedOutput: Record<string, unknown>;
};

type GovernanceFanoutMergedOutput = {
  primary: GovernanceFanoutSuccessCandidate;
  parsedOutput: Record<string, unknown>;
};

@Injectable()
export class GovernanceAgentFanoutService {
  constructor(
    private readonly governanceRepository: GovernanceRepository,
    private readonly governanceRunnerBridge: GovernanceRunnerBridgeService,
    private readonly governanceOutputParser: GovernanceOutputParserService
  ) {}

  async runStageFanout(input: {
    stageType: GovernanceAutomationStage;
    scopeId: string;
    strategy: GovernanceStageAgentStrategy;
    attempt: GovernanceExecutionAttemptRecord;
    prompt: string;
    ownerLeaseToken: string;
    maxAutoRetries: number;
    createLeaseWindow: () => LeaseWindow;
    mergeOutputs: (
      candidates: GovernanceFanoutSuccessCandidate[]
    ) => GovernanceFanoutMergedOutput;
    onSuccess: (parsedOutput: Record<string, unknown>) => Promise<void>;
  }) {
    if (
      !(await this.markAttemptRunningIfPending({
        attempt: input.attempt,
        ownerLeaseToken: input.ownerLeaseToken,
        createLeaseWindow: input.createLeaseWindow
      }))
    ) {
      return false;
    }

    const sessions = await Promise.all(
      input.strategy.runnerIds.slice(0, input.strategy.fanoutCount).map(async (runnerId) => ({
        runnerId,
        ...(await this.governanceRunnerBridge.createSessionAndSendPrompt({
          scopeId: input.scopeId,
          runnerId,
          prompt: input.prompt
        }))
      }))
    );
    const primarySession = sessions[0] ?? null;
    if (!primarySession) {
      return false;
    }

    const attached = await this.governanceRepository.attachAutomationAttemptSession({
      attemptId: input.attempt.id,
      ownerLeaseToken: input.ownerLeaseToken,
      sessionId: primarySession.sessionId,
      activeRequestMessageId: primarySession.messageId
    });
    if (!attached) {
      return false;
    }

    const sessionResults = await Promise.all(
      sessions.map(async (session) => ({
        runnerId: session.runnerId,
        sessionId: session.sessionId,
        result: await this.governanceRunnerBridge.waitForResult(
          session.sessionId,
          session.messageId
        )
      }))
    );

    const parsedCandidates = this.parseSuccessCandidates(
      input.stageType,
      sessionResults
    );
    if (parsedCandidates.length === 0) {
      return this.handleFailure({
        attempt: input.attempt,
        ownerLeaseToken: input.ownerLeaseToken,
        maxAutoRetries: input.maxAutoRetries,
        sessionResults
      });
    }

    try {
      const mergedOutput = input.mergeOutputs(parsedCandidates);
      await input.onSuccess(mergedOutput.parsedOutput);
      return this.governanceRepository.markAutomationAttemptSucceeded({
        attemptId: input.attempt.id,
        ownerLeaseToken: input.ownerLeaseToken,
        activeRequestMessageId: mergedOutput.primary.messageId,
        candidateOutput: mergedOutput.primary.outputText,
        parsedOutput: mergedOutput.parsedOutput
      });
    } catch (error) {
      return this.governanceRepository.markAutomationAttemptFailed({
        attemptId: input.attempt.id,
        ownerLeaseToken: input.ownerLeaseToken,
        failureCode: 'FANOUT_FAILED',
        failureMessage: error instanceof Error ? error.message : String(error),
        candidateOutput: parsedCandidates[0]?.outputText,
        needsHumanReview:
          input.attempt.attemptNo >= input.maxAutoRetries + 1
      });
    }
  }

  private async markAttemptRunningIfPending(input: {
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

  private parseSuccessCandidates(
    stageType: GovernanceAutomationStage,
    sessionResults: Array<{
      runnerId: string;
      sessionId: string;
      result: GovernanceSessionResult;
    }>
  ) {
    const parsedCandidates: GovernanceFanoutSuccessCandidate[] = [];

    for (const sessionResult of sessionResults) {
      if (sessionResult.result.status !== 'completed') {
        continue;
      }

      try {
        parsedCandidates.push({
          runnerId: sessionResult.runnerId,
          sessionId: sessionResult.sessionId,
          messageId: sessionResult.result.messageId,
          outputText: sessionResult.result.outputText,
          parsedOutput: this.governanceOutputParser.parse(
            stageType,
            sessionResult.result.outputText
          ) as Record<string, unknown>
        });
      } catch {
        continue;
      }
    }

    return parsedCandidates;
  }

  private handleFailure(input: {
    attempt: GovernanceExecutionAttemptRecord;
    ownerLeaseToken: string;
    maxAutoRetries: number;
    sessionResults: Array<{
      runnerId: string;
      sessionId: string;
      result: GovernanceSessionResult;
    }>;
  }) {
    const firstFailure = input.sessionResults[0]?.result;
    return this.governanceRepository.markAutomationAttemptFailed({
      attemptId: input.attempt.id,
      ownerLeaseToken: input.ownerLeaseToken,
      failureCode: resolveFailureCode(firstFailure),
      failureMessage: resolveFailureMessage(firstFailure),
      candidateOutput:
        firstFailure?.status === 'completed'
          ? firstFailure.outputText
          : firstFailure?.status === 'error'
            ? firstFailure.outputText
            : null,
      needsHumanReview: input.attempt.attemptNo >= input.maxAutoRetries + 1
    });
  }
}

function resolveFailureCode(result: GovernanceSessionResult | undefined) {
  if (!result) {
    return 'FANOUT_EMPTY';
  }
  if (result.status === 'timeout') {
    return 'AGENT_TIMEOUT';
  }
  if (result.status === 'error') {
    return result.code;
  }
  return 'PARSE_FAILED';
}

function resolveFailureMessage(result: GovernanceSessionResult | undefined) {
  if (!result) {
    return 'No fanout runner result was produced.';
  }
  if (result.status === 'timeout') {
    return 'All fanout runner attempts timed out or returned unusable output.';
  }
  if (result.status === 'error') {
    return result.message;
  }
  return 'All fanout runner outputs failed to parse.';
}
