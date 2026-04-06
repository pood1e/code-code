import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  GovernanceVerificationResultStatus,
  type GovernanceVerificationCheck,
  type VerificationPlan
} from '@agent-workbench/shared';

const execFileAsync = promisify(execFile);

export type GovernanceVerificationRunResult = {
  status: GovernanceVerificationResultStatus;
  checkResults: Array<{
    checkId: string;
    status: 'passed' | 'failed' | 'skipped';
    summary: string;
    artifactRefs?: string[];
  }>;
  summary: string;
};

@Injectable()
export class GovernanceVerificationRunnerService {
  async runPlan(input: {
    workspacePath: string;
    plan: VerificationPlan;
  }): Promise<GovernanceVerificationRunResult> {
    const checkResults: GovernanceVerificationRunResult['checkResults'] = [];

    for (const check of input.plan.checks) {
      checkResults.push(
        await this.runCheck({
          workspacePath: input.workspacePath,
          check
        })
      );
    }

    const hasFailedRequired = input.plan.checks.some((check) => {
      const result = checkResults.find((item) => item.checkId === check.id);
      return check.required && result?.status === 'failed';
    });
    const hasSkippedRequired = input.plan.checks.some((check) => {
      const result = checkResults.find((item) => item.checkId === check.id);
      return check.required && result?.status === 'skipped';
    });

    if (hasFailedRequired) {
      return {
        status: GovernanceVerificationResultStatus.Failed,
        checkResults,
        summary: 'One or more required verification checks failed.'
      };
    }

    if (hasSkippedRequired) {
      return {
        status: GovernanceVerificationResultStatus.Partial,
        checkResults,
        summary: 'Required checks are missing commands and require manual verification.'
      };
    }

    return {
      status: GovernanceVerificationResultStatus.Passed,
      checkResults,
      summary: 'All required verification checks passed.'
    };
  }

  private async runCheck(input: {
    workspacePath: string;
    check: GovernanceVerificationCheck;
  }) {
    if (!input.check.command) {
      return {
        checkId: input.check.id,
        status: 'skipped' as const,
        summary: `No command configured for ${input.check.type}.`
      };
    }

    try {
      await execFileAsync(
        '/bin/zsh',
        ['-lc', input.check.command],
        {
          cwd: input.workspacePath,
          maxBuffer: 1024 * 1024
        }
      );
      return {
        checkId: input.check.id,
        status: 'passed' as const,
        summary: `${input.check.type} passed`
      };
    } catch (error) {
      return {
        checkId: input.check.id,
        status: 'failed' as const,
        summary:
          error instanceof Error ? error.message : `${input.check.type} failed`
      };
    }
  }
}
