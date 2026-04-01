import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  MessageRole,
  MessageStatus,
  MetricKind,
  SessionStatus,
  createSessionInputSchema,
  errorPayloadSchema,
  platformSessionConfigSchema,
  type ErrorPayload,
  type OutputChunk,
  type SessionDetail,
  type SessionMessageMetric,
  type SessionMessageDetail,
  type SessionSummary,
  type SessionToolUse
} from '@agent-workbench/shared';
import type { AgentRunner, Prisma } from '@prisma/client';
import { Observable, Subject } from 'rxjs';

import {
  asPlainObject,
  sanitizeJson,
  toInputJson,
  toNullableInputJson
} from '../../common/json.utils';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { FileDeltaStore, type StoredDeltaChunk } from './file-delta.store';
import { RunnerTypeRegistry } from '../agent-runners/runner-type.registry';
import type {
  RawOutputChunk,
  RunnerSessionRecord,
  RunnerType
} from '../agent-runners/runner-type.interface';
import type {
  CreateSessionDto,
  EditSessionMessageDto,
  SendSessionMessageDto
} from './dto/session.dto';

type SessionRow = Prisma.AgentSessionGetPayload<Record<string, never>>;
type SessionMessageRow = Prisma.SessionMessageGetPayload<Record<string, never>>;
type SessionMetricRow = Prisma.SessionMetricGetPayload<Record<string, never>>;
type MessageDeltaData = Extract<OutputChunk, { kind: 'message_delta' }>['data'];
type UsageData = Extract<OutputChunk, { kind: 'usage' }>['data'];

@Injectable()
export class SessionsService implements OnModuleInit {
  private readonly logger = new Logger(SessionsService.name);
  private readonly subjects = new Map<string, Subject<OutputChunk>>();
  private readonly runtimeInitPromises = new Map<string, Promise<RunnerSessionRecord>>();
  private readonly outputConsumers = new Map<string, Promise<void>>();
  private readonly sendLocks = new Map<string, boolean>();
  private readonly deltaSeqs = new Map<string, number>();
  private readonly thinkingAccumulators = new Map<string, string>();
  private readonly replayOverflowSessions = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly runnerTypeRegistry: RunnerTypeRegistry,
    private readonly fileDeltaStore: FileDeltaStore
  ) {}

  async onModuleInit() {
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
        status: SessionStatus.Error
      }
    });
  }

  async list(scopeId: string): Promise<SessionSummary[]> {
    await this.assertProjectExists(scopeId);

    const sessions = await this.prisma.agentSession.findMany({
      where: { scopeId },
      orderBy: { updatedAt: 'desc' }
    });

    return sessions.map((session) => this.toSessionSummary(session));
  }

  async getById(id: string): Promise<SessionDetail> {
    const session = await this.getSessionOrThrow(id);
    return this.toSessionDetail(session);
  }

  async create(dto: CreateSessionDto): Promise<SessionDetail> {
    const parsed = parseSchemaOrThrow(
      createSessionInputSchema,
      dto,
      'Invalid session payload'
    );

    const project = await this.assertProjectExists(parsed.scopeId);
    const runner = await this.getRunnerOrThrow(parsed.runnerId);
    const runnerType = this.getRunnerTypeOrThrow(runner.type);
    const runnerSessionConfig = parseSchemaOrThrow(
      runnerType.runnerSessionConfigSchema,
      parsed.runnerSessionConfig,
      'Invalid runnerSessionConfig'
    ) as Record<string, unknown>;

    await this.assertResourceIdsExist('skill', parsed.skillIds);
    await this.assertResourceIdsExist('rule', parsed.ruleIds);
    await this.assertResourceIdsExist(
      'mcp',
      parsed.mcps.map((item) => item.resourceId)
    );

    const platformSessionConfig = platformSessionConfigSchema.parse({
      cwd: project.workspacePath,
      skillIds: parsed.skillIds,
      ruleIds: parsed.ruleIds,
      mcps: parsed.mcps
    });

    const created = await this.prisma.agentSession.create({
      data: {
        runnerId: runner.id,
        runnerType: runner.type,
        scopeId: project.id,
        status: SessionStatus.Creating,
        platformSessionConfig: toInputJson(platformSessionConfig),
        runnerSessionConfig: toInputJson(
          runnerSessionConfig as Prisma.InputJsonValue
        ),
        runnerState: toInputJson({} as Prisma.InputJsonValue)
      }
    });

    try {
      await this.ensureRuntime(created.id);
      await this.prisma.agentSession.update({
        where: { id: created.id },
        data: { status: SessionStatus.Ready }
      });
    } catch (error) {
      await this.prisma.agentSession.update({
        where: { id: created.id },
        data: { status: SessionStatus.Error }
      });
      throw error;
    }

    return this.getById(created.id);
  }

  async listMessages(sessionId: string): Promise<SessionMessageDetail[]> {
    await this.getSessionOrThrow(sessionId);

    const messages = await this.prisma.sessionMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const toolUses = await this.prisma.messageToolUse.findMany({
      where: { sessionId },
      orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
    });
    const metrics = await this.prisma.sessionMetric.findMany({
      where: { sessionId },
      orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
    });
    const toolUsesByMessageId = new Map<string, SessionToolUse[]>();
    const metricsByMessageId = new Map<string, SessionMessageMetric[]>();

    for (const toolUse of toolUses) {
      const list = toolUsesByMessageId.get(toolUse.messageId) ?? [];
      list.push({
        id: toolUse.id,
        eventId: toolUse.eventId,
        callId: toolUse.callId,
        toolName: toolUse.toolName,
        args: sanitizeJson(toolUse.args),
        result: sanitizeJson(toolUse.result),
        error: sanitizeJson(toolUse.error),
        createdAt: toolUse.createdAt.toISOString()
      });
      toolUsesByMessageId.set(toolUse.messageId, list);
    }

    for (const metric of metrics) {
      if (!metric.messageId) {
        continue;
      }

      const list = metricsByMessageId.get(metric.messageId) ?? [];
      list.push(this.toSessionMessageMetric(metric));
      metricsByMessageId.set(metric.messageId, list);
    }

    return messages.map((message) =>
      this.toSessionMessageDetail(
        message,
        toolUsesByMessageId.get(message.id) ?? [],
        metricsByMessageId.get(message.id) ?? []
      )
    );
  }

  async sendMessage(
    sessionId: string,
    dto: SendSessionMessageDto
  ): Promise<SessionMessageDetail[]> {
    const session = await this.getSessionOrThrow(sessionId);
    this.assertSendableStatus(session.status);

    if (this.sendLocks.get(sessionId)) {
      throw this.buildConflict('Session is busy', 'RUNNING');
    }

    this.sendLocks.set(sessionId, true);

    try {
      const parsedInput = await this.parseMessageInput(sessionId, dto.input);
      await this.sendParsedInput(sessionId, parsedInput);
      return this.listMessages(sessionId);
    } finally {
      this.sendLocks.delete(sessionId);
    }
  }

  async cancel(sessionId: string): Promise<SessionDetail> {
    const session = await this.getSessionOrThrow(sessionId);
    const sessionStatus = session.status as SessionStatus;

    if (sessionStatus !== SessionStatus.Running) {
      return this.toSessionDetail(session);
    }

    const streamingMessage = await this.getLatestStreamingAssistantMessage(sessionId);
    if (!streamingMessage) {
      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.Ready }
      });
      await this.emitSessionStatus(
        sessionId,
        SessionStatus.Ready,
        SessionStatus.Running
      );
      return this.getById(sessionId);
    }

    const runtimeSession = await this.getRuntimeIfPresent(sessionId);
    if (runtimeSession) {
      await this.getRunnerTypeOrThrow(runtimeSession.runnerType).cancelOutput(
        runtimeSession
      );
    }

    await this.handleRecoverableMessageError(
      sessionId,
      streamingMessage.id,
      {
        message: '当前输出已中止',
        code: 'USER_CANCELLED',
        recoverable: true
      },
      {
        cancelledAt: new Date()
      }
    );

    return this.getById(sessionId);
  }

  async reload(sessionId: string): Promise<SessionDetail> {
    const session = await this.getSessionOrThrow(sessionId);
    this.assertSendableStatus(session.status);

    const messages = await this.prisma.sessionMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const lastUserIndex = [...messages]
      .map((message) => message.role)
      .lastIndexOf('user');
    const lastUserMessage =
      lastUserIndex >= 0 ? messages[lastUserIndex] : undefined;

    if (!lastUserMessage?.inputContent) {
      throw new BadRequestException('No previous user message to reload');
    }

    const hasAssistantAfterUser = messages
      .slice(lastUserIndex + 1)
      .some((message) => message.role === 'assistant');

    if (!hasAssistantAfterUser) {
      throw new BadRequestException('No previous assistant message to reload');
    }

    await this.truncateSessionHistoryFrom(sessionId, lastUserMessage.id);
    await this.rerunExistingUserInput(
      sessionId,
      asPlainObject(lastUserMessage.inputContent)
    );

    return this.getById(sessionId);
  }

  async editMessage(
    sessionId: string,
    messageId: string,
    dto: EditSessionMessageDto
  ): Promise<SessionDetail> {
    const session = await this.getSessionOrThrow(sessionId);
    this.assertSendableStatus(session.status);

    const targetMessage = await this.prisma.sessionMessage.findFirst({
      where: {
        id: messageId,
        sessionId
      }
    });

    if (!targetMessage) {
      throw new NotFoundException(`Session message not found: ${messageId}`);
    }

    if (targetMessage.role !== 'user') {
      throw new BadRequestException('Only user messages can be edited');
    }

    const parsedInput = await this.parseMessageInput(sessionId, dto.input);
    await this.truncateSessionHistoryFrom(sessionId, messageId);
    await this.sendParsedInput(sessionId, parsedInput);

    return this.getById(sessionId);
  }

  async dispose(sessionId: string): Promise<SessionDetail> {
    const session = await this.getSessionOrThrow(sessionId);
    const sessionStatus = session.status as SessionStatus;

    if (sessionStatus === SessionStatus.Disposed) {
      return this.toSessionDetail(session);
    }

    if (sessionStatus !== SessionStatus.Disposing) {
      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.Disposing }
      });

      await this.emitSessionStatus(
        sessionId,
        SessionStatus.Disposing,
        sessionStatus
      );
    }

    if (sessionStatus === SessionStatus.Running) {
      const streamingMessage = await this.prisma.sessionMessage.findFirst({
        where: {
          sessionId,
          role: MessageRole.Assistant,
          status: MessageStatus.Streaming
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      });

      if (streamingMessage) {
        await this.handleNonRecoverableMessageError(
          sessionId,
          streamingMessage.id,
          {
            message: '会话被强制销毁',
            code: 'SESSION_FORCE_DESTROYED',
            recoverable: false
          },
          false
        );
      }

      const runtimeSession = await this.getRuntimeIfPresent(sessionId);
      if (runtimeSession) {
        await Promise.race([
          this.getRunnerTypeOrThrow(runtimeSession.runnerType).cancelOutput(
            runtimeSession
          ),
          sleep(5_000)
        ]);
      }
    }

    const runtimeSession = await this.getRuntimeIfPresent(sessionId);
    if (runtimeSession) {
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
    }

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.Disposed,
        runnerState: toInputJson({} as Prisma.InputJsonValue)
      }
    });

    await this.emitSessionStatus(
      sessionId,
      SessionStatus.Disposed,
      SessionStatus.Disposing
    );
    this.completeSubject(sessionId);

    return this.getById(sessionId);
  }

  async createEventsStream(sessionId: string, afterEventId = 0) {
    await this.getSessionOrThrow(sessionId);

    if (this.replayOverflowSessions.get(sessionId) === afterEventId) {
      this.replayOverflowSessions.delete(sessionId);
      throw new ServiceUnavailableException({
        message: 'Session replay buffer overflowed, retry later',
        data: {
          retryAfterMs: 1000
        }
      });
    }

    return new Observable<MessageEvent>((subscriber) => {
      const subject = this.getSubject(sessionId);
      const bufferedEvents: OutputChunk[] = [];
      const replayedEventIds = new Set<number>();
      let liveMode = false;
      let closed = false;

      const subscription = subject.subscribe({
        next: (chunk) => {
          if (chunk.eventId <= afterEventId) {
            return;
          }

          if (!liveMode) {
            bufferedEvents.push(chunk);
            if (bufferedEvents.length > 500) {
              this.replayOverflowSessions.set(sessionId, afterEventId);
              closed = true;
              subscription.unsubscribe();
              subscriber.complete();
            }
            return;
          }

          subscriber.next(toMessageEvent(chunk));
        },
        error: (error) => subscriber.error(error),
        complete: () => subscriber.complete()
      });

      void (async () => {
        try {
          const replayEvents = await this.getReplayEvents(sessionId, afterEventId);
          if (closed) {
            return;
          }

          for (const event of replayEvents) {
            if (event.eventId <= afterEventId) {
              continue;
            }

            replayedEventIds.add(event.eventId);
            subscriber.next(toMessageEvent(event));
          }

          for (const event of bufferedEvents) {
            if (replayedEventIds.has(event.eventId)) {
              continue;
            }

            replayedEventIds.add(event.eventId);
            subscriber.next(toMessageEvent(event));
          }

          liveMode = true;
        } catch (error) {
          subscriber.error(error);
        }
      })();

      return () => {
        subscription.unsubscribe();
      };
    });
  }

  getSubject(sessionId: string) {
    let subject = this.subjects.get(sessionId);
    if (!subject) {
      subject = new Subject<OutputChunk>();
      this.subjects.set(sessionId, subject);
    }

    return subject;
  }

  private completeSubject(sessionId: string) {
    const subject = this.subjects.get(sessionId);
    if (!subject) {
      return;
    }

    subject.complete();
    this.subjects.delete(sessionId);
  }

  private async getReplayEvents(sessionId: string, afterEventId: number) {
    const messages = await this.prisma.sessionMessage.findMany({
      where: {
        sessionId,
        eventId: {
          gt: afterEventId
        }
      },
      orderBy: { eventId: 'asc' }
    });
    const toolUses = await this.prisma.messageToolUse.findMany({
      where: {
        sessionId,
        eventId: {
          gt: afterEventId
        }
      },
      orderBy: { eventId: 'asc' }
    });
    const metrics = await this.prisma.sessionMetric.findMany({
      where: {
        sessionId,
        eventId: {
          gt: afterEventId
        }
      },
      orderBy: { eventId: 'asc' }
    });
    const streamingMessages = await this.prisma.sessionMessage.findMany({
      where: {
        sessionId,
        role: MessageRole.Assistant,
        status: MessageStatus.Streaming
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    const events: OutputChunk[] = [];

    for (const message of messages) {
      if (message.eventId === null) {
        continue;
      }

      if (message.outputText) {
        events.push({
          kind: 'message_result',
          sessionId,
          eventId: message.eventId,
          messageId: message.id,
          timestampMs: message.createdAt.getTime(),
          data: {
            text: message.outputText
          }
        });
      } else if (message.errorPayload) {
        events.push({
          kind: 'error',
          sessionId,
          eventId: message.eventId,
          messageId: message.id,
          timestampMs: message.createdAt.getTime(),
          data: errorPayloadSchema.parse(sanitizeJson(message.errorPayload))
        });
      }
    }

    for (const toolUse of toolUses) {
      events.push({
        kind: 'tool_use',
        sessionId,
        eventId: toolUse.eventId,
        messageId: toolUse.messageId,
        timestampMs: toolUse.createdAt.getTime(),
        data: {
          toolName: toolUse.toolName,
          args: sanitizeJson(toolUse.args),
          result: sanitizeJson(toolUse.result),
          error: sanitizeJson(toolUse.error),
          callId: toolUse.callId ?? undefined
        }
      });
    }

    for (const metric of metrics) {
      events.push({
        kind: 'usage',
        sessionId,
        eventId: metric.eventId,
        messageId: metric.messageId ?? undefined,
        timestampMs: metric.createdAt.getTime(),
          data: sanitizeJson(metric.data) as UsageData
      });
    }

    for (const message of streamingMessages) {
      for await (const delta of this.fileDeltaStore.readAll(sessionId, message.id)) {
        events.push(this.toOutputChunkFromStoredDelta(delta));
      }
    }

    return events.sort((left, right) => left.eventId - right.eventId);
  }

  private async ensureRuntime(sessionId: string): Promise<RunnerSessionRecord> {
    const existing = this.runtimeInitPromises.get(sessionId);
    if (existing) {
      return existing;
    }

    if (this.outputConsumers.has(sessionId)) {
      return this.buildRunnerSessionRecord(await this.getSessionOrThrow(sessionId));
    }

    const initPromise = this.initializeRuntime(sessionId).finally(() => {
      this.runtimeInitPromises.delete(sessionId);
    });
    this.runtimeInitPromises.set(sessionId, initPromise);

    return initPromise;
  }

  private async initializeRuntime(sessionId: string) {
    const session = await this.getSessionOrThrow(sessionId);
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

  private async getRuntimeIfPresent(sessionId: string) {
    const session = await this.getSessionOrThrow(sessionId);
    const runnerState = asPlainObject(session.runnerState);
    if (Object.keys(runnerState).length === 0) {
      return null;
    }

    return this.buildRunnerSessionRecord(session);
  }

  private async consumeRunnerOutput(runtimeSession: RunnerSessionRecord) {
    const runnerType = this.getRunnerTypeOrThrow(runtimeSession.runnerType);

    try {
      for await (const chunk of runnerType.output(runtimeSession)) {
        await this.handleRunnerChunk(runtimeSession.id, chunk);
      }
    } catch (error) {
      this.logger.error(
        `Runner output crashed for ${runtimeSession.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }
  }

  private async handleRunnerChunk(sessionId: string, chunk: RawOutputChunk) {
    switch (chunk.kind) {
      case 'thinking_delta': {
        const nextThinkingText = this.pushThinkingAccumulator(
          sessionId,
          chunk.messageId,
          chunk.data
        );
        const eventId = await this.incrementAndGetEventId(sessionId);
        this.emitChunk({
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
        const eventId = await this.incrementAndGetEventId(sessionId);
        const seq = this.nextDeltaSeq(sessionId, chunk.messageId);
        const storedDelta: StoredDeltaChunk = {
          eventId,
          sessionId,
          messageId: chunk.messageId,
          seq,
          timestampMs: chunk.timestampMs,
          kind: 'message_delta',
          data: chunk.data as MessageDeltaData
        };
        await this.fileDeltaStore.append(storedDelta);
        this.emitChunk(this.toOutputChunkFromStoredDelta(storedDelta));
        return;
      }

      case 'tool_use': {
        const eventId = await this.incrementAndGetEventId(sessionId);
        await this.prisma.messageToolUse.create({
          data: {
            sessionId,
            messageId: chunk.messageId,
            eventId,
            callId:
              typeof chunk.data.callId === 'string' ? chunk.data.callId : null,
            toolName: chunk.data.toolName,
            args: toNullableInputJson(
              chunk.data.args as Prisma.InputJsonValue | undefined
            ),
            result: toNullableInputJson(
              chunk.data.result as Prisma.InputJsonValue | undefined
            ),
            error: toNullableInputJson(
              chunk.data.error as Prisma.InputJsonValue | undefined
            )
          }
        });
        this.emitChunk({
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
        const eventId = await this.incrementAndGetEventId(sessionId);
        await this.prisma.sessionMetric.create({
          data: {
            sessionId,
            messageId: chunk.messageId,
            eventId,
            kind: MetricKind.TokenUsage,
            data: toInputJson(chunk.data as Prisma.InputJsonValue)
          }
        });
        this.emitChunk({
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
    const eventId = await this.incrementAndGetEventId(sessionId);
    const thinkingText = this.consumeThinkingAccumulator(sessionId, chunk.messageId);
    await this.prisma.sessionMessage.update({
      where: { id: chunk.messageId },
      data: {
        status: MessageStatus.Complete,
        outputText: chunk.data.text,
        thinkingText,
        eventId
      }
    });

    try {
      await this.fileDeltaStore.delete(sessionId, chunk.messageId);
    } catch (error) {
      this.logger.warn(
        `Failed to delete delta file for ${sessionId}/${chunk.messageId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }

    this.deltaSeqs.delete(this.getDeltaSeqKey(sessionId, chunk.messageId));

    this.emitChunk({
      kind: 'message_result',
      sessionId,
      eventId,
      messageId: chunk.messageId,
      timestampMs: chunk.timestampMs,
      data: chunk.data
    });

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.Ready }
    });
    await this.emitSessionStatus(
      sessionId,
      SessionStatus.Ready,
      SessionStatus.Running
    );
    await this.emitDone(sessionId, chunk.messageId);
  }

  private async handleRecoverableMessageError(
    sessionId: string,
    messageId: string,
    payload: ErrorPayload,
    options?: {
      cancelledAt?: Date;
    }
  ) {
    const eventId = await this.incrementAndGetEventId(sessionId);
    const thinkingText = this.consumeThinkingAccumulator(sessionId, messageId);
    await this.prisma.sessionMessage.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.Error,
        errorPayload: toInputJson(payload),
        thinkingText,
        cancelledAt: options?.cancelledAt,
        eventId
      }
    });

    this.deltaSeqs.delete(this.getDeltaSeqKey(sessionId, messageId));

    this.emitChunk({
      kind: 'error',
      sessionId,
      eventId,
      messageId,
      timestampMs: Date.now(),
      data: payload
    });

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.Ready }
    });
    await this.emitSessionStatus(
      sessionId,
      SessionStatus.Ready,
      SessionStatus.Running
    );
    await this.emitDone(sessionId, messageId);
  }

  private async handleNonRecoverableMessageError(
    sessionId: string,
    messageId: string,
    payload: ErrorPayload,
    emitErrorState = true
  ) {
    const eventId = await this.incrementAndGetEventId(sessionId);
    const thinkingText = this.consumeThinkingAccumulator(sessionId, messageId);
    await this.prisma.sessionMessage.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.Error,
        errorPayload: toInputJson(payload),
        thinkingText,
        eventId
      }
    });

    this.deltaSeqs.delete(this.getDeltaSeqKey(sessionId, messageId));

    this.emitChunk({
      kind: 'error',
      sessionId,
      eventId,
      messageId,
      timestampMs: Date.now(),
      data: payload
    });

    if (!emitErrorState) {
      return;
    }

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.Error }
    });
    await this.emitSessionStatus(
      sessionId,
      SessionStatus.Error,
      SessionStatus.Running
    );
  }

  private async emitSessionStatus(
    sessionId: string,
    status: SessionStatus,
    prevStatus: SessionStatus
  ) {
    const eventId = await this.incrementAndGetEventId(sessionId);
    this.emitChunk({
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

  private async emitDone(sessionId: string, messageId: string) {
    const eventId = await this.incrementAndGetEventId(sessionId);
    this.emitChunk({
      kind: 'done',
      sessionId,
      eventId,
      messageId,
      timestampMs: Date.now()
    });
  }

  private emitChunk(chunk: OutputChunk) {
    this.getSubject(chunk.sessionId).next(chunk);
  }

  private async incrementAndGetEventId(sessionId: string) {
    const updated = await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        lastEventId: {
          increment: 1
        }
      },
      select: {
        lastEventId: true
      }
    });

    return updated.lastEventId;
  }

  private nextDeltaSeq(sessionId: string, messageId: string) {
    const key = this.getDeltaSeqKey(sessionId, messageId);
    const nextValue = (this.deltaSeqs.get(key) ?? 0) + 1;
    this.deltaSeqs.set(key, nextValue);
    return nextValue;
  }

  private getDeltaSeqKey(sessionId: string, messageId: string) {
    return `${sessionId}:${messageId}`;
  }

  private toOutputChunkFromStoredDelta(chunk: StoredDeltaChunk): OutputChunk {
    return {
      kind: 'message_delta',
      sessionId: chunk.sessionId,
      eventId: chunk.eventId,
      messageId: chunk.messageId,
      timestampMs: chunk.timestampMs,
      data: chunk.data
    };
  }

  private async parseMessageInput(sessionId: string, input: Record<string, unknown>) {
    const runtimeSession = await this.ensureRuntime(sessionId);
    return parseSchemaOrThrow(
      this.getRunnerTypeOrThrow(runtimeSession.runnerType).inputSchema,
      input,
      'Invalid message input'
    ) as Record<string, unknown>;
  }

  private async sendParsedInput(
    sessionId: string,
    parsedInput: Record<string, unknown>
  ) {
    const runtimeSession = await this.ensureRuntime(sessionId);
    const previousStatus = (await this.getSessionOrThrow(sessionId)).status as SessionStatus;
    const created = await this.prisma.$transaction(async (tx) => {
      const userMessage = await tx.sessionMessage.create({
        data: {
          sessionId,
          role: MessageRole.User,
          status: MessageStatus.Sent,
          inputContent: toInputJson(parsedInput as Prisma.InputJsonValue)
        }
      });
      const assistantMessage = await tx.sessionMessage.create({
        data: {
          sessionId,
          role: MessageRole.Assistant,
          status: MessageStatus.Streaming
        }
      });
      await tx.agentSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.Running }
      });

      return {
        userMessage,
        assistantMessage
      };
    });

    this.deltaSeqs.set(
      this.getDeltaSeqKey(sessionId, created.assistantMessage.id),
      0
    );
    this.thinkingAccumulators.delete(
      this.getThinkingAccumulatorKey(sessionId, created.assistantMessage.id)
    );

    await this.emitSessionStatus(sessionId, SessionStatus.Running, previousStatus);

    try {
      await this.getRunnerTypeOrThrow(runtimeSession.runnerType).send(runtimeSession, {
        messageId: created.assistantMessage.id,
        input: parsedInput
      });
    } catch (error) {
      await this.handleRecoverableMessageError(
        sessionId,
        created.assistantMessage.id,
        {
          message: error instanceof Error ? error.message : 'Runner failed to send',
          code: 'RUNNER_SEND_FAILED',
          recoverable: true
        }
      );
    }
  }

  private async rerunExistingUserInput(
    sessionId: string,
    parsedInput: Record<string, unknown>
  ) {
    const runtimeSession = await this.ensureRuntime(sessionId);
    const previousStatus = (await this.getSessionOrThrow(sessionId)).status as SessionStatus;
    const assistantMessage = await this.prisma.$transaction(async (tx) => {
      const createdAssistantMessage = await tx.sessionMessage.create({
        data: {
          sessionId,
          role: MessageRole.Assistant,
          status: MessageStatus.Streaming
        }
      });
      await tx.agentSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.Running }
      });

      return createdAssistantMessage;
    });

    this.deltaSeqs.set(
      this.getDeltaSeqKey(sessionId, assistantMessage.id),
      0
    );
    this.thinkingAccumulators.delete(
      this.getThinkingAccumulatorKey(sessionId, assistantMessage.id)
    );

    await this.emitSessionStatus(sessionId, SessionStatus.Running, previousStatus);

    try {
      await this.getRunnerTypeOrThrow(runtimeSession.runnerType).send(runtimeSession, {
        messageId: assistantMessage.id,
        input: parsedInput
      });
    } catch (error) {
      await this.handleRecoverableMessageError(
        sessionId,
        assistantMessage.id,
        {
          message: error instanceof Error ? error.message : 'Runner failed to send',
          code: 'RUNNER_SEND_FAILED',
          recoverable: true
        }
      );
    }
  }

  private async truncateSessionHistoryFrom(sessionId: string, fromMessageId: string) {
    const messages = await this.prisma.sessionMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const startIndex = messages.findIndex((message) => message.id === fromMessageId);

    if (startIndex === -1) {
      throw new NotFoundException(`Session message not found: ${fromMessageId}`);
    }

    const messageIds = messages.slice(startIndex).map((message) => message.id);
    if (messageIds.length === 0) {
      return;
    }

    for (const messageId of messageIds) {
      this.deltaSeqs.delete(this.getDeltaSeqKey(sessionId, messageId));
      this.thinkingAccumulators.delete(
        this.getThinkingAccumulatorKey(sessionId, messageId)
      );
    }

    await this.prisma.$transaction([
      this.prisma.messageToolUse.deleteMany({
        where: {
          sessionId,
          messageId: { in: messageIds }
        }
      }),
      this.prisma.sessionMetric.deleteMany({
        where: {
          sessionId,
          messageId: { in: messageIds }
        }
      }),
      this.prisma.sessionMessage.deleteMany({
        where: {
          sessionId,
          id: { in: messageIds }
        }
      })
    ]);

    await Promise.all(
      messageIds.map(async (messageId) => {
        try {
          await this.fileDeltaStore.delete(sessionId, messageId);
        } catch (error) {
          this.logger.warn(
            `Failed to delete delta file for ${sessionId}/${messageId}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`
          );
        }
      })
    );
  }

  private async getLatestStreamingAssistantMessage(sessionId: string) {
    return this.prisma.sessionMessage.findFirst({
      where: {
        sessionId,
        role: MessageRole.Assistant,
        status: MessageStatus.Streaming
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
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

  private consumeThinkingAccumulator(sessionId: string, messageId: string) {
    const key = this.getThinkingAccumulatorKey(sessionId, messageId);
    const value = this.thinkingAccumulators.get(key) ?? null;
    this.thinkingAccumulators.delete(key);
    return value;
  }

  private async buildRunnerSessionRecord(
    session: SessionRow
  ): Promise<RunnerSessionRecord> {
    const runner = await this.getRunnerOrThrow(session.runnerId);

    return {
      id: session.id,
      runnerId: runner.id,
      runnerType: session.runnerType,
      runnerConfig: asPlainObject(runner.runnerConfig),
      runnerState: asPlainObject(session.runnerState),
      platformSessionConfig: platformSessionConfigSchema.parse(
        sanitizeJson(session.platformSessionConfig)
      ),
      runnerSessionConfig: asPlainObject(session.runnerSessionConfig)
    };
  }

  private toSessionSummary(session: SessionRow): SessionSummary {
    return {
      id: session.id,
      scopeId: session.scopeId,
      runnerId: session.runnerId,
      runnerType: session.runnerType,
      status: session.status as SessionStatus,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }

  private toSessionDetail(session: SessionRow): SessionDetail {
    return {
      ...this.toSessionSummary(session),
      platformSessionConfig: platformSessionConfigSchema.parse(
        sanitizeJson(session.platformSessionConfig)
      ),
      runnerSessionConfig: asPlainObject(session.runnerSessionConfig)
    };
  }

  private toSessionMessageDetail(
    message: SessionMessageRow,
    toolUses: SessionToolUse[],
    metrics: SessionMessageMetric[]
  ): SessionMessageDetail {
    return {
      id: message.id,
      sessionId: message.sessionId,
      role: message.role as SessionMessageDetail['role'],
      status: message.status as MessageStatus,
      inputContent: message.inputContent
        ? asPlainObject(message.inputContent)
        : null,
      outputText: message.outputText,
      thinkingText: message.thinkingText,
      errorPayload: message.errorPayload
        ? errorPayloadSchema.parse(sanitizeJson(message.errorPayload))
        : null,
      cancelledAt: message.cancelledAt?.toISOString() ?? null,
      eventId: message.eventId,
      toolUses,
      metrics,
      createdAt: message.createdAt.toISOString()
    };
  }

  private toSessionMessageMetric(metric: SessionMetricRow): SessionMessageMetric {
    return {
      id: metric.id,
      sessionId: metric.sessionId,
      messageId: metric.messageId,
      eventId: metric.eventId,
      kind: metric.kind as MetricKind,
      data: sanitizeJson(metric.data) as UsageData,
      createdAt: metric.createdAt.toISOString()
    };
  }

  private getRunnerTypeOrThrow(type: string): RunnerType {
    const runnerType = this.runnerTypeRegistry.get(type);
    if (!runnerType) {
      throw new BadRequestException(`Runner type '${type}' is not registered`);
    }

    return runnerType;
  }

  private async getRunnerOrThrow(id: string): Promise<AgentRunner> {
    const runner = await this.prisma.agentRunner.findUnique({
      where: { id }
    });
    if (!runner) {
      throw new NotFoundException(`AgentRunner not found: ${id}`);
    }

    return runner;
  }

  private async assertProjectExists(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id }
    });
    if (!project) {
      throw new NotFoundException(`Project not found: ${id}`);
    }

    return project;
  }

  private async getSessionOrThrow(id: string) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id }
    });
    if (!session) {
      throw new NotFoundException(`Session not found: ${id}`);
    }

    return session;
  }

  private assertSendableStatus(status: string) {
    const sessionStatus = status as SessionStatus;

    if (sessionStatus === SessionStatus.Ready) {
      return;
    }

    if (sessionStatus === SessionStatus.Disposing) {
      throw this.buildConflict('Session is disposing', 'DISPOSING');
    }

    if (sessionStatus === SessionStatus.Error) {
      throw this.buildConflict('Session is in error state', 'ERROR');
    }

    throw this.buildConflict('Session is busy', 'RUNNING');
  }

  private buildConflict(message: string, reason: 'RUNNING' | 'DISPOSING' | 'ERROR') {
    return new ConflictException({
      message,
      data: { reason }
    });
  }

  private async assertResourceIdsExist(
    type: 'skill' | 'rule' | 'mcp',
    ids: string[]
  ) {
    if (ids.length === 0) {
      return;
    }

    const uniqueIds = Array.from(new Set(ids));
    const existing =
      type === 'skill'
        ? await this.prisma.skill.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true }
          })
        : type === 'rule'
          ? await this.prisma.rule.findMany({
              where: { id: { in: uniqueIds } },
              select: { id: true }
            })
          : await this.prisma.mCP.findMany({
              where: { id: { in: uniqueIds } },
              select: { id: true }
            });
    const existingIds = new Set(existing.map((item) => item.id));
    const missingIds = uniqueIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      throw new NotFoundException(
        `Referenced ${type} resources not found: ${missingIds.join(', ')}`
      );
    }
  }
}

function toMessageEvent(chunk: OutputChunk): MessageEvent {
  return {
    type: chunk.kind,
    data: chunk
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
