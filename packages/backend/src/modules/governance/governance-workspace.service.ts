import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';

import type { GovernanceSourceSelection } from '@agent-workbench/shared';

const execFileAsync = promisify(execFile);

type GovernanceProjectSource = {
  id: string;
  repoGitUrl: string;
  workspaceRootPath: string;
};

type GovernanceCodeWorkspace = {
  flowRootPath: string;
  repositoryPath: string;
};

@Injectable()
export class GovernanceWorkspaceService {
  async ensureCodeWorkspace(
    project: GovernanceProjectSource,
    sourceSelection?: GovernanceSourceSelection
  ): Promise<GovernanceCodeWorkspace> {
    const flowRootPath = path.join(
      project.workspaceRootPath,
      'flows',
      'governance',
      project.id
    );
    const repositoryPath = path.join(flowRootPath, 'code');
    const repoBranch = sourceSelection?.repoBranch?.trim() || null;

    await fs.mkdir(path.dirname(flowRootPath), { recursive: true });

    if (!(await this.isGitRepository(repositoryPath))) {
      await this.cloneRepository({
        repositoryPath,
        flowRootPath,
        repoGitUrl: project.repoGitUrl,
        repoBranch
      });
      return {
        flowRootPath,
        repositoryPath
      };
    }

    const currentOrigin = await this.getRemoteOrigin(repositoryPath);
    if (currentOrigin !== project.repoGitUrl) {
      await this.cloneRepository({
        repositoryPath,
        flowRootPath,
        repoGitUrl: project.repoGitUrl,
        repoBranch
      });
      return {
        flowRootPath,
        repositoryPath
      };
    }

    if (repoBranch) {
      await this.checkoutBranch(repositoryPath, repoBranch);
    }

    return {
      flowRootPath,
      repositoryPath
    };
  }

  private async cloneRepository(input: {
    repositoryPath: string;
    flowRootPath: string;
    repoGitUrl: string;
    repoBranch: string | null;
  }) {
    await fs.rm(input.repositoryPath, { recursive: true, force: true });
    await fs.mkdir(input.flowRootPath, { recursive: true });

    const cloneArgs = ['clone', '--depth', '1'];
    if (input.repoBranch) {
      cloneArgs.push('--branch', input.repoBranch, '--single-branch');
    }
    cloneArgs.push(input.repoGitUrl, input.repositoryPath);

    await execFileAsync('git', cloneArgs, { maxBuffer: 1024 * 1024 });
  }

  private async checkoutBranch(repositoryPath: string, repoBranch: string) {
    await execFileAsync(
      'git',
      ['-C', repositoryPath, 'fetch', '--depth', '1', 'origin', repoBranch],
      { maxBuffer: 1024 * 1024 }
    );
    await execFileAsync(
      'git',
      ['-C', repositoryPath, 'checkout', '-B', repoBranch, 'FETCH_HEAD'],
      { maxBuffer: 1024 * 1024 }
    );
  }

  private async getRemoteOrigin(repositoryPath: string) {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', repositoryPath, 'remote', 'get-url', 'origin'],
      { maxBuffer: 1024 * 1024 }
    );
    return stdout.trim();
  }

  private async isGitRepository(directoryPath: string) {
    try {
      const gitDirectory = path.join(directoryPath, '.git');
      const stats = await fs.stat(gitDirectory);
      return stats.isDirectory() || stats.isFile();
    } catch {
      return false;
    }
  }
}
