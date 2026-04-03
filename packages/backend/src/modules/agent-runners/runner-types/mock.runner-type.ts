import { z } from 'zod';
import type {
  PlatformSessionConfig,
  RunnerTypeCapabilities
} from '@agent-workbench/shared';
import type { ZodTypeAny } from 'zod';
import type {
  RawOutputChunk,
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
