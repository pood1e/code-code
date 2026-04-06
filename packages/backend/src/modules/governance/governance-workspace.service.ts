import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';

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
    project: GovernanceProjectSource
  ): Promise<GovernanceCodeWorkspace> {
    const flowRootPath = path.join(
      project.workspaceRootPath,
      'flows',
      'governance',
      project.id
    );
    const repositoryPath = path.join(flowRootPath, 'code');

    await fs.mkdir(path.dirname(flowRootPath), { recursive: true });

    if (!(await this.isGitRepository(repositoryPath))) {
      await fs.rm(repositoryPath, { recursive: true, force: true });
      await fs.mkdir(flowRootPath, { recursive: true });
      await execFileAsync(
        'git',
        ['clone', '--depth', '1', project.repoGitUrl, repositoryPath],
        { maxBuffer: 1024 * 1024 }
      );
    }

    return {
      flowRootPath,
      repositoryPath
    };
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
