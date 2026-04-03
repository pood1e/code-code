import type { ZodTypeAny } from 'zod';
import type {
  RunnerTypeMeta,
  PlatformSessionConfig,
  RunnerContext,
  ToolCallKind
} from '@agent-workbench/shared';
import type { MaterializerTarget } from './cli/context-materializer';

export type RunnerSessionRecord = {
  id: string;
  runnerId: string;
  runnerType: string;
  runnerConfig: Record<string, unknown>;
  runnerState: Record<string, unknown>;
  platformSessionConfig: PlatformSessionConfig;
  runnerSessionConfig: Record<string, unknown>;
};

export type RunnerSendPayload = {
  messageId: string;
  input: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
};

export type RunnerOutputChunkKind =
  | 'thinking_delta'
  | 'message_delta'
  | 'message_result'
  | 'tool_use'
  | 'usage'
  | 'error'
  | 'state_update';

export type RawOutputChunk =
  | {
      kind: 'thinking_delta';
      messageId: string;
      timestampMs: number;
      data: {
        deltaText: string;
        accumulatedText?: string;
      };
    }
  | {
      kind: 'message_delta';
      messageId: string;
      timestampMs: number;
      data: {
        deltaText: string;
        accumulatedText?: string;
      };
    }
  | {
      kind: 'message_result';
      messageId: string;
      timestampMs: number;
      data: {
        text: string;
        stopReason?: string;
        durationMs?: number;
      };
    }
  | {
      kind: 'tool_use';
      messageId: string;
      timestampMs: number;
      data: {
        toolKind: ToolCallKind;
        toolName: string;
        args?: unknown;
        result?: unknown;
        error?: unknown;
        callId?: string;
      };
    }
  | {
      kind: 'usage';
      messageId: string;
      timestampMs: number;
      data: {
        inputTokens?: number;
        outputTokens?: number;
        cacheReadTokens?: number;
        cacheWriteTokens?: number;
        costUsd?: number;
        modelId?: string;
      };
    }
  | {
      kind: 'error';
      messageId: string;
      timestampMs: number;
      data: {
        message: string;
        code: string;
        recoverable: boolean;
      };
    }
  | {
      kind: 'state_update';
      messageId: string;
      timestampMs: number;
      data: Record<string, unknown>;
    };

export interface RunnerType extends RunnerTypeMeta {
  runnerConfigSchema: ZodTypeAny;
  runnerSessionConfigSchema: ZodTypeAny;
  inputSchema: ZodTypeAny;
  runtimeConfigSchema: ZodTypeAny;

  /**
   * If set, this runner is backed by an external CLI and requires
   * context materialization (MCP/Rule/Skill file writing) during session creation.
   */
  materializerTarget?: MaterializerTarget;

  checkHealth(runnerConfig: unknown): Promise<'online' | 'offline' | 'unknown'>;
  probeContext?(runnerConfig: unknown): Promise<RunnerContext>;
  createSession(
    sessionId: string,
    runnerConfig: unknown,
    platformSessionConfig: PlatformSessionConfig,
    runnerSessionConfig: unknown
  ): Promise<Record<string, unknown>>;
  destroySession(session: RunnerSessionRecord): Promise<void>;
  send(session: RunnerSessionRecord, payload: RunnerSendPayload): Promise<void>;
  output(session: RunnerSessionRecord): AsyncIterable<RawOutputChunk>;
  cancelOutput(session: RunnerSessionRecord): Promise<void>;
}
