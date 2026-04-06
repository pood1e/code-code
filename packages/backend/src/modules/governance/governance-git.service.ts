import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { GovernanceTargetRef } from '@agent-workbench/shared';

const execFileAsync = promisify(execFile);
const GOVERNANCE_GIT_USER_NAME = 'Agent Workbench Governance';
const GOVERNANCE_GIT_USER_EMAIL = 'governance@agent-workbench.local';

export type GovernanceScopedDiff = {
  changedFiles: string[];
  totalDiffLines: number;
};

@Injectable()
export class GovernanceGitService {
  async hasTargetedBaselineDrift(input: {
    workspacePath: string;
    baselineCommitSha: string;
    targets: GovernanceTargetRef[];
  }) {
    const targetFiles = toTargetFiles(input.targets);
    if (targetFiles.length === 0) {
      return false;
    }

    const { stdout } = await execFileAsync(
      'git',
      [
        '-C',
        input.workspacePath,
        'diff',
        '--name-only',
        input.baselineCommitSha,
        'HEAD',
        '--',
        ...targetFiles
      ],
      { maxBuffer: 1024 * 1024 }
    );

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean).length > 0;
  }

  async collectScopedDiff(input: {
    workspacePath: string;
    targets: GovernanceTargetRef[];
  }): Promise<GovernanceScopedDiff> {
    const targetFiles = toTargetFiles(input.targets);
    if (targetFiles.length === 0) {
      return {
        changedFiles: [],
        totalDiffLines: 0
      };
    }

    const [nameOnly, numStat] = await Promise.all([
      execFileAsync(
        'git',
        [
          '-C',
          input.workspacePath,
          'diff',
          '--name-only',
          '--',
          ...targetFiles
        ],
        { maxBuffer: 1024 * 1024 }
      ),
      execFileAsync(
        'git',
        [
          '-C',
          input.workspacePath,
          'diff',
          '--numstat',
          '--',
          ...targetFiles
        ],
        { maxBuffer: 1024 * 1024 }
      )
    ]);

    return {
      changedFiles: nameOnly.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      totalDiffLines: numStat.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .reduce((sum, line) => {
          const [added, removed] = line.split('\t');
          return sum + toNumStatValue(added) + toNumStatValue(removed);
        }, 0)
    };
  }

  async createScopedCommit(input: {
    workspacePath: string;
    files: string[];
    message: string;
  }) {
    if (input.files.length === 0) {
      throw new Error('No changed files available for commit');
    }

    await execFileAsync(
      'git',
      ['-C', input.workspacePath, 'add', '--', ...input.files],
      { maxBuffer: 1024 * 1024 }
    );
    await execFileAsync(
      'git',
      [
        '-C',
        input.workspacePath,
        '-c',
        `user.name=${GOVERNANCE_GIT_USER_NAME}`,
        '-c',
        `user.email=${GOVERNANCE_GIT_USER_EMAIL}`,
        'commit',
        '--no-verify',
        '-m',
        input.message
      ],
      { maxBuffer: 1024 * 1024 }
    );
    const { stdout } = await execFileAsync(
      'git',
      ['-C', input.workspacePath, 'rev-parse', 'HEAD'],
      { maxBuffer: 1024 * 1024 }
    );
    return stdout.trim();
  }
}

function toTargetFiles(targets: GovernanceTargetRef[]) {
  return targets
    .filter((target) => target.kind === 'file')
    .map((target) => target.ref);
}

function toNumStatValue(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
