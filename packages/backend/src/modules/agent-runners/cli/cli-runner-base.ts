import { Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  PlatformSessionConfig,
  McpConfigOverride,
  McpStdioContent,
  RunnerTypeCapabilities,
  RunnerContext
} from '@agent-workbench/shared';
import type { ZodTypeAny } from 'zod';

import type {
  RawOutputChunk,
  RunnerProfileInstallInput,
  RunnerSendPayload,
  RunnerSessionRecord,
  RunnerType
} from '../runner-type.interface';
import { CliProcess, type CliProcessOptions } from './cli-process';
import type { CliSessionRegistry } from './cli-session-registry';

const logger = new Logger('CliRunnerBase');

/**
 * Common state stored in `runnerState` for all CLI-backed runners.
 */
export type CliRunnerState = {
  /** Session workspace root where CLI-visible profile files are installed. */
  contextDir: string | null;
  mcpConfigPath: string | null;
  /** CLI-side session ID extracted from stream output. */
  cliSessionId: string | null;
  profileInstallVersion?: number | null;
};

export type CliProfileInstallLayout = {
  profileRootDir: string;
  skillDir?: string | null;
  ruleDir?: string | null;
  ruleExtension?: '.md' | '.mdc' | null;
  ruleUsesCursorFrontmatter?: boolean;
  contextFileName?: string | null;
  mcpConfigPath?: string | null;
};

const CLI_PROFILE_INSTALL_VERSION = 1;

export type AsyncChunkQueueItem = RawOutputChunk;

/**
 * Queue that bridges push-based line parsing to pull-based AsyncIterable consumption.
 */
export class AsyncChunkQueue implements AsyncIterable<RawOutputChunk> {
  private readonly values: RawOutputChunk[] = [];
  private readonly resolvers: Array<
    (result: IteratorResult<RawOutputChunk>) => void
  > = [];
  private closed = false;

  push(value: RawOutputChunk) {
    if (this.closed) return;

    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver({ value, done: false });
      return;
    }

    this.values.push(value);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    while (this.resolvers.length > 0) {
      const resolver = this.resolvers.shift();
      resolver?.({ value: undefined as unknown as RawOutputChunk, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<RawOutputChunk> {
    return {
      next: () => {
        const value = this.values.shift();
        if (value !== undefined) {
          return Promise.resolve({ value, done: false });
        }
        if (this.closed) {
          return Promise.resolve({
            value: undefined as unknown as RawOutputChunk,
            done: true
          });
        }
        return new Promise<IteratorResult<RawOutputChunk>>((resolve) => {
          this.resolvers.push(resolve);
        });
      },
      return: () => {
        this.close();
        return Promise.resolve({
          value: undefined as unknown as RawOutputChunk,
          done: true
        });
      }
    };
  }
}

/**
 * In-memory handle for a running CLI session.
 */
export type CliSessionHandle = {
  id: string;
  queue: AsyncChunkQueue;
  process: CliProcess | null;
  cancelled: boolean;
};

export function getCliSessionHandle(
  session: RunnerSessionRecord,
  registry: CliSessionRegistry
): CliSessionHandle {
  const handleId = session.id;
  let handle = registry.get(handleId);
  if (!handle) {
    handle = {
      id: `cli:${handleId}`,
      queue: new AsyncChunkQueue(),
      process: null,
      cancelled: false
    };
    registry.register(handleId, handle);
  }
  return handle;
}

export function removeCliSessionHandle(
  session: RunnerSessionRecord,
  registry: CliSessionRegistry
): void {
  registry.remove(session.id);
}

/**
 * Resolve resources from PlatformSessionConfig using Prisma.
 * This is a helper that must be called during createSession when Prisma is available.
 */
export type ResolvedResources = {
  skills: Array<{ name: string; content: string }>;
  rules: Array<{ name: string; content: string }>;
  mcps: Array<{
    name: string;
    content: import('@agent-workbench/shared').McpStdioContent;
    configOverride?: import('@agent-workbench/shared').McpConfigOverride;
  }>;
};

/**
 * Abstract base class for CLI-backed RunnerType implementations.
 * Subclasses must implement buildCommand(), parseLine(), createParserState(),
 * checkHealth(), and optionally extractSessionId() / probeContext().
 *
 * The base class handles session lifecycle (create/destroy/send/output/cancel)
 * by managing CLI processes and async output queues.
 */
export abstract class CliRunnerTypeBase implements RunnerType {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly capabilities: RunnerTypeCapabilities;
  abstract readonly runnerConfigSchema: ZodTypeAny;
  abstract readonly runnerSessionConfigSchema: ZodTypeAny;
  abstract readonly inputSchema: ZodTypeAny;
  abstract readonly runtimeConfigSchema: ZodTypeAny;

  constructor(protected readonly cliSessionRegistry: CliSessionRegistry) {}

  abstract checkHealth(
    runnerConfig: unknown
  ): Promise<'online' | 'offline' | 'unknown'>;

  probeContext?(runnerConfig: unknown): Promise<RunnerContext>;

  abstract buildCommand(
    runnerConfig: Record<string, unknown>,
    runnerSessionConfig: Record<string, unknown>,
    cliState: CliRunnerState,
    payload: RunnerSendPayload
  ): CliProcessOptions;

  abstract parseLine(
    line: string,
    messageId: string,
    parserState: Record<string, unknown>
  ): RawOutputChunk[];

  abstract createParserState(messageId: string): Record<string, unknown>;

  protected abstract buildProfileInstallLayout(
    input: RunnerProfileInstallInput
  ): CliProfileInstallLayout;

  extractSessionId?(parserState: Record<string, unknown>): string | null;

  async installProfile(input: RunnerProfileInstallInput): Promise<void> {
    const profileRootDir = input.platformConfig.cwd;
    if (this.shouldSkipProfileInstall(input.runnerState, profileRootDir)) {
      return;
    }

    const layout = this.buildProfileInstallLayout(input);
    await fs.mkdir(layout.profileRootDir, { recursive: true });

    if (layout.skillDir) {
      await this.writeSkills(layout, input.resources.skills);
    }

    if (layout.ruleDir && layout.ruleExtension) {
      await this.writeRuleFiles(layout, input.resources.rules);
    }

    if (layout.contextFileName) {
      await this.writeContextFile(layout, input.resources.rules);
    }

    const mcpConfigPath = layout.mcpConfigPath
      ? await this.writeMcpConfig(layout, input.resources.mcps)
      : null;

    input.runnerState.contextDir = layout.profileRootDir;
    input.runnerState.mcpConfigPath = mcpConfigPath;
    input.runnerState.profileInstallVersion = CLI_PROFILE_INSTALL_VERSION;
  }

  createSession(
    sessionId: string,
    _runnerConfig: unknown,
    _platformSessionConfig: PlatformSessionConfig,
    _runnerSessionConfig: unknown
  ): Promise<Record<string, unknown>> {
    void _runnerConfig;
    void _platformSessionConfig;
    void _runnerSessionConfig;

    const state: CliRunnerState = {
      contextDir: null,
      mcpConfigPath: null,
      cliSessionId: null,
      profileInstallVersion: null
    };

    logger.log(`CLI session created: ${sessionId} (type: ${this.id})`);
    return Promise.resolve(state as unknown as Record<string, unknown>);
  }

  shouldReusePersistedState(runnerState: Record<string, unknown>) {
    return Object.keys(runnerState).length > 0;
  }

  async destroySession(session: RunnerSessionRecord): Promise<void> {
    const handle = this.cliSessionRegistry.get(session.id);
    if (handle) {
      handle.cancelled = true;
      handle.process?.kill();
      handle.queue.close();
      removeCliSessionHandle(session, this.cliSessionRegistry);
    }

    logger.log(`CLI session destroyed: ${session.id}`);
  }

  async send(
    session: RunnerSessionRecord,
    payload: RunnerSendPayload
  ): Promise<void> {
    const handle = getCliSessionHandle(session, this.cliSessionRegistry);
    const state = session.runnerState as CliRunnerState;
    const runnerConfig = session.runnerConfig;
    const runnerSessionConfig = session.runnerSessionConfig;

    // Kill any previous process from this session
    if (handle.process?.isRunning) {
      handle.process.kill();
      await handle.process.waitForExit();
    }

    handle.cancelled = false;

    const processOptions = this.buildCommand(
      runnerConfig,
      runnerSessionConfig,
      state,
      payload
    );

    const cliProcess = new CliProcess(processOptions);
    handle.process = cliProcess;

    const parserState = this.createParserState(payload.messageId);

    cliProcess.onLine((line) => {
      if (handle.cancelled) return;

      try {
        const chunks = this.parseLine(line, payload.messageId, parserState);

        // Eagerly update CLI session ID if extracted, so it's available
        // before the chunks are processed by the runtime.
        if (this.extractSessionId) {
          const cliSessionId = this.extractSessionId(parserState);
          if (
            cliSessionId &&
            (session.runnerState as CliRunnerState).cliSessionId !==
              cliSessionId
          ) {
            (session.runnerState as CliRunnerState).cliSessionId = cliSessionId;
            handle.queue.push({
              kind: 'state_update',
              messageId: payload.messageId,
              timestampMs: Date.now(),
              data: { cliSessionId }
            });
          }
        }

        for (const chunk of chunks) {
          handle.queue.push(chunk);
        }
      } catch (error) {
        logger.warn(
          `Parse error in ${this.id}: ${
            error instanceof Error ? error.message : 'unknown'
          } — line: ${line.slice(0, 200)}`
        );
      }
    });

    cliProcess.start();

    // Wait for exit in background
    void cliProcess.waitForExit().then((result) => {
      if (handle.cancelled) {
        // The process was explicitly cancelled (cancel() or destroySession()).
        // Do NOT close the queue — after a user cancel, the session returns to
        // Ready and the user may send another message. The same output consumer
        // must stay alive to receive the next send(). Only destroySession()
        // closes the queue via handle.queue.close() in destroySession().
        return;
      }

      // Update CLI session ID if extracted
      if (this.extractSessionId) {
        const cliSessionId = this.extractSessionId(parserState);
        if (cliSessionId) {
          (session.runnerState as CliRunnerState).cliSessionId = cliSessionId;
          handle.queue.push({
            kind: 'state_update',
            messageId: payload.messageId,
            timestampMs: Date.now(),
            data: { cliSessionId }
          });
        }
      }

      // If process exited unexpectedly without producing a result event,
      // emit a recoverable error chunk so the session returns to Ready and the
      // user can retry. The queue stays open for the next message.
      if (result.exitCode !== 0 && result.exitCode !== null) {
        const stderr = cliProcess.getStderr().trim();
        handle.queue.push({
          kind: 'error',
          messageId: payload.messageId,
          timestampMs: Date.now(),
          data: {
            message: stderr || `CLI exited with code ${result.exitCode}`,
            code: 'CLI_EXIT_ERROR',
            recoverable: true
          }
        });
      }

      // Do NOT close the queue here — the output consumer must stay alive
      // across multiple messages within the same session. Closing the queue
      // causes consumeRunnerOutput() to exit and removes the outputConsumers
      // entry. The next send() then incorrectly calls initializeRuntime() which
      // overwrites the persisted cliSessionId and consumes the already-closed
      // queue, producing an immediate error. The queue is only closed by
      // destroySession() when the full session lifecycle ends.
    });
  }

  output(session: RunnerSessionRecord): AsyncIterable<RawOutputChunk> {
    return getCliSessionHandle(session, this.cliSessionRegistry).queue;
  }

  cancelOutput(session: RunnerSessionRecord): Promise<void> {
    const handle = this.cliSessionRegistry.get(session.id);
    if (handle) {
      handle.cancelled = true;
      handle.process?.kill();
    }
    return Promise.resolve();
  }

  private shouldSkipProfileInstall(
    runnerState: Record<string, unknown>,
    profileRootDir: string
  ) {
    return (
      runnerState.profileInstallVersion === CLI_PROFILE_INSTALL_VERSION &&
      runnerState.contextDir === profileRootDir
    );
  }

  private async writeSkills(
    layout: CliProfileInstallLayout,
    skills: Array<{ name: string; content: string }>
  ) {
    if (!layout.skillDir || skills.length === 0) {
      return;
    }

    const skillsDir = path.join(layout.profileRootDir, layout.skillDir);
    await fs.mkdir(skillsDir, { recursive: true });

    for (const skill of skills) {
      const safeName = sanitizeFileName(skill.name);
      const skillDir = path.join(skillsDir, safeName);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skill.content, 'utf8');
    }
  }

  private async writeRuleFiles(
    layout: CliProfileInstallLayout,
    rules: Array<{ name: string; content: string }>
  ) {
    if (!layout.ruleDir || !layout.ruleExtension || rules.length === 0) {
      return;
    }

    const rulesDir = path.join(layout.profileRootDir, layout.ruleDir);
    await fs.mkdir(rulesDir, { recursive: true });

    for (const rule of rules) {
      const safeName = sanitizeFileName(rule.name);
      const content = layout.ruleUsesCursorFrontmatter
        ? `---\nalwaysApply: true\n---\n\n${rule.content}`
        : rule.content;
      await fs.writeFile(
        path.join(rulesDir, `${safeName}${layout.ruleExtension}`),
        content,
        'utf8'
      );
    }
  }

  private async writeContextFile(
    layout: CliProfileInstallLayout,
    rules: Array<{ name: string; content: string }>
  ) {
    if (!layout.contextFileName || rules.length === 0) {
      return;
    }

    const content = rules
      .map((rule) => {
        const title = rule.name.trim() || 'Instruction';
        return `## ${title}\n\n${rule.content.trim()}`;
      })
      .join('\n\n');

    await fs.writeFile(
      path.join(layout.profileRootDir, layout.contextFileName),
      `${content}\n`,
      'utf8'
    );
  }

  private async writeMcpConfig(
    layout: CliProfileInstallLayout,
    mcps: Array<{
      name: string;
      content: McpStdioContent;
      configOverride?: McpConfigOverride;
    }>
  ) {
    if (!layout.mcpConfigPath || mcps.length === 0) {
      return null;
    }

    const mcpServers = Object.fromEntries(
      mcps.map((mcp) => [
        mcp.name,
        resolveMcpContent(mcp.content, mcp.configOverride)
      ])
    );

    await fs.mkdir(path.dirname(layout.mcpConfigPath), { recursive: true });
    await fs.writeFile(
      layout.mcpConfigPath,
      JSON.stringify({ mcpServers }, null, 2),
      'utf8'
    );

    return layout.mcpConfigPath;
  }
}

function resolveMcpContent(
  content: McpStdioContent,
  configOverride?: McpConfigOverride
): McpStdioContent {
  if (!configOverride) {
    return content;
  }

  return {
    type: configOverride.type ?? content.type,
    command: configOverride.command ?? content.command,
    args: configOverride.args ?? content.args,
    env: configOverride.env
      ? { ...content.env, ...configOverride.env }
      : content.env
  };
}

function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 64) || 'unnamed'
  );
}
