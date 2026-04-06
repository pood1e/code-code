import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { load } from 'js-yaml';

import { RepositoryBuildStatus } from '@agent-workbench/shared';

const execFileAsync = promisify(execFile);

type RepositoryModuleSnapshot = {
  name: string;
  path: string;
  language: string;
  dependencies: string[];
};

type RepositoryProfileSnapshot = {
  branch: string;
  snapshotAt: Date;
  modules: RepositoryModuleSnapshot[];
  testBaseline: {
    coveragePercent?: number;
    totalTests: number;
    failingTests: number;
    lastRunAt?: string;
  };
  buildStatus: RepositoryBuildStatus;
  metadata: Record<string, unknown>;
};

@Injectable()
export class GovernanceBaselineService {
  private static readonly UNKNOWN_BRANCH = 'unknown';

  async resolveHeadCommitSha(workspacePath: string) {
    const { stdout } = await execFileAsync('git', ['-C', workspacePath, 'rev-parse', 'HEAD']);

    const sha = stdout.trim();
    if (!sha) {
      throw new Error('Failed to resolve git HEAD');
    }

    return sha;
  }

  async buildRepositoryProfile(workspacePath: string): Promise<RepositoryProfileSnapshot> {
    const [branch, modules, testBaseline] = await Promise.all([
      this.resolveBranchName(workspacePath),
      this.discoverModules(workspacePath),
      this.readTestBaseline(workspacePath)
    ]);

    return {
      branch,
      snapshotAt: new Date(),
      modules,
      testBaseline,
      buildStatus: RepositoryBuildStatus.Unknown,
      metadata: {
        workspacePath,
        moduleCount: modules.length
      }
    };
  }

  private async resolveBranchName(workspacePath: string) {
    try {
      const { stdout } = await execFileAsync('git', [
        '-C',
        workspacePath,
        'rev-parse',
        '--abbrev-ref',
        'HEAD'
      ]);

      const branch = stdout.trim();
      if (!branch) {
        throw new Error('Failed to resolve git branch');
      }

      return branch;
    } catch {
      return GovernanceBaselineService.UNKNOWN_BRANCH;
    }
  }

  private async discoverModules(
    workspacePath: string
  ): Promise<RepositoryModuleSnapshot[]> {
    const workspaceGlobs = await this.readWorkspaceGlobs(workspacePath);
    const packageJsonPaths = new Set<string>();

    const rootPackageJsonPath = path.join(workspacePath, 'package.json');
    if (await isFile(rootPackageJsonPath)) {
      packageJsonPaths.add(rootPackageJsonPath);
    }

    for (const pattern of workspaceGlobs) {
      for (const packageJsonPath of await this.expandWorkspacePattern(
        workspacePath,
        pattern
      )) {
        packageJsonPaths.add(packageJsonPath);
      }
    }

    const modules = await Promise.all(
      Array.from(packageJsonPaths).map(async (packageJsonPath) => {
        const packageJson = await readJsonFile<{
          name?: string;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        }>(packageJsonPath);
        const moduleDir = path.dirname(packageJsonPath);
        const relativePath = normalizeRelativePath(
          workspacePath,
          moduleDir
        );

        return {
          name:
            packageJson?.name?.trim() ||
            (relativePath === '.'
              ? path.basename(workspacePath)
              : relativePath.replaceAll('/', '-')),
          path: relativePath,
          language: await this.detectLanguage(moduleDir),
          dependencies: uniqueStrings([
            ...Object.keys(packageJson?.dependencies ?? {}),
            ...Object.keys(packageJson?.devDependencies ?? {})
          ])
        } satisfies RepositoryModuleSnapshot;
      })
    );

    return modules.sort((left, right) => left.path.localeCompare(right.path));
  }

  private async readWorkspaceGlobs(workspacePath: string): Promise<string[]> {
    const packageJson = await readJsonFile<{
      workspaces?: string[] | { packages?: string[] };
    }>(path.join(workspacePath, 'package.json'));
    const packageJsonWorkspaces = Array.isArray(packageJson?.workspaces)
      ? packageJson.workspaces
      : Array.isArray(packageJson?.workspaces?.packages)
        ? packageJson.workspaces.packages
        : [];

    const pnpmWorkspace = await this.readPnpmWorkspacePackages(workspacePath);

    return uniqueStrings([
      ...packageJsonWorkspaces,
      ...pnpmWorkspace,
      'packages/*'
    ]);
  }

  private async readPnpmWorkspacePackages(workspacePath: string): Promise<string[]> {
    const pnpmWorkspacePath = path.join(workspacePath, 'pnpm-workspace.yaml');
    if (!(await isFile(pnpmWorkspacePath))) {
      return [];
    }

    const content = await fs.readFile(pnpmWorkspacePath, 'utf8');
    const parsed = load(content) as { packages?: unknown } | undefined;
    return Array.isArray(parsed?.packages)
      ? parsed.packages.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private async expandWorkspacePattern(
    workspacePath: string,
    pattern: string
  ): Promise<string[]> {
    const normalizedPattern = pattern.trim().replace(/\/+$/, '');
    if (!normalizedPattern.endsWith('/*')) {
      const candidate = path.join(workspacePath, normalizedPattern, 'package.json');
      return (await isFile(candidate)) ? [candidate] : [];
    }

    const prefix = normalizedPattern.slice(0, -2);
    const directory = path.join(workspacePath, prefix);
    if (!(await isDirectory(directory))) {
      return [];
    }

    const entries = await fs.readdir(directory, { withFileTypes: true });
    const packageJsonPaths = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const packageJsonPath = path.join(directory, entry.name, 'package.json');
          return (await isFile(packageJsonPath)) ? packageJsonPath : null;
        })
    );

    return packageJsonPaths.filter((value): value is string => value !== null);
  }

  private async detectLanguage(moduleDir: string): Promise<string> {
    if (await isFile(path.join(moduleDir, 'tsconfig.json'))) {
      return 'typescript';
    }

    const entries = await fs.readdir(moduleDir, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && /\.(tsx?|mts|cts)$/.test(entry.name))) {
      return 'typescript';
    }
    if (entries.some((entry) => entry.isFile() && /\.(jsx?|mjs|cjs)$/.test(entry.name))) {
      return 'javascript';
    }

    return 'unknown';
  }

  private async readTestBaseline(workspacePath: string) {
    const coverageSummaryPath = await this.findFirstExistingPath(workspacePath, [
      'coverage/coverage-summary.json',
      'coverage-summary.json'
    ]);
    const coverageSummary = coverageSummaryPath
      ? await readJsonFile<{
          total?: {
            lines?: { pct?: number };
          };
        }>(coverageSummaryPath)
      : null;

    const totalLinesPct = coverageSummary?.total?.lines?.pct;
    const stats = coverageSummaryPath
      ? await fs.stat(coverageSummaryPath)
      : null;

    return {
      ...(typeof totalLinesPct === 'number'
        ? { coveragePercent: totalLinesPct }
        : {}),
      totalTests: 0,
      failingTests: 0,
      ...(stats ? { lastRunAt: stats.mtime.toISOString() } : {})
    };
  }

  private async findFirstExistingPath(
    workspacePath: string,
    relativePaths: string[]
  ) {
    for (const relativePath of relativePaths) {
      const absolutePath = path.join(workspacePath, relativePath);
      if (await isFile(absolutePath)) {
        return absolutePath;
      }
    }

    return null;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  if (!(await isFile(filePath))) {
    return null;
  }

  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
}

async function isFile(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

function normalizeRelativePath(rootPath: string, targetPath: string) {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === '' ? '.' : relativePath.split(path.sep).join('/');
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
}
