import type { ZodTypeAny } from 'zod';
import type { RunnerTypeMeta, PlatformSessionConfig } from '@agent-workbench/shared';

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
};

export type RunnerOutputChunkKind =
  | 'thinking_delta'
  | 'message_delta'
  | 'message_result'
  | 'tool_use'
  | 'usage'
  | 'error';

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
    };

export interface RunnerType extends RunnerTypeMeta {
  runnerConfigSchema: ZodTypeAny;
  runnerSessionConfigSchema: ZodTypeAny;
  inputSchema: ZodTypeAny;
  runtimeConfigSchema: ZodTypeAny;

  checkHealth(runnerConfig: unknown): Promise<'online' | 'offline' | 'unknown'>;
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
