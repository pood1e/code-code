import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  MessageRole,
  MessageStatus,
  MetricKind,
  SessionStatus,
  errorPayloadSchema,
  platformSessionConfigSchema,
  type ErrorPayload,
  type McpConfigOverride,
  type McpStdioContent,
  type OutputChunk,
  type PlatformSessionConfig
} from '@agent-workbench/shared';
import type { Prisma } from '@prisma/client';

import {
  asPlainObject,
  castEnum,
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
import {
  materializeContext,
  type MaterializerTarget
} from '../agent-runners/cli/context-materializer';
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
  private readonly outputAccumulators = new Map<string, string>();

  /** In-memory cache for shouldAcceptChunk — avoids per-chunk DB query. */
  private readonly activeSessionState = new Map<
    string,
    { status: string; activeAssistantMessageId: string | null }
  >();

  /** Runner config cache — runner config is immutable during session lifetime. */
  private readonly runnerCache = new Map<
    string,
    Awaited<ReturnType<SessionsQueryService['getRunnerOrThrow']>>
  >();

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
    const session =
      await this.sessionsQueryService.getSessionOrThrow(sessionId);
    const runnerState = asPlainObject(session.runnerState);
    if (Object.keys(runnerState).length === 0) {
      return null;
    }

    return this.buildRunnerSessionRecord(session);
  }

  async sendParsedInput(
    sessionId: string,
    parsedInput: Record<string, unknown>,
    runtimeConfig: Record<string, unknown> = {},
    options?: {
      reuseLastUserMessage?: boolean;
      throwOnSyncSendFailure?: boolean;
    }
  ) {
    const runtimeSession = await this.ensureRuntime(sessionId);
    const rawStatus = (
      await this.sessionsQueryService.getSessionOrThrow(sessionId)
    ).status;
    const previousStatus = castEnum(SessionStatus, rawStatus, 'SessionStatus');

    const runnerType = this.getRunnerTypeOrThrow(runtimeSession.runnerType);
    let parsedRuntimeConfig = runtimeConfig;
    if (runnerType.runtimeConfigSchema) {
      const parseResult =
        runnerType.runtimeConfigSchema.safeParse(runtimeConfig);
      if (parseResult.success) {
        parsedRuntimeConfig = parseResult.data as Record<string, unknown>;
      } else {
        throw new Error(`Invalid runtime config: ${parseResult.error.message}`);
      }
    }

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

    this.trackActiveSessionState(
      sessionId,
      SessionStatus.Running,
      assistantMessageId
    );
    this.clearThinkingAccumulator(sessionId, assistantMessageId);
    await this.emitSessionStatus(
      sessionId,
      SessionStatus.Running,
      previousStatus
    );

    try {
      await runnerType.send(runtimeSession, {
        messageId: assistantMessageId,
        input: parsedInput,
        runtimeConfig: parsedRuntimeConfig
      });
    } catch (error) {
      if (options?.throwOnSyncSendFailure) {
        throw error;
      }

      await this.handleRecoverableMessageError(
        runtimeSession,
        assistantMessageId,
        {
          message:
            error instanceof Error ? error.message : 'Runner failed to send',
          code: 'RUNNER_SEND_FAILED',
          recoverable: true
        }
      );
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
    runtimeSession: RunnerSessionRecord,
    messageId: string,
    payload: ErrorPayload,
    options?: {
      cancelledAt?: Date;
    }
  ) {
    const sessionId = runtimeSession.id;
    const eventId = await this.sessionEventStore.nextEventId(sessionId);
    const thinkingText = this.consumeThinkingAccumulator(sessionId, messageId);
    const outputText = this.readStoredOutputText(sessionId, messageId);
    const freshSession =
      await this.sessionsQueryService.getSessionOrThrow(sessionId);
    const freshRunnerState = asPlainObject(freshSession.runnerState);

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
          activeAssistantMessageId: null,
          runnerState: toInputJson(freshRunnerState as Prisma.InputJsonValue)
        }
      })
    ]);
    this.trackActiveSessionState(sessionId, SessionStatus.Ready, null);
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
    runtimeSession: RunnerSessionRecord,
    messageId: string,
    payload: ErrorPayload,
    emitErrorState = true
  ) {
    const sessionId = runtimeSession.id;
    const eventId = await this.sessionEventStore.nextEventId(sessionId);
    const thinkingText = this.consumeThinkingAccumulator(sessionId, messageId);
    const outputText = this.readStoredOutputText(sessionId, messageId);
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
      const freshSession =
        await this.sessionsQueryService.getSessionOrThrow(sessionId);
      const freshRunnerState = asPlainObject(freshSession.runnerState);

      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          activeAssistantMessageId: null,
          runnerState: toInputJson(freshRunnerState as Prisma.InputJsonValue)
        }
      });
      this.trackActiveSessionState(sessionId, SessionStatus.Running, null);
      return;
    }

    const freshSession =
      await this.sessionsQueryService.getSessionOrThrow(sessionId);
    const freshRunnerState = asPlainObject(freshSession.runnerState);

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.Error,
        activeAssistantMessageId: null,
        runnerState: toInputJson(freshRunnerState as Prisma.InputJsonValue)
      }
    });
    this.trackActiveSessionState(sessionId, SessionStatus.Error, null);
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
      messageIds?.map((messageId) =>
        this.getThinkingAccumulatorKey(sessionId, messageId)
      ) ??
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
    const session =
      await this.sessionsQueryService.getSessionOrThrow(sessionId);
    if (
      castEnum(SessionStatus, session.status, 'SessionStatus') ===
      SessionStatus.Disposed
    ) {
      throw new BadRequestException('Disposed session cannot be reinitialized');
    }

    const runtimeSession = await this.buildRunnerSessionRecord(session);
    const runnerType = this.getRunnerTypeOrThrow(runtimeSession.runnerType);
    const runnerState = await runnerType.createSession(
      session.id,
      runtimeSession.runnerConfig,
      runtimeSession.platformSessionConfig,
      runtimeSession.runnerSessionConfig
    );

    // For CLI-backed runners, materialize MCP/Rule/Skill into the file system
    if (runnerType.materializerTarget) {
      await this.materializeCliContext(
        runnerType.materializerTarget,
        sessionId,
        runtimeSession.platformSessionConfig,
        runnerState
      );
    }

    const updatedSession = await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        runnerState: toInputJson(runnerState as Prisma.InputJsonValue)
      }
    });
    const updatedRuntimeSession =
      await this.buildRunnerSessionRecord(updatedSession);

    const outputConsumer = this.consumeRunnerOutput(
      updatedRuntimeSession
    ).finally(() => {
      this.outputConsumers.delete(sessionId);
    });
    this.outputConsumers.set(sessionId, outputConsumer);

    return updatedRuntimeSession;
  }

  /**
   * Resolve resource IDs from PlatformSessionConfig to actual content
   * and write them into the file system as CLI-recognizable files.
   * Mutates `runnerState` in place to set contextDir and mcpConfigPath.
   */
  private async materializeCliContext(
    target: MaterializerTarget,
    sessionId: string,
    platformConfig: PlatformSessionConfig,
    runnerState: Record<string, unknown>
  ): Promise<void> {
    const skills = await this.resolveSkills(platformConfig.skillIds);
    const rules = await this.resolveRules(platformConfig.ruleIds);
    const mcps = await this.resolveMcps(platformConfig.mcps);

    const result = await materializeContext({
      target,
      sessionId,
      cwd: platformConfig.cwd,
      platformConfig,
      skills,
      rules,
      mcps
    });

    runnerState.contextDir = result.contextDir;
    runnerState.mcpConfigPath = result.mcpConfigPath;
  }

  private async resolveSkills(
    skillIds: string[]
  ): Promise<Array<{ name: string; content: string }>> {
    if (skillIds.length === 0) return [];

    const records = await this.prisma.skill.findMany({
      where: { id: { in: skillIds } },
      select: { id: true, name: true, content: true }
    });
    const foundIds = new Set(records.map((r) => r.id));
    const missingIds = skillIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      this.logger.warn(
        `Skills not found during materialization: ${missingIds.join(', ')}`
      );
    }
    return records;
  }

  private async resolveRules(
    ruleIds: string[]
  ): Promise<Array<{ name: string; content: string }>> {
    if (ruleIds.length === 0) return [];

    const records = await this.prisma.rule.findMany({
      where: { id: { in: ruleIds } },
      select: { id: true, name: true, content: true }
    });
    const foundIds = new Set(records.map((r) => r.id));
    const missingIds = ruleIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      this.logger.warn(
        `Rules not found during materialization: ${missingIds.join(', ')}`
      );
    }
    return records;
  }

  private async resolveMcps(
    mcps: PlatformSessionConfig['mcps']
  ): Promise<
    Array<{
      name: string;
      content: McpStdioContent;
      configOverride?: McpConfigOverride;
    }>
  > {
    if (mcps.length === 0) return [];

    const mcpIds = mcps.map((m) => m.resourceId);
    const records = await this.prisma.mCP.findMany({
      where: { id: { in: mcpIds } },
      select: { id: true, name: true, content: true }
    });

    const recordMap = new Map(records.map((r) => [r.id, r]));
    const missingMcpIds = mcpIds.filter((id) => !recordMap.has(id));
    if (missingMcpIds.length > 0) {
      this.logger.warn(
        `MCPs not found during materialization: ${missingMcpIds.join(', ')}`
      );
    }
    return mcps
      .map((m) => {
        const record = recordMap.get(m.resourceId);
        if (!record) return null;
        return {
          name: record.name,
          content: record.content as unknown as McpStdioContent,
          configOverride: m.configOverride
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  private async buildRunnerSessionRecord(
    session: SessionRow
  ): Promise<RunnerSessionRecord> {
    let runner = this.runnerCache.get(session.runnerId);
    if (!runner) {
      runner = await this.sessionsQueryService.getRunnerOrThrow(
        session.runnerId
      );
      this.runnerCache.set(session.runnerId, runner);
    }

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
        await this.handleRunnerChunk(runtimeSession, chunk);
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
    const session = await this.sessionsQueryService.getSessionOrNull(
      runtimeSession.id
    );
    if (
      !session ||
      castEnum(SessionStatus, session.status, 'SessionStatus') !==
        SessionStatus.Running
    ) {
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

    await this.handleNonRecoverableMessageError(
      runtimeSession,
      streamingMessage.id,
      {
        message:
          outputError instanceof Error
            ? outputError.message
            : 'Runner output stopped unexpectedly',
        code:
          outputError === undefined
            ? 'RUNNER_OUTPUT_CLOSED'
            : 'RUNNER_OUTPUT_CRASHED',
        recoverable: false
      }
    );
  }

  private async handleRunnerChunk(
    runtimeSession: RunnerSessionRecord,
    chunk: RawOutputChunk
  ) {
    const sessionId = runtimeSession.id;
    if (!this.shouldAcceptChunk(sessionId, chunk.messageId)) {
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
        this.pushOutputAccumulator(sessionId, chunk.messageId, chunk.data);
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
        await this.handleMessageResult(runtimeSession, chunk);
        return;
      }

      case 'error': {
        const payload = errorPayloadSchema.parse(chunk.data);
        if (payload.recoverable) {
          await this.handleRecoverableMessageError(
            runtimeSession,
            chunk.messageId,
            payload
          );
          return;
        }

        await this.handleNonRecoverableMessageError(
          runtimeSession,
          chunk.messageId,
          payload
        );
        return;
      }

      case 'state_update': {
        const session = await this.prisma.agentSession.findUnique({
          where: { id: sessionId },
          select: { runnerState: true }
        });
        if (!session) return;

        const currentRunnerState = asPlainObject(session.runnerState);
        const updatedRunnerState = { ...currentRunnerState, ...chunk.data };

        await this.prisma.agentSession.update({
          where: { id: sessionId },
          data: {
            runnerState: toInputJson(
              updatedRunnerState as Prisma.InputJsonValue
            )
          }
        });

        // Also update the in-memory runtimeSession to avoid it becoming stale
        runtimeSession.runnerState = updatedRunnerState;
        return;
      }
    }
  }

  private async handleMessageResult(
    runtimeSession: RunnerSessionRecord,
    chunk: Extract<RawOutputChunk, { kind: 'message_result' }>
  ) {
    const sessionId = runtimeSession.id;
    if (!this.shouldAcceptChunk(sessionId, chunk.messageId)) {
      return;
    }

    const eventId = await this.sessionEventStore.nextEventId(sessionId);
    const thinkingText = this.consumeThinkingAccumulator(
      sessionId,
      chunk.messageId
    );
    const freshSession =
      await this.sessionsQueryService.getSessionOrThrow(sessionId);
    const freshRunnerState = asPlainObject(freshSession.runnerState);

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
          activeAssistantMessageId: null,
          runnerState: toInputJson(freshRunnerState as Prisma.InputJsonValue)
        }
      })
    ]);
    this.trackActiveSessionState(sessionId, SessionStatus.Ready, null);

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

  private readStoredOutputText(sessionId: string, messageId: string) {
    return this.consumeOutputAccumulator(sessionId, messageId);
  }

  private shouldAcceptChunk(sessionId: string, messageId: string) {
    const state = this.activeSessionState.get(sessionId);
    return (
      state?.status === SessionStatus.Running &&
      state?.activeAssistantMessageId === messageId
    );
  }

  private trackActiveSessionState(
    sessionId: string,
    status: string,
    activeAssistantMessageId: string | null
  ) {
    this.activeSessionState.set(sessionId, {
      status,
      activeAssistantMessageId
    });
  }

  private clearActiveSessionState(sessionId: string) {
    this.activeSessionState.delete(sessionId);
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

  private getOutputAccumulatorKey(sessionId: string, messageId: string) {
    return `out:${sessionId}:${messageId}`;
  }

  private pushOutputAccumulator(
    sessionId: string,
    messageId: string,
    data: Extract<OutputChunk, { kind: 'message_delta' }>['data']
  ) {
    const key = this.getOutputAccumulatorKey(sessionId, messageId);
    const nextValue =
      data.accumulatedText ??
      `${this.outputAccumulators.get(key) ?? ''}${data.deltaText}`;
    this.outputAccumulators.set(key, nextValue);
  }

  private consumeOutputAccumulator(sessionId: string, messageId: string) {
    const key = this.getOutputAccumulatorKey(sessionId, messageId);
    const value = this.outputAccumulators.get(key) ?? null;
    this.outputAccumulators.delete(key);
    return value;
  }
}
