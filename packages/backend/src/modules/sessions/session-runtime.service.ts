import {
  BadRequestException,
  Injectable,
  Logger
} from '@nestjs/common';
import {
  MessageRole,
  MessageStatus,
  MetricKind,
  SessionStatus,
  errorPayloadSchema,
  platformSessionConfigSchema,
  type ErrorPayload,
  type OutputChunk
} from '@agent-workbench/shared';
import type { Prisma } from '@prisma/client';

import {
  asPlainObject,
  toInputJson,
  toOptionalInputJson
} from '../../common/json.utils';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RunnerTypeRegistry } from '../agent-runners/runner-type.registry';
import type {
  RawOutputChunk,
  RunnerSessionRecord,
  RunnerType
} from '../agent-runners/runner-type.interface';
import { SessionEventStore } from './session-event.store';
import { SessionsQueryService } from './sessions-query.service';
import type { SessionRow } from './session.types';

@Injectable()
export class SessionRuntimeService {
  private readonly logger = new Logger(SessionRuntimeService.name);
  private readonly runtimeInitPromises = new Map<
    string,
    Promise<RunnerSessionRecord>
  >();
  private readonly outputConsumers = new Map<string, Promise<void>>();
  private readonly thinkingAccumulators = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsQueryService: SessionsQueryService,
    private readonly runnerTypeRegistry: RunnerTypeRegistry,
    private readonly sessionEventStore: SessionEventStore
  ) {}

  async recoverInterruptedSessionsOnBoot() {
    const staleStatuses = [
      SessionStatus.Creating,
      SessionStatus.Running,
      SessionStatus.Disposing
    ];

    await this.prisma.sessionMessage.updateMany({
      where: {
        status: MessageStatus.Streaming,
        session: {
          status: {
            in: staleStatuses
          }
        }
      },
      data: {
        status: MessageStatus.Error,
        errorPayload: toInputJson({
          message: 'Session was interrupted during service restart',
          code: 'SESSION_RECOVERED_ON_BOOT',
          recoverable: false
        })
      }
    });

    await this.prisma.agentSession.updateMany({
      where: {
        status: {
          in: staleStatuses
        }
      },
      data: {
        status: SessionStatus.Error,
        activeAssistantMessageId: null
      }
    });
  }

  getRunnerTypeOrThrow(type: string): RunnerType {
    const runnerType = this.runnerTypeRegistry.get(type);
    if (!runnerType) {
      throw new BadRequestException(`Runner type '${type}' is not registered`);
    }

    return runnerType;
  }

  parseRunnerInputOrThrow(
    runnerType: RunnerType,
    input: Record<string, unknown>,
    fallbackMessage: string
  ) {
    return parseSchemaOrThrow(
      runnerType.inputSchema,
      input,
      fallbackMessage
    ) as Record<string, unknown>;
  }

  async parseMessageInput(sessionId: string, input: Record<string, unknown>) {
    const runtimeSession = await this.ensureRuntime(sessionId);
    return this.parseRunnerInputOrThrow(
      this.getRunnerTypeOrThrow(runtimeSession.runnerType),
      input,
      'Invalid message input'
    );
  }

  async ensureRuntime(sessionId: string): Promise<RunnerSessionRecord> {
    const existing = this.runtimeInitPromises.get(sessionId);
    if (existing) {
      return existing;
    }

    if (this.outputConsumers.has(sessionId)) {
      return this.buildRunnerSessionRecord(
        await this.sessionsQueryService.getSessionOrThrow(sessionId)
      );
    }

    const initPromise = this.initializeRuntime(sessionId).finally(() => {
      this.runtimeInitPromises.delete(sessionId);
    });
    this.runtimeInitPromises.set(sessionId, initPromise);

    return initPromise;
  }

  async getRuntimeIfPresent(sessionId: string) {
    const session = await this.sessionsQueryService.getSessionOrThrow(sessionId);
    const runnerState = asPlainObject(session.runnerState);
    if (Object.keys(runnerState).length === 0) {
      return null;
    }

    return this.buildRunnerSessionRecord(session);
  }

  async sendParsedInput(
    sessionId: string,
    parsedInput: Record<string, unknown>,
    options?: {
      reuseLastUserMessage?: boolean;
      throwOnSyncSendFailure?: boolean;
    }
  ) {
    const runtimeSession = await this.ensureRuntime(sessionId);
    const previousStatus = (
      await this.sessionsQueryService.getSessionOrThrow(sessionId)
    ).status as SessionStatus;

    const assistantMessageId = await this.prisma.$transaction(async (tx) => {
      if (!options?.reuseLastUserMessage) {
        await tx.sessionMessage.create({
          data: {
            sessionId,
            role: MessageRole.User,
            status: MessageStatus.Sent,
            inputContent: toInputJson(parsedInput as Prisma.InputJsonValue)
          }
        });
      }

      const assistantMessage = await tx.sessionMessage.create({
        data: {
          sessionId,
          role: MessageRole.Assistant,
          status: MessageStatus.Streaming
        }
      });
      await tx.agentSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.Running,
          activeAssistantMessageId: assistantMessage.id
        }
      });

      return assistantMessage.id;
    });

    this.clearThinkingAccumulator(sessionId, assistantMessageId);
    await this.emitSessionStatus(
      sessionId,
      SessionStatus.Running,
      previousStatus
    );

    try {
      await this.getRunnerTypeOrThrow(runtimeSession.runnerType).send(
        runtimeSession,
        {
          messageId: assistantMessageId,
          input: parsedInput
        }
      );
    } catch (error) {
      if (options?.throwOnSyncSendFailure) {
        throw error;
      }

      await this.handleRecoverableMessageError(sessionId, assistantMessageId, {
        message: error instanceof Error ? error.message : 'Runner failed to send',
        code: 'RUNNER_SEND_FAILED',
        recoverable: true
      });
    }
  }

  async destroyRuntime(sessionId: string) {
    const runtimeSession = await this.getRuntimeIfPresent(sessionId);
    if (!runtimeSession) {
      this.resetRuntimeTracking(sessionId);
      return;
    }

    try {
      await this.getRunnerTypeOrThrow(runtimeSession.runnerType).destroySession(
        runtimeSession
      );
    } catch (error) {
      this.logger.warn(
        `Destroy session runtime failed for ${sessionId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }

    this.resetRuntimeTracking(sessionId);
  }

  async cancelRuntimeOutput(sessionId: string) {
    const runtimeSession = await this.getRuntimeIfPresent(sessionId);
    if (!runtimeSession) {
      return;
    }

    await this.getRunnerTypeOrThrow(runtimeSession.runnerType).cancelOutput(
      runtimeSession
    );
  }

  async handleRecoverableMessageError(
    sessionId: string,
    messageId: string,
    payload: ErrorPayload,
    options?: {
      cancelledAt?: Date;
    }
  ) {
    const eventId = await this.sessionEventStore.nextEventId(sessionId);
    const thinkingText = this.consumeThinkingAccumulator(sessionId, messageId);
    const outputText = await this.readStoredOutputText(sessionId, messageId);
    await this.prisma.$transaction([
      this.prisma.sessionMessage.update({
        where: { id: messageId },
        data: {
          status: MessageStatus.Error,
          errorPayload: toInputJson(payload),
          outputText: outputText ?? undefined,
          thinkingText,
          cancelledAt: options?.cancelledAt,
          eventId
        }
      }),
      this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.Ready,
          activeAssistantMessageId: null
        }
      })
    ]);

    await this.emitChunk({
      kind: 'error',
      sessionId,
      eventId,
      messageId,
      timestampMs: Date.now(),
      data: payload
    });
    await this.emitSessionStatus(
      sessionId,
      SessionStatus.Ready,
      SessionStatus.Running
    );
    await this.emitDone(sessionId, messageId);
  }

  async handleNonRecoverableMessageError(
    sessionId: string,
    messageId: string,
    payload: ErrorPayload,
    emitErrorState = true
  ) {
    const eventId = await this.sessionEventStore.nextEventId(sessionId);
    const thinkingText = this.consumeThinkingAccumulator(sessionId, messageId);
    const outputText = await this.readStoredOutputText(sessionId, messageId);
    await this.prisma.sessionMessage.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.Error,
        errorPayload: toInputJson(payload),
        outputText: outputText ?? undefined,
        thinkingText,
        eventId
      }
    });

    await this.emitChunk({
      kind: 'error',
      sessionId,
      eventId,
      messageId,
      timestampMs: Date.now(),
      data: payload
    });

    if (!emitErrorState) {
      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          activeAssistantMessageId: null
        }
      });
      return;
    }

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.Error,
        activeAssistantMessageId: null
      }
    });
    await this.emitSessionStatus(
      sessionId,
      SessionStatus.Error,
      SessionStatus.Running
    );
  }

  completeEvents(sessionId: string) {
    this.sessionEventStore.complete(sessionId);
  }

  clearTransientState(sessionId: string, messageIds?: string[]) {
    const keys =
      messageIds?.map((messageId) => this.getThinkingAccumulatorKey(sessionId, messageId)) ??
      Array.from(this.thinkingAccumulators.keys()).filter((key) =>
        key.startsWith(`${sessionId}:`)
      );

    for (const key of keys) {
      this.thinkingAccumulators.delete(key);
    }
  }

  resetRuntimeTracking(sessionId: string) {
    this.clearTransientState(sessionId);
    this.runtimeInitPromises.delete(sessionId);
    this.outputConsumers.delete(sessionId);
  }

  private async initializeRuntime(sessionId: string) {
    const session = await this.sessionsQueryService.getSessionOrThrow(sessionId);
    if ((session.status as SessionStatus) === SessionStatus.Disposed) {
      throw new BadRequestException('Disposed session cannot be reinitialized');
    }

    const runtimeSession = await this.buildRunnerSessionRecord(session);
    const runnerState = await this.getRunnerTypeOrThrow(
      runtimeSession.runnerType
    ).createSession(
      session.id,
      runtimeSession.runnerConfig,
      runtimeSession.platformSessionConfig,
      runtimeSession.runnerSessionConfig
    );

    const updatedSession = await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        runnerState: toInputJson(runnerState as Prisma.InputJsonValue)
      }
    });
    const updatedRuntimeSession = await this.buildRunnerSessionRecord(updatedSession);

    const outputConsumer = this.consumeRunnerOutput(updatedRuntimeSession).finally(
      () => {
        this.outputConsumers.delete(sessionId);
      }
    );
    this.outputConsumers.set(sessionId, outputConsumer);

    return updatedRuntimeSession;
  }

  private async buildRunnerSessionRecord(
    session: SessionRow
  ): Promise<RunnerSessionRecord> {
    const runner = await this.sessionsQueryService.getRunnerOrThrow(session.runnerId);

    return {
      id: session.id,
      runnerId: runner.id,
      runnerType: session.runnerType,
      runnerConfig: asPlainObject(runner.runnerConfig),
      runnerState: asPlainObject(session.runnerState),
      platformSessionConfig: platformSessionConfigSchema.parse(
        asPlainObject(session.platformSessionConfig)
      ),
      runnerSessionConfig: asPlainObject(session.runnerSessionConfig)
    };
  }

  private async consumeRunnerOutput(runtimeSession: RunnerSessionRecord) {
    const runnerType = this.getRunnerTypeOrThrow(runtimeSession.runnerType);
    let outputError: unknown;

    try {
      for await (const chunk of runnerType.output(runtimeSession)) {
        await this.handleRunnerChunk(runtimeSession.id, chunk);
      }
    } catch (error) {
      outputError = error;
      this.logger.error(
        `Runner output crashed for ${runtimeSession.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }

    await this.reconcileOutputConsumerExit(runtimeSession, outputError);
  }

  private async reconcileOutputConsumerExit(
    runtimeSession: RunnerSessionRecord,
    outputError?: unknown
  ) {
    const session = await this.sessionsQueryService.getSessionOrNull(runtimeSession.id);
    if (!session || (session.status as SessionStatus) !== SessionStatus.Running) {
      return;
    }

    const streamingMessage =
      await this.sessionsQueryService.getLatestStreamingAssistantMessage(
        runtimeSession.id
      );
    if (!streamingMessage) {
      await this.prisma.agentSession.update({
        where: { id: runtimeSession.id },
        data: {
          status: SessionStatus.Ready,
          activeAssistantMessageId: null
        }
      });
      await this.emitSessionStatus(
        runtimeSession.id,
        SessionStatus.Ready,
        SessionStatus.Running
      );
      return;
    }

    await this.handleNonRecoverableMessageError(runtimeSession.id, streamingMessage.id, {
      message:
        outputError instanceof Error
          ? outputError.message
          : 'Runner output stopped unexpectedly',
      code:
        outputError === undefined
          ? 'RUNNER_OUTPUT_CLOSED'
          : 'RUNNER_OUTPUT_CRASHED',
      recoverable: false
    });
  }

  private async handleRunnerChunk(sessionId: string, chunk: RawOutputChunk) {
    if (!(await this.shouldAcceptChunk(sessionId, chunk.messageId))) {
      return;
    }

    switch (chunk.kind) {
      case 'thinking_delta': {
        const nextThinkingText = this.pushThinkingAccumulator(
          sessionId,
          chunk.messageId,
          chunk.data
        );
        const eventId = await this.sessionEventStore.nextEventId(sessionId);
        await this.emitChunk({
          kind: 'thinking_delta',
          sessionId,
          eventId,
          messageId: chunk.messageId,
          timestampMs: chunk.timestampMs,
          data: {
            ...chunk.data,
            accumulatedText: nextThinkingText
          }
        });
        return;
      }

      case 'message_delta': {
        const eventId = await this.sessionEventStore.nextEventId(sessionId);
        await this.emitChunk({
          kind: 'message_delta',
          sessionId,
          eventId,
          messageId: chunk.messageId,
          timestampMs: chunk.timestampMs,
          data: chunk.data
        });
        return;
      }

      case 'tool_use': {
        const eventId = await this.sessionEventStore.nextEventId(sessionId);
        await this.prisma.messageToolUse.create({
          data: {
            sessionId,
            messageId: chunk.messageId,
            eventId,
            callId:
              typeof chunk.data.callId === 'string' ? chunk.data.callId : null,
            toolName: chunk.data.toolName,
            args: toOptionalInputJson(
              chunk.data.args as Prisma.InputJsonValue | undefined
            ),
            result: toOptionalInputJson(
              chunk.data.result as Prisma.InputJsonValue | undefined
            ),
            error: toOptionalInputJson(
              chunk.data.error as Prisma.InputJsonValue | undefined
            )
          }
        });
        await this.emitChunk({
          kind: 'tool_use',
          sessionId,
          eventId,
          messageId: chunk.messageId,
          timestampMs: chunk.timestampMs,
          data: chunk.data
        });
        return;
      }

      case 'usage': {
        const eventId = await this.sessionEventStore.nextEventId(sessionId);
        await this.prisma.sessionMetric.create({
          data: {
            sessionId,
            messageId: chunk.messageId,
            eventId,
            kind: MetricKind.TokenUsage,
            data: toInputJson(chunk.data as Prisma.InputJsonValue)
          }
        });
        await this.emitChunk({
          kind: 'usage',
          sessionId,
          eventId,
          messageId: chunk.messageId,
          timestampMs: chunk.timestampMs,
          data: chunk.data
        });
        return;
      }

      case 'message_result': {
        await this.handleMessageResult(sessionId, chunk);
        return;
      }

      case 'error': {
        const payload = errorPayloadSchema.parse(chunk.data);
        if (payload.recoverable) {
          await this.handleRecoverableMessageError(
            sessionId,
            chunk.messageId,
            payload
          );
          return;
        }

        await this.handleNonRecoverableMessageError(
          sessionId,
          chunk.messageId,
          payload
        );
      }
    }
  }

  private async handleMessageResult(
    sessionId: string,
    chunk: Extract<RawOutputChunk, { kind: 'message_result' }>
  ) {
    if (!(await this.shouldAcceptChunk(sessionId, chunk.messageId))) {
      return;
    }

    const eventId = await this.sessionEventStore.nextEventId(sessionId);
    const thinkingText = this.consumeThinkingAccumulator(sessionId, chunk.messageId);
    await this.prisma.$transaction([
      this.prisma.sessionMessage.update({
        where: { id: chunk.messageId },
        data: {
          status: MessageStatus.Complete,
          outputText: chunk.data.text,
          thinkingText,
          eventId
        }
      }),
      this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.Ready,
          activeAssistantMessageId: null
        }
      })
    ]);

    await this.emitChunk({
      kind: 'message_result',
      sessionId,
      eventId,
      messageId: chunk.messageId,
      timestampMs: chunk.timestampMs,
      data: chunk.data
    });
    await this.emitSessionStatus(
      sessionId,
      SessionStatus.Ready,
      SessionStatus.Running
    );
    await this.emitDone(sessionId, chunk.messageId);
  }

  private async readStoredOutputText(sessionId: string, messageId: string) {
    let accumulatedText: string | null = null;
    let combinedText = '';
    let hasChunk = false;

    const chunks = await this.sessionEventStore.listMessageDeltas(sessionId, messageId);
    for (const chunk of chunks) {
      if (chunk.kind !== 'message_delta') {
        continue;
      }

      hasChunk = true;
      accumulatedText = chunk.data.accumulatedText ?? accumulatedText;
      if (!chunk.data.accumulatedText) {
        combinedText += chunk.data.deltaText;
      }
    }

    if (accumulatedText && accumulatedText.length > 0) {
      return accumulatedText;
    }

    if (hasChunk && combinedText.length > 0) {
      return combinedText;
    }

    return null;
  }

  private async shouldAcceptChunk(sessionId: string, messageId: string) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: {
        status: true,
        activeAssistantMessageId: true
      }
    });

    return (
      session?.status === SessionStatus.Running &&
      session.activeAssistantMessageId === messageId
    );
  }

  async emitSessionStatus(
    sessionId: string,
    status: SessionStatus,
    prevStatus: SessionStatus
  ) {
    const eventId = await this.sessionEventStore.nextEventId(sessionId);
    await this.emitChunk({
      kind: 'session_status',
      sessionId,
      eventId,
      timestampMs: Date.now(),
      data: {
        status,
        prevStatus
      }
    });
  }

  async emitDone(sessionId: string, messageId: string) {
    const eventId = await this.sessionEventStore.nextEventId(sessionId);
    await this.emitChunk({
      kind: 'done',
      sessionId,
      eventId,
      messageId,
      timestampMs: Date.now()
    });
  }

  private async emitChunk(chunk: OutputChunk) {
    await this.sessionEventStore.append(chunk);
  }

  private getThinkingAccumulatorKey(sessionId: string, messageId: string) {
    return `${sessionId}:${messageId}`;
  }

  private pushThinkingAccumulator(
    sessionId: string,
    messageId: string,
    data: Extract<OutputChunk, { kind: 'thinking_delta' }>['data']
  ) {
    const key = this.getThinkingAccumulatorKey(sessionId, messageId);
    const nextValue =
      data.accumulatedText ??
      `${this.thinkingAccumulators.get(key) ?? ''}${data.deltaText}`;
    this.thinkingAccumulators.set(key, nextValue);
    return nextValue;
  }

  private clearThinkingAccumulator(sessionId: string, messageId: string) {
    this.thinkingAccumulators.delete(
      this.getThinkingAccumulatorKey(sessionId, messageId)
    );
  }

  private consumeThinkingAccumulator(sessionId: string, messageId: string) {
    const key = this.getThinkingAccumulatorKey(sessionId, messageId);
    const value = this.thinkingAccumulators.get(key) ?? null;
    this.thinkingAccumulators.delete(key);
    return value;
  }
}
