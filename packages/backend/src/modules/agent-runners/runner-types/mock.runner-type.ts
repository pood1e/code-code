import { z } from 'zod';
import type {
  PlatformSessionConfig,
  RunnerTypeCapabilities
} from '@agent-workbench/shared';
import type { ZodTypeAny } from 'zod';
import type {
  RawOutputChunk,
  RunnerProfileInstallInput,
  RunnerSendPayload,
  RunnerSessionRecord,
  RunnerType
} from '../runner-type.interface';
import { RunnerTypeProvider } from '../runner-type.decorator';

export const mockRunnerConfigSchema = z.object({});
export const mockRunnerSessionConfigSchema = z.object({});
export const mockInputSchema = z.object({
  prompt: z.string().min(1)
});
export const mockRuntimeConfigSchema = z.record(z.string(), z.unknown());

@RunnerTypeProvider()
export class MockRunnerType implements RunnerType {
  readonly id = 'mock';
  readonly name = 'Mock Runner';
  readonly capabilities: RunnerTypeCapabilities = {
    skill: false,
    rule: false,
    mcp: false
  };
  readonly runnerConfigSchema: ZodTypeAny = mockRunnerConfigSchema;
  readonly runnerSessionConfigSchema: ZodTypeAny =
    mockRunnerSessionConfigSchema;
  readonly inputSchema: ZodTypeAny = mockInputSchema;
  readonly runtimeConfigSchema: ZodTypeAny = mockRuntimeConfigSchema;

  checkHealth() {
    return Promise.resolve<'online'>('online');
  }

  installProfile(_input: RunnerProfileInstallInput): Promise<void> {
    void _input;
    return Promise.resolve();
  }

  createSession(
    sessionId: string,
    _runnerConfig: unknown,
    _platformSessionConfig: PlatformSessionConfig,
    _runnerSessionConfig: unknown
  ): Promise<Record<string, unknown>> {
    void sessionId;
    void _runnerConfig;
    void _platformSessionConfig;
    void _runnerSessionConfig;
    const handle = new MockRunnerSession();
    mockRunnerSessions.set(handle.id, handle);
    return Promise.resolve({ handleId: handle.id });
  }

  shouldReusePersistedState() {
    return false;
  }

  destroySession(session: RunnerSessionRecord): Promise<void> {
    getMockRunnerSession(session)?.destroy();
    removeMockRunnerSession(session);
    return Promise.resolve();
  }

  send(
    session: RunnerSessionRecord,
    payload: RunnerSendPayload
  ): Promise<void> {
    const runnerSession = getMockRunnerSession(session);
    const parsedInput = mockInputSchema.parse(payload.input);
    void runnerSession.enqueueResponse(payload.messageId, parsedInput);
    return Promise.resolve();
  }

  output(session: RunnerSessionRecord): AsyncIterable<RawOutputChunk> {
    return getMockRunnerSession(session).stream();
  }

  cancelOutput(session: RunnerSessionRecord): Promise<void> {
    getMockRunnerSession(session).cancel();
    return Promise.resolve();
  }
}

// ---- Mock internals (unchanged from original) ----

const mockRunnerSessions = new Map<string, MockRunnerSession>();

class AsyncChunkQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = [];
  private readonly resolvers: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  push(value: T) {
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
      resolver?.({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const value = this.values.shift();
        if (value !== undefined) {
          return Promise.resolve({ value, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          this.resolvers.push(resolve);
        });
      }
    };
  }
}

class MockRunnerSession {
  readonly id = `mock_${Math.random().toString(36).slice(2)}`;

  private readonly queue = new AsyncChunkQueue<RawOutputChunk>();
  private destroyed = false;
  private runVersion = 0;

  stream() {
    return this.queue;
  }

  cancel() {
    this.runVersion += 1;
  }

  destroy() {
    this.destroyed = true;
    this.runVersion += 1;
    this.queue.close();
  }

  async enqueueResponse(
    messageId: string,
    input: z.infer<typeof mockInputSchema>
  ) {
    const runVersion = ++this.runVersion;
    const prompt = input.prompt.trim();
    const pipelineStage = extractPipelineStage(prompt);
    if (pipelineStage) {
      const pipelineOutput = buildPipelineMockOutput(pipelineStage, prompt);
      const responseText =
        pipelineOutput.kind === 'invalid-json'
          ? pipelineOutput.text
          : [
              `Mock pipeline stage: ${pipelineStage}`,
              '```json pipeline-output',
              JSON.stringify(pipelineOutput.payload, null, 2),
              '```'
            ].join('\n');

      this.emitChunk({
        kind: 'thinking_delta',
        messageId,
        timestampMs: Date.now(),
        data: {
          deltaText: `Mock runner is preparing ${pipelineStage} output...`,
          accumulatedText: `Mock runner is preparing ${pipelineStage} output...`
        }
      });
      await sleep(60);
      if (!this.isRunActive(runVersion)) return;

      this.emitChunk({
        kind: 'message_delta',
        messageId,
        timestampMs: Date.now(),
        data: {
          deltaText: responseText,
          accumulatedText: responseText
        }
      });
      await sleep(60);
      if (!this.isRunActive(runVersion)) return;

      this.emitChunk({
        kind: 'message_result',
        messageId,
        timestampMs: Date.now(),
        data: {
          text: responseText,
          stopReason: 'mock_pipeline_complete',
          durationMs: 120
        }
      });
      return;
    }

    const messageChunks = [
      '这是一个 Mock Session，用于打通 Session 运行时链路。',
      `收到输入：${prompt}`,
      '当前响应来自 mock 的本地模拟流，不会调用外部模型。'
    ];

    this.emitChunk({
      kind: 'thinking_delta',
      messageId,
      timestampMs: Date.now(),
      data: {
        deltaText: 'Mock runner 正在整理上下文...',
        accumulatedText: 'Mock runner 正在整理上下文...'
      }
    });
    await sleep(60);
    if (!this.isRunActive(runVersion)) return;

    let accumulatedText = '';
    for (const segment of messageChunks) {
      accumulatedText = accumulatedText
        ? `${accumulatedText}\n\n${segment}`
        : segment;
      this.emitChunk({
        kind: 'message_delta',
        messageId,
        timestampMs: Date.now(),
        data: {
          deltaText: accumulatedText.endsWith(segment)
            ? `${accumulatedText === segment ? '' : '\n\n'}${segment}`
            : segment,
          accumulatedText
        }
      });
      await sleep(90);
      if (!this.isRunActive(runVersion)) return;
    }

    this.emitChunk({
      kind: 'usage',
      messageId,
      timestampMs: Date.now(),
      data: {
        inputTokens: Math.max(prompt.length, 1),
        outputTokens: accumulatedText.length,
        modelId: 'mock-runner',
        costUsd: 0
      }
    });
    await sleep(30);
    if (!this.isRunActive(runVersion)) return;

    this.emitChunk({
      kind: 'message_result',
      messageId,
      timestampMs: Date.now(),
      data: {
        text: accumulatedText,
        stopReason: 'mock_complete',
        durationMs: 300
      }
    });
  }

  private emitChunk(chunk: RawOutputChunk) {
    if (this.destroyed) return;
    this.queue.push(chunk);
  }

  private isRunActive(runVersion: number) {
    return !this.destroyed && this.runVersion === runVersion;
  }
}

function getMockRunnerSession(session: RunnerSessionRecord) {
  const handleId = session.runnerState.handleId;
  if (typeof handleId !== 'string') {
    throw new Error('Mock runner session handle is missing');
  }
  const runnerSession = mockRunnerSessions.get(handleId);
  if (!runnerSession) {
    throw new Error(`Mock runner session not found: ${handleId}`);
  }
  return runnerSession;
}

function removeMockRunnerSession(session: RunnerSessionRecord) {
  const handleId = session.runnerState.handleId;
  if (typeof handleId === 'string') {
    mockRunnerSessions.delete(handleId);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractPipelineStage(prompt: string): 'breakdown' | 'spec' | 'estimate' | null {
  const match = prompt.match(/^STAGE:(breakdown|spec|estimate)$/m);
  return match ? (match[1] as 'breakdown' | 'spec' | 'estimate') : null;
}

function buildPipelineMockOutput(
  stage: 'breakdown' | 'spec' | 'estimate',
  prompt: string
):
  | { kind: 'json'; payload: unknown }
  | { kind: 'invalid-json'; text: string } {
  const inputSnapshot = extractPipelineInputSnapshot(prompt);
  if (
    typeof inputSnapshot?.featureRequest === 'string' &&
    inputSnapshot.featureRequest.includes('[parse-fail-once]') &&
    !prompt.includes('Parser error:')
  ) {
    return {
      kind: 'invalid-json',
      text: '```json pipeline-output\n{"broken": true\n```'
    };
  }

  switch (stage) {
    case 'breakdown':
      return {
        kind: 'json',
        payload: buildBreakdownPayload(inputSnapshot)
      };
    case 'spec':
      return {
        kind: 'json',
        payload: buildSpecPayload(inputSnapshot)
      };
    case 'estimate':
      return {
        kind: 'json',
        payload: buildEstimatePayload(inputSnapshot)
      };
    default:
      return {
        kind: 'json',
        payload: {}
      };
  }
}

function extractPipelineInputSnapshot(prompt: string): Record<string, unknown> {
  const match = prompt.match(
    /PIPELINE_INPUT_JSON_START\n([\s\S]*?)\nPIPELINE_INPUT_JSON_END/
  );
  if (!match?.[1]) {
    return {};
  }

  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildBreakdownPayload(inputSnapshot: Record<string, unknown>) {
  const featureRequest =
    typeof inputSnapshot.featureRequest === 'string'
      ? inputSnapshot.featureRequest
      : 'Implement the requested feature';
  const breakdownRejectionHistory = Array.isArray(
    inputSnapshot.breakdownRejectionHistory
  )
    ? inputSnapshot.breakdownRejectionHistory
    : [];
  const invalidBreakdown =
    featureRequest.includes('[invalid-breakdown]') &&
    breakdownRejectionHistory.length < 2;

  return {
    feature: featureRequest.replace(/\[[^\]]+\]\s*/g, '').trim(),
    userStories: ['As a user, I can complete the requested workflow end to end.'],
    systemBoundary: {
      in: ['Frontend form changes', 'Backend pipeline execution'],
      out: ['Unrelated platform modules'],
      outOfScope: ['Legacy compatibility branches']
    },
    ambiguities: invalidBreakdown ? ['Task decomposition remains too coarse.'] : [],
    tasks: [
      {
        id: 'task-1',
        title: 'Update shared contracts',
        description: 'Align shared pipeline types and schemas.',
        interface: 'shared pipeline contracts',
        dependencies: [],
        type: 'infra',
        estimatedAC: invalidBreakdown ? 8 : 3
      },
      {
        id: 'task-2',
        title: 'Implement backend orchestration',
        description: 'Wire runtime state, sessions, and review handling.',
        interface: 'pipeline backend module',
        dependencies: ['task-1'],
        type: 'api',
        estimatedAC: 4
      }
    ]
  };
}

function buildSpecPayload(inputSnapshot: Record<string, unknown>) {
  const prd =
    inputSnapshot.prd && typeof inputSnapshot.prd === 'object'
      ? (inputSnapshot.prd as { tasks?: Array<{ id: string; estimatedAC: number }> })
      : { tasks: [] };
  const tasks = Array.isArray(prd.tasks) ? prd.tasks : [];

  return tasks.map((task, index) => ({
    taskId: task.id,
    ac: Array.from({ length: Math.max(1, Math.min(task.estimatedAC ?? 1, 4)) }, (_, acIndex) => ({
      id: `${task.id}-ac-${acIndex + 1}`,
      given: `Given prerequisite ${acIndex + 1} for ${task.id}`,
      when: `When workflow step ${acIndex + 1} executes`,
      then: `Then task ${index + 1} behavior ${acIndex + 1} succeeds`
    }))
  }));
}

function buildEstimatePayload(inputSnapshot: Record<string, unknown>) {
  const prd =
    inputSnapshot.prd && typeof inputSnapshot.prd === 'object'
      ? (inputSnapshot.prd as { tasks?: Array<{ id: string; title: string }> })
      : { tasks: [] };
  const tasks = Array.isArray(prd.tasks) ? prd.tasks : [];

  return {
    totalEstimateDays: tasks.length === 0 ? 1 : tasks.length * 2,
    confidence: 0.72,
    taskEstimates: tasks.map((task, index) => ({
      taskId: task.id,
      title: task.title,
      estimateDays: 2,
      complexity: index === 0 ? 'medium' : 'high',
      risks: ['Need alignment across shared/backend/frontend boundaries.']
    })),
    overallRisks: ['Schema and workflow changes need coordinated rollout.'],
    assumptions: ['Existing session runtime remains the execution substrate.'],
    notes: 'Generated by mock runner pipeline stage.'
  };
}
