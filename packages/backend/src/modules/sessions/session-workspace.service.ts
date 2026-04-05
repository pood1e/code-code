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
  SessionWorkspaceMode,
  SessionWorkspaceResourceKind,
  type PlatformSessionConfig,
  type PlatformSessionMcp
} from '@agent-workbench/shared';

type SessionWorkspaceProject = {
  id: string;
  gitUrl: string;
  workspacePath: string;
};

@Injectable()
export class SessionWorkspaceService {
  private readonly logger = new Logger(SessionWorkspaceService.name);

  async initializeWorkspace(input: {
    sessionId: string;
    project: SessionWorkspaceProject;
    workspaceResources: readonly SessionWorkspaceResourceKind[];
    skillIds: string[];
    ruleIds: string[];
    mcps: PlatformSessionMcp[];
  }): Promise<PlatformSessionConfig> {
    const sessionDir = this.getSessionDirectory(
      input.project.workspacePath,
      input.sessionId
    );

    try {
      if (input.workspaceResources.includes(SessionWorkspaceResourceKind.Code)) {
        await this.cloneProjectRepository(input.project.gitUrl, sessionDir);
      } else {
        await fs.mkdir(sessionDir, { recursive: true });
      }

      if (input.workspaceResources.includes(SessionWorkspaceResourceKind.Doc)) {
        await fs.mkdir(path.join(sessionDir, 'docs'), { recursive: true });
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

  private async cloneProjectRepository(gitUrl: string, targetDir: string) {
    await execFileAsync('git', ['clone', '--depth', '1', gitUrl, targetDir]);
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
