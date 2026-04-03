import { Logger } from '@nestjs/common';
import type {
  PlatformSessionConfig,
  RunnerTypeCapabilities,
  RunnerContext
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
import type { CliSessionRegistry } from './cli-session-registry';

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

export function getCliSessionHandle(session: RunnerSessionRecord, registry: CliSessionRegistry): CliSessionHandle {
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

export function removeCliSessionHandle(session: RunnerSessionRecord, registry: CliSessionRegistry): void {
  registry.remove(session.id);
}

/**
 * Resolve resources from PlatformSessionConfig using Prisma.
 * This is a helper that must be called during createSession when Prisma is available.
 */
export type ResolvedResources = {
  skills: Array<{ name: string; content: string }>;
  rules: Array<{ name: string; content: string }>;
  mcps: Array<{ name: string; content: import('@agent-workbench/shared').McpStdioContent; configOverride?: import('@agent-workbench/shared').McpConfigOverride }>;
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
  abstract readonly materializerTarget: MaterializerTarget;
  abstract readonly runnerConfigSchema: ZodTypeAny;
  abstract readonly runnerSessionConfigSchema: ZodTypeAny;
  abstract readonly inputSchema: ZodTypeAny;
  abstract readonly runtimeConfigSchema: ZodTypeAny;

  constructor(protected readonly cliSessionRegistry: CliSessionRegistry) {}

  abstract checkHealth(runnerConfig: unknown): Promise<'online' | 'offline' | 'unknown'>;

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

  extractSessionId?(parserState: Record<string, unknown>): string | null;

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
      cliSessionId: null
    };

    logger.log(`CLI session created: ${sessionId} (type: ${this.id})`);
    return Promise.resolve(state as unknown as Record<string, unknown>);
  }

  async destroySession(session: RunnerSessionRecord): Promise<void> {
    const handle = this.cliSessionRegistry.get(session.id);
    if (handle) {
      handle.cancelled = true;
      handle.process?.kill();
      handle.queue.close();
      removeCliSessionHandle(session, this.cliSessionRegistry);
    }

    const state = session.runnerState as CliRunnerState;
    if (state.contextDir) {
      await cleanupContext(state.contextDir);
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
          if (cliSessionId && (session.runnerState as CliRunnerState).cliSessionId !== cliSessionId) {
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
      if (handle.cancelled) return;

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

      // Always close the queue so consumeRunnerOutput() can exit its for-await loop
      handle.queue.close();
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
}
