import {
  BadGatewayException,
  Injectable,
  Logger
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {
  platformSessionConfigSchema,
  sshGitUrlSchema,
  SessionWorkspaceMode,
  SessionWorkspaceResourceConfig,
  SessionWorkspaceResourceKind,
  type PlatformSessionConfig,
  type PlatformSessionMcp
} from '@agent-workbench/shared';

type SessionWorkspaceProject = {
  id: string;
  gitUrl: string;
  docSource?: string | null;
  workspacePath: string;
};

@Injectable()
export class SessionWorkspaceService {
  private readonly logger = new Logger(SessionWorkspaceService.name);

  async initializeWorkspace(input: {
    sessionId: string;
    project: SessionWorkspaceProject;
    workspaceResources: readonly SessionWorkspaceResourceKind[];
    workspaceResourceConfig: SessionWorkspaceResourceConfig;
    skillIds: string[];
    ruleIds: string[];
    mcps: PlatformSessionMcp[];
  }): Promise<PlatformSessionConfig> {
    const sessionDir = this.getSessionDirectory(
      input.project.workspacePath,
      input.sessionId
    );
    const codeDir = path.join(sessionDir, 'code');

    try {
      await fs.mkdir(sessionDir, { recursive: true });

      if (input.workspaceResources.includes(SessionWorkspaceResourceKind.Code)) {
        await this.cloneRepository(
          input.project.gitUrl,
          codeDir,
          input.workspaceResourceConfig.code?.branch
        );
      }

      if (input.workspaceResources.includes(SessionWorkspaceResourceKind.Doc)) {
        await this.initializeDocsDirectory({
          project: input.project,
          targetDir: path.join(sessionDir, 'docs'),
          branch: input.workspaceResourceConfig.doc?.branch
        });
      }
    } catch (error) {
      await fs.rm(sessionDir, { recursive: true, force: true });
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to initialize session workspace ${sessionDir}: ${reason}`
      );
      throw new BadGatewayException(
        `Failed to initialize session workspace: ${reason}`
      );
    }

    return platformSessionConfigSchema.parse({
      workspaceMode: SessionWorkspaceMode.Session,
      workspaceRoot: input.project.workspacePath,
      cwd: sessionDir,
      workspaceResources: [...input.workspaceResources],
      workspaceResourceConfig: input.workspaceResourceConfig,
      skillIds: input.skillIds,
      ruleIds: input.ruleIds,
      mcps: input.mcps
    });
  }

  async cleanupWorkspace(platformSessionConfig: unknown): Promise<void> {
    const config = platformSessionConfigSchema.parse(platformSessionConfig);
    if (config.workspaceMode !== SessionWorkspaceMode.Session) {
      return;
    }

    if (!this.isManagedSessionDirectory(config.workspaceRoot, config.cwd)) {
      this.logger.warn(
        `Skip deleting unmanaged session workspace: ${config.cwd}`
      );
      return;
    }

    await fs.rm(config.cwd, { recursive: true, force: true });
  }

  private getSessionDirectory(workspaceRoot: string, sessionId: string) {
    return path.join(workspaceRoot, sessionId);
  }

  private isManagedSessionDirectory(workspaceRoot: string, cwd: string) {
    const resolvedRoot = path.resolve(workspaceRoot);
    const resolvedCwd = path.resolve(cwd);
    const relative = path.relative(resolvedRoot, resolvedCwd);

    return (
      relative.length > 0 &&
      !relative.startsWith('..') &&
      !path.isAbsolute(relative)
    );
  }

  private async initializeDocsDirectory(input: {
    project: SessionWorkspaceProject;
    targetDir: string;
    branch?: string;
  }) {
    if (!input.project.docSource) {
      await fs.mkdir(input.targetDir, { recursive: true });
      return;
    }

    if (
      input.branch?.trim() ||
      sshGitUrlSchema.safeParse(input.project.docSource).success
    ) {
      await this.cloneRepository(
        input.project.docSource,
        input.targetDir,
        input.branch
      );
      return;
    }

    await fs.cp(input.project.docSource, input.targetDir, {
      recursive: true
    });
  }

  private async cloneRepository(
    repositoryUrl: string,
    targetDir: string,
    branch?: string
  ) {
    const args = ['clone', '--depth', '1'] as string[];

    if (branch?.trim()) {
      args.push('--branch', branch.trim(), '--single-branch');
    }

    args.push(repositoryUrl, targetDir);
    await execFileAsync('git', args);
  }
}

function execFileAsync(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(command, args, (error, _stdout, stderr) => {
      if (!error) {
        resolve();
        return;
      }

      reject(
        new Error(
          stderr?.trim().length
            ? stderr.trim()
            : error.message
        )
      );
    });
  });
}
