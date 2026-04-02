import type { McpConfigOverride } from './resources';

export enum SessionStatus {
  Creating = 'creating',
  Ready = 'ready',
  Running = 'running',
  Disposing = 'disposing',
  Disposed = 'disposed',
  Error = 'error'
}

export enum MessageStatus {
  Sent = 'sent',
  Streaming = 'streaming',
  Complete = 'complete',
  Error = 'error'
}

export enum MessageRole {
  User = 'user',
  Assistant = 'assistant'
}

export enum MetricKind {
  TokenUsage = 'token_usage',
  ToolCount = 'tool_count',
  Cost = 'cost'
}

export type OutputChunkKind =
  | 'session_status'
  | 'thinking_delta'
  | 'message_delta'
  | 'message_result'
  | 'tool_use'
  | 'usage'
  | 'error'
  | 'done';

export type PlatformSessionMcp = {
  resourceId: string;
  configOverride?: McpConfigOverride;
};

export type PlatformSessionConfig = {
  cwd: string;
  skillIds: string[];
  ruleIds: string[];
  mcps: PlatformSessionMcp[];
};

export type ErrorPayload = {
  message: string;
  code: string;
  recoverable: boolean;
};

export type SessionMetricData = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
  modelId?: string;
} & Record<string, unknown>;

export type OutputChunkBase = {
  kind: OutputChunkKind;
  sessionId: string;
  eventId: number;
  timestampMs: number;
  messageId?: string;
};

export type SessionStatusChunk = OutputChunkBase & {
  kind: 'session_status';
  data: {
    status: SessionStatus;
    prevStatus: SessionStatus;
  };
};

export type ThinkingDeltaChunk = OutputChunkBase & {
  kind: 'thinking_delta';
  data: {
    deltaText: string;
    accumulatedText?: string;
  };
};

export type MessageDeltaChunk = OutputChunkBase & {
  kind: 'message_delta';
  data: {
    deltaText: string;
    accumulatedText?: string;
  };
};

export type MessageResultChunk = OutputChunkBase & {
  kind: 'message_result';
  data: {
    text: string;
    stopReason?: string;
    durationMs?: number;
  };
};

export type ToolUseChunk = OutputChunkBase & {
  kind: 'tool_use';
  data: {
    toolName: string;
    args?: unknown;
    result?: unknown;
    error?: unknown;
    callId?: string;
  };
};

export type UsageChunk = OutputChunkBase & {
  kind: 'usage';
  data: SessionMetricData;
};

export type ErrorChunk = OutputChunkBase & {
  kind: 'error';
  data: ErrorPayload;
};

export type DoneChunk = OutputChunkBase & {
  kind: 'done';
};

export type OutputChunk =
  | SessionStatusChunk
  | ThinkingDeltaChunk
  | MessageDeltaChunk
  | MessageResultChunk
  | ToolUseChunk
  | UsageChunk
  | ErrorChunk
  | DoneChunk;

export type SessionSummary = {
  id: string;
  scopeId: string;
  runnerId: string;
  runnerType: string;
  status: SessionStatus;
  lastEventId: number;
  createdAt: string;
  updatedAt: string;
};

export type SessionDetail = SessionSummary & {
  platformSessionConfig: PlatformSessionConfig;
  runnerSessionConfig: Record<string, unknown>;
  defaultRuntimeConfig: Record<string, unknown> | null;
};

export type SessionToolUse = {
  id: string;
  eventId: number;
  callId: string | null;
  toolName: string;
  args: unknown;
  result: unknown;
  error: unknown;
  createdAt: string;
};

export type SessionMessageMetric = {
  id: string;
  sessionId: string;
  messageId: string | null;
  eventId: number;
  kind: MetricKind;
  data: SessionMetricData;
  createdAt: string;
};

export type SessionMessageDetail = {
  id: string;
  sessionId: string;
  role: MessageRole;
  status: MessageStatus;
  inputContent: Record<string, unknown> | null;
  outputText: string | null;
  thinkingText: string | null;
  errorPayload: ErrorPayload | null;
  cancelledAt: string | null;
  eventId: number | null;
  toolUses: SessionToolUse[];
  metrics: SessionMessageMetric[];
  createdAt: string;
};

export type SendSessionMessageInput = {
  input: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
};

export type CreateSessionInput = {
  scopeId: string;
  runnerId: string;
  skillIds: string[];
  ruleIds: string[];
  mcps: PlatformSessionMcp[];
  runnerSessionConfig: Record<string, unknown>;
  initialMessage?: SendSessionMessageInput;
};

export type EditSessionMessageInput = SendSessionMessageInput;

export type SessionConflictReason = 'RUNNING' | 'DISPOSING' | 'ERROR';
