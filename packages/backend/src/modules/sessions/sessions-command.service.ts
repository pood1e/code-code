import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import {
  SessionStatus,
  createSessionInputSchema,
  platformSessionConfigSchema
} from '@agent-workbench/shared';
import type { Prisma } from '@prisma/client';

import {
  asPlainObject,
  toInputJson
} from '../../common/json.utils';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateSessionDto,
  EditSessionMessageDto,
  SendSessionMessageDto
} from './dto/session.dto';
import { SessionRuntimeService } from './session-runtime.service';
import { SessionsQueryService } from './sessions-query.service';

@Injectable()
export class SessionsCommandService {
  private readonly sendLocks = new Map<string, boolean>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsQueryService: SessionsQueryService,
    private readonly sessionRuntimeService: SessionRuntimeService
  ) {}

  async create(dto: CreateSessionDto) {
    const parsed = parseSchemaOrThrow(
      createSessionInputSchema,
      dto,
      'Invalid session payload'
    );

    const project = await this.sessionsQueryService.assertProjectExists(parsed.scopeId);
    const runner = await this.sessionsQueryService.getRunnerOrThrow(parsed.runnerId);
    const runnerType = this.sessionRuntimeService.getRunnerTypeOrThrow(runner.type);
    const runnerSessionConfig = parseSchemaOrThrow(
      runnerType.runnerSessionConfigSchema,
      parsed.runnerSessionConfig,
      'Invalid runnerSessionConfig'
    ) as Record<string, unknown>;
    const initialInput = parsed.initialMessage?.input
      ? this.sessionRuntimeService.parseRunnerInputOrThrow(
          runnerType,
          parsed.initialMessage.input,
          'Invalid initialInput'
        )
      : undefined;
    const initialRuntimeConfig = parsed.initialMessage?.runtimeConfig;

    await this.sessionsQueryService.assertResourceIdsExist('skill', parsed.skillIds);
    await this.sessionsQueryService.assertResourceIdsExist('rule', parsed.ruleIds);
    await this.sessionsQueryService.assertResourceIdsExist(
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
        activeAssistantMessageId: null,
        platformSessionConfig: toInputJson(platformSessionConfig),
        runnerSessionConfig: toInputJson(
          runnerSessionConfig as Prisma.InputJsonValue
        ),
        defaultRuntimeConfig: initialRuntimeConfig ? toInputJson(initialRuntimeConfig as Prisma.InputJsonValue) : undefined,
        runnerState: toInputJson({} as Prisma.InputJsonValue)
      }
    });

    try {
      await this.sessionRuntimeService.ensureRuntime(created.id);
      await this.prisma.agentSession.update({
        where: { id: created.id },
        data: { status: SessionStatus.Ready }
      });

      if (initialInput) {
        await this.withSessionSendLock(created.id, async () => {
          await this.sessionRuntimeService.sendParsedInput(created.id, initialInput, initialRuntimeConfig, {
            throwOnSyncSendFailure: true
          });
        });
      }
    } catch (error) {
      if (initialInput) {
        await this.cleanupFailedSessionCreation(created.id);
      } else {
        await this.markSessionAsErrored(created.id);
      }
      throw error;
    }

    return this.sessionsQueryService.getById(created.id);
  }

  async sendMessage(sessionId: string, dto: SendSessionMessageDto) {
    return this.withSessionSendLock(sessionId, async () => {
      const session = await this.sessionsQueryService.getSessionOrThrow(sessionId);
      this.assertSendableStatus(session.status);

      const parsedInput = await this.sessionRuntimeService.parseMessageInput(
        sessionId,
        dto.input
      );
      await this.sessionRuntimeService.sendParsedInput(sessionId, parsedInput, dto.runtimeConfig);
      return this.sessionsQueryService.listMessages(sessionId);
    });
  }

  async cancel(sessionId: string) {
    const session = await this.sessionsQueryService.getSessionOrThrow(sessionId);
    const sessionStatus = session.status as SessionStatus;

    if (sessionStatus !== SessionStatus.Running) {
      return this.sessionsQueryService.getById(sessionId);
    }

    const streamingMessage =
      await this.sessionsQueryService.getLatestStreamingAssistantMessage(sessionId);
    if (!streamingMessage) {
      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.Ready,
          activeAssistantMessageId: null
        }
      });
      await this.sessionRuntimeService.emitSessionStatus(
        sessionId,
        SessionStatus.Ready,
        SessionStatus.Running
      );
      return this.sessionsQueryService.getById(sessionId);
    }

    await this.sessionRuntimeService.cancelRuntimeOutput(sessionId);

    const runtimeSession = await this.sessionRuntimeService.ensureRuntime(sessionId);
    await this.sessionRuntimeService.handleRecoverableMessageError(
      runtimeSession,
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

    return this.sessionsQueryService.getById(sessionId);
  }

  async reload(sessionId: string) {
    return this.withSessionSendLock(sessionId, async () => {
      const session = await this.sessionsQueryService.getSessionOrThrow(sessionId);
      this.assertSendableStatus(session.status);

      const messages = await this.sessionsQueryService.getSessionMessages(sessionId);
      const lastUserIndex = [...messages]
        .map((message) => message.role)
        .lastIndexOf('user');
      const lastUserMessage =
        lastUserIndex >= 0 ? messages[lastUserIndex] : undefined;

      if (!lastUserMessage?.inputContent) {
        throw new BadRequestException('No previous user message to reload');
      }

      const firstAssistantAfterUser = messages
        .slice(lastUserIndex + 1)
        .find((message) => message.role === 'assistant');

      if (!firstAssistantAfterUser) {
        throw new BadRequestException('No previous assistant message to reload');
      }

      await this.truncateSessionHistoryFrom(sessionId, firstAssistantAfterUser.id);
      await this.sessionRuntimeService.sendParsedInput(
        sessionId,
        asPlainObject(lastUserMessage.inputContent),
        {},
        {
          reuseLastUserMessage: true
        }
      );

      return this.sessionsQueryService.getById(sessionId);
    });
  }

  async editMessage(
    sessionId: string,
    messageId: string,
    dto: EditSessionMessageDto
  ) {
    return this.withSessionSendLock(sessionId, async () => {
      const session = await this.sessionsQueryService.getSessionOrThrow(sessionId);
      this.assertSendableStatus(session.status);

      const targetMessage = await this.prisma.sessionMessage.findFirst({
        where: {
          id: messageId,
          sessionId
        }
      });

      if (!targetMessage) {
        throw new BadRequestException(`Session message not found: ${messageId}`);
      }

      if (targetMessage.role !== 'user') {
        throw new BadRequestException('Only user messages can be edited');
      }

      const parsedInput = await this.sessionRuntimeService.parseMessageInput(
        sessionId,
        dto.input
      );
      await this.truncateSessionHistoryFrom(sessionId, messageId);
      await this.sessionRuntimeService.sendParsedInput(sessionId, parsedInput, dto.runtimeConfig);

      return this.sessionsQueryService.getById(sessionId);
    });
  }

  async dispose(sessionId: string) {
    const session = await this.sessionsQueryService.getSessionOrThrow(sessionId);
    const sessionStatus = session.status as SessionStatus;

    if (sessionStatus === SessionStatus.Disposed) {
      return this.sessionsQueryService.getById(sessionId);
    }

    if (sessionStatus !== SessionStatus.Disposing) {
      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.Disposing }
      });
      await this.sessionRuntimeService.emitSessionStatus(
        sessionId,
        SessionStatus.Disposing,
        sessionStatus
      );
    }

    if (sessionStatus === SessionStatus.Running) {
      const streamingMessage =
        await this.sessionsQueryService.getLatestStreamingAssistantMessage(sessionId);

      if (streamingMessage) {
        const runtimeSession = await this.sessionRuntimeService.ensureRuntime(sessionId);
        await this.sessionRuntimeService.handleNonRecoverableMessageError(
          runtimeSession,
          streamingMessage.id,
          {
            message: '会话被强制销毁',
            code: 'SESSION_FORCE_DESTROYED',
            recoverable: false
          },
          false
        );
      }

      await Promise.race([
        this.sessionRuntimeService.cancelRuntimeOutput(sessionId),
        sleep(5_000)
      ]);
    }

    await this.sessionRuntimeService.destroyRuntime(sessionId);

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.Disposed,
        activeAssistantMessageId: null,
        runnerState: toInputJson({} as Prisma.InputJsonValue)
      }
    });

    await this.sessionRuntimeService.emitSessionStatus(
      sessionId,
      SessionStatus.Disposed,
      SessionStatus.Disposing
    );
    this.sessionRuntimeService.completeEvents(sessionId);

    return this.sessionsQueryService.getById(sessionId);
  }

  private async withSessionSendLock<T>(
    sessionId: string,
    callback: () => Promise<T>
  ) {
    if (this.sendLocks.get(sessionId)) {
      throw this.buildConflict('Session is busy', 'RUNNING');
    }

    this.sendLocks.set(sessionId, true);

    try {
      return await callback();
    } finally {
      this.sendLocks.delete(sessionId);
    }
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

  private buildConflict(
    message: string,
    reason: 'RUNNING' | 'DISPOSING' | 'ERROR'
  ) {
    return new ConflictException({
      message,
      data: { reason }
    });
  }

  private async truncateSessionHistoryFrom(sessionId: string, fromMessageId: string) {
    const messages = await this.sessionsQueryService.getSessionMessages(sessionId);
    const startIndex = messages.findIndex((message) => message.id === fromMessageId);

    if (startIndex === -1) {
      throw new BadRequestException(`Session message not found: ${fromMessageId}`);
    }

    const messageIds = messages.slice(startIndex).map((message) => message.id);
    if (messageIds.length === 0) {
      return;
    }

    this.sessionRuntimeService.clearTransientState(sessionId, messageIds);

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
      }),
      this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          activeAssistantMessageId: null
        }
      })
    ]);
  }

  private async markSessionAsErrored(sessionId: string) {
    const session = await this.sessionsQueryService.getSessionOrNull(sessionId);
    if (!session) {
      return;
    }

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.Error,
        activeAssistantMessageId: null
      }
    });
  }

  private async cleanupFailedSessionCreation(sessionId: string) {
    await this.sessionRuntimeService.destroyRuntime(sessionId);
    this.sessionRuntimeService.completeEvents(sessionId);

    const session = await this.sessionsQueryService.getSessionOrNull(sessionId);
    if (!session) {
      return;
    }

    await this.prisma.agentSession.delete({
      where: { id: sessionId }
    });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
