import type { ZodTypeAny } from 'zod';
import type {
  RunnerTypeMeta,
  PlatformSessionConfig,
  RunnerContext,
  ToolCallKind
} from '@agent-workbench/shared';

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

export type RunnerProfileResources = {
  skills: Array<{ name: string; content: string }>;
  rules: Array<{ name: string; content: string }>;
  mcps: Array<{
    name: string;
    content: import('@agent-workbench/shared').McpStdioContent;
    configOverride?: import('@agent-workbench/shared').McpConfigOverride;
  }>;
};

export type RunnerProfileInstallInput = {
  sessionId: string;
  platformConfig: PlatformSessionConfig;
  runnerState: Record<string, unknown>;
  resources: RunnerProfileResources;
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

  checkHealth(runnerConfig: unknown): Promise<'online' | 'offline' | 'unknown'>;
  probeContext?(runnerConfig: unknown): Promise<RunnerContext>;
  resolveRuntimeConfig?(
    runnerConfig: Record<string, unknown>,
    runtimeConfig: Record<string, unknown>
  ): Record<string, unknown>;
  installProfile(input: RunnerProfileInstallInput): Promise<void>;
  createSession(
    sessionId: string,
    runnerConfig: unknown,
    platformSessionConfig: PlatformSessionConfig,
    runnerSessionConfig: unknown
  ): Promise<Record<string, unknown>>;
  shouldReusePersistedState(
    runnerState: Record<string, unknown>
  ): boolean;
  destroySession(session: RunnerSessionRecord): Promise<void>;
  send(session: RunnerSessionRecord, payload: RunnerSendPayload): Promise<void>;
  output(session: RunnerSessionRecord): AsyncIterable<RawOutputChunk>;
  cancelOutput(session: RunnerSessionRecord): Promise<void>;
}
