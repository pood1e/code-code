import { Logger } from '@nestjs/common';
import type {
  PlatformSessionConfig,
  McpStdioContent,
  McpConfigOverride,
  RunnerTypeCapabilities
} from '@agent-workbench/shared';
import type { ZodTypeAny } from 'zod';

import type {
  RawOutputChunk,
  RunnerSendPayload,
  RunnerSessionRecord,
  RunnerType
} from '../runner-type.interface';
import { CliProcess, type CliProcessOptions } from './cli-process';
import {
  cleanupContext,
  type MaterializerTarget
} from './context-materializer';

const logger = new Logger('CliRunnerBase');

/**
 * Common state stored in `runnerState` for all CLI-backed runners.
 */
export type CliRunnerState = {
  contextDir: string | null;
  mcpConfigPath: string | null;
  /** CLI-side session ID extracted from stream output. */
  cliSessionId: string | null;
};

export type AsyncChunkQueueItem = RawOutputChunk;

/**
 * Queue that bridges push-based line parsing to pull-based AsyncIterable consumption.
 */
export class AsyncChunkQueue implements AsyncIterable<RawOutputChunk> {
  private readonly values: RawOutputChunk[] = [];
  private readonly resolvers: Array<(result: IteratorResult<RawOutputChunk>) => void> = [];
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

/** Registry of active CLI sessions (in-memory, not persisted). */
const activeSessions = new Map<string, CliSessionHandle>();

export function getCliSessionHandle(session: RunnerSessionRecord): CliSessionHandle {
  const state = session.runnerState as CliRunnerState;
  const handleId = `cli:${session.id}`;
  let handle = activeSessions.get(handleId);
  if (!handle) {
    handle = {
      id: handleId,
      queue: new AsyncChunkQueue(),
      process: null,
      cancelled: false
    };
    activeSessions.set(handleId, handle);
  }
  void state; // reference to avoid unused
  return handle;
}

export function removeCliSessionHandle(session: RunnerSessionRecord): void {
  activeSessions.delete(`cli:${session.id}`);
}

/**
 * Resolve resources from PlatformSessionConfig using Prisma.
 * This is a helper that must be called during createSession when Prisma is available.
 */
export type ResolvedResources = {
  skills: Array<{ name: string; content: string }>;
  rules: Array<{ name: string; content: string }>;
  mcps: Array<{ name: string; content: McpStdioContent; configOverride?: McpConfigOverride }>;
};

/**
 * Common configuration for CLI-based runner types.
 */
export type CliRunnerTypeConfig = {
  id: string;
  name: string;
  materializerTarget: MaterializerTarget;
  capabilities: RunnerTypeCapabilities;
  runnerConfigSchema: ZodTypeAny;
  runnerSessionConfigSchema: ZodTypeAny;
  inputSchema: ZodTypeAny;
  runtimeConfigSchema: ZodTypeAny;

  checkHealth(runnerConfig: unknown): Promise<'online' | 'offline' | 'unknown'>;

  /**
   * Build the CLI command and arguments for a single execution.
   */
  buildCommand(
    runnerConfig: Record<string, unknown>,
    runnerSessionConfig: Record<string, unknown>,
    cliState: CliRunnerState,
    payload: RunnerSendPayload
  ): CliProcessOptions;

  /**
   * Parse a single line of CLI stdout into RawOutputChunks.
   */
  parseLine(
    line: string,
    messageId: string,
    parserState: Record<string, unknown>
  ): RawOutputChunk[];

  /**
   * Called after the CLI process exits to get the CLI-side session ID
   * (if one was extracted by the parser).
   */
  extractSessionId?(parserState: Record<string, unknown>): string | null;

  /**
   * Create the initial parser state for a new execution.
   */
  createParserState(messageId: string): Record<string, unknown>;
};

/**
 * Creates a RunnerType implementation backed by an external CLI process.
 */
export function createCliRunnerType(config: CliRunnerTypeConfig): RunnerType {
  return {
    id: config.id,
    name: config.name,
    capabilities: config.capabilities,
    materializerTarget: config.materializerTarget,
    runnerConfigSchema: config.runnerConfigSchema,
    runnerSessionConfigSchema: config.runnerSessionConfigSchema,
    inputSchema: config.inputSchema,
    runtimeConfigSchema: config.runtimeConfigSchema,

    checkHealth: config.checkHealth,

    async createSession(
      sessionId: string,
      _runnerConfig: unknown,
      _platformSessionConfig: PlatformSessionConfig,
      _runnerSessionConfig: unknown
    ): Promise<Record<string, unknown>> {
      // The actual context materialization (MCP/Rule/Skill file writing)
      // requires Prisma access to resolve resource IDs → content.
      // This is handled by the session runtime service calling
      // materializeSessionContext() before createSession().
      //
      // createSession() here just initializes the in-memory state.
      const state: CliRunnerState = {
        contextDir: null,
        mcpConfigPath: null,
        cliSessionId: null
      };

      logger.log(`CLI session created: ${sessionId} (type: ${config.id})`);
      return state as unknown as Record<string, unknown>;
    },

    async destroySession(session: RunnerSessionRecord): Promise<void> {
      const handle = activeSessions.get(`cli:${session.id}`);
      if (handle) {
        handle.cancelled = true;
        handle.process?.kill();
        handle.queue.close();
        removeCliSessionHandle(session);
      }

      const state = session.runnerState as CliRunnerState;
      if (state.contextDir) {
        await cleanupContext(state.contextDir);
      }

      logger.log(`CLI session destroyed: ${session.id}`);
    },

    async send(
      session: RunnerSessionRecord,
      payload: RunnerSendPayload
    ): Promise<void> {
      const handle = getCliSessionHandle(session);
      const state = session.runnerState as CliRunnerState;
      const runnerConfig = session.runnerConfig as Record<string, unknown>;
      const runnerSessionConfig = session.runnerSessionConfig as Record<string, unknown>;

      // Kill any previous process from this session
      if (handle.process?.isRunning) {
        handle.process.kill();
        await handle.process.waitForExit();
      }

      handle.cancelled = false;

      const processOptions = config.buildCommand(
        runnerConfig,
        runnerSessionConfig,
        state,
        payload
      );

      const cliProcess = new CliProcess(processOptions);
      handle.process = cliProcess;

      const parserState = config.createParserState(payload.messageId);

      cliProcess.onLine((line) => {
        if (handle.cancelled) return;

        try {
          const chunks = config.parseLine(line, payload.messageId, parserState);
          for (const chunk of chunks) {
            handle.queue.push(chunk);
          }
        } catch (error) {
          logger.warn(
            `Parse error in ${config.id}: ${
              error instanceof Error ? error.message : 'unknown'
            } — line: ${line.slice(0, 200)}`
          );
        }
      });

      cliProcess.start();

      // Wait for exit in background
      void cliProcess.waitForExit().then((result) => {
        if (handle.cancelled) return;

        // Update CLI session ID if extracted
        if (config.extractSessionId) {
          const cliSessionId = config.extractSessionId(parserState);
          if (cliSessionId) {
            (session.runnerState as CliRunnerState).cliSessionId = cliSessionId;
          }
        }

        // If process exited unexpectedly without producing a result event,
        // emit an error chunk
        if (result.exitCode !== 0 && result.exitCode !== null) {
          const stderr = cliProcess.getStderr().trim();
          handle.queue.push({
            kind: 'error',
            messageId: payload.messageId,
            timestampMs: Date.now(),
            data: {
              message: stderr || `CLI exited with code ${result.exitCode}`,
              code: 'CLI_EXIT_ERROR',
              recoverable: false
            }
          });
        }
      });
    },

    output(session: RunnerSessionRecord): AsyncIterable<RawOutputChunk> {
      return getCliSessionHandle(session).queue;
    },

    async cancelOutput(session: RunnerSessionRecord): Promise<void> {
      const handle = activeSessions.get(`cli:${session.id}`);
      if (handle) {
        handle.cancelled = true;
        handle.process?.kill();
      }
    }
  };
}
