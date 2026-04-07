import { Injectable } from '@nestjs/common';

import {
  MessageRole,
  MessageStatus,
  SessionStatus
} from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { SessionsCommandService } from '../sessions/sessions-command.service';

const DEFAULT_SESSION_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 200;

export type GovernanceSessionResult =
  | {
      status: 'completed';
      sessionId: string;
      messageId: string;
      outputText: string;
    }
  | {
      status: 'error';
      sessionId: string;
      messageId: string | null;
      code: string;
      message: string;
      outputText: string | null;
    }
  | {
      status: 'timeout';
      sessionId: string;
      messageId: string | null;
    };

export type GovernanceSessionMessageSnapshot = {
  id: string;
  status: MessageStatus;
  outputText: string | null;
  errorPayload: Record<string, unknown> | null;
  createdAt: Date;
};

@Injectable()
export class GovernanceRunnerBridgeService {
  constructor(
    private readonly sessionsCommandService: SessionsCommandService,
    private readonly prisma: PrismaService
  ) {}

  async createSessionAndSendPrompt(input: {
    scopeId: string;
    runnerId: string;
    prompt: string;
  }) {
    const session = await this.sessionsCommandService.create({
      scopeId: input.scopeId,
      runnerId: input.runnerId,
      workspaceResources: [],
      workspaceResourceConfig: {},
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {},
      initialMessage: {
        input: { prompt: input.prompt },
        runtimeConfig: {}
      }
    });

    const message = await this.getLatestAssistantMessage(session.id);
    return {
      sessionId: session.id,
      messageId: message?.id ?? null
    };
  }

  async sendFollowUpPrompt(input: { sessionId: string; prompt: string }) {
    await this.sessionsCommandService.sendMessage(input.sessionId, {
      input: { prompt: input.prompt },
      runtimeConfig: {}
    });

    const message = await this.getLatestAssistantMessage(input.sessionId);
    return message?.id ?? null;
  }

  async waitForResult(
    sessionId: string,
    messageId: string | null,
    timeoutMs = DEFAULT_SESSION_TIMEOUT_MS
  ): Promise<GovernanceSessionResult> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const [session, message] = await Promise.all([
        this.prisma.agentSession.findUnique({
          where: { id: sessionId },
          select: { status: true }
        }),
        messageId
          ? this.prisma.sessionMessage.findUnique({
              where: { id: messageId }
            })
          : this.getLatestAssistantMessage(sessionId)
      ]);

      if (message) {
        if (message.status === MessageStatus.Complete && message.outputText) {
          return {
            status: 'completed',
            sessionId,
            messageId: message.id,
            outputText: message.outputText
          };
        }

        if (message.status === MessageStatus.Error) {
          const errorPayload =
            message.errorPayload && typeof message.errorPayload === 'object'
              ? (message.errorPayload as Record<string, unknown>)
              : null;
          return {
            status: 'error',
            sessionId,
            messageId: message.id,
            code:
              typeof errorPayload?.code === 'string'
                ? errorPayload.code
                : 'SESSION_MESSAGE_ERROR',
            message:
              typeof errorPayload?.message === 'string'
                ? errorPayload.message
                : 'Session message failed',
            outputText: message.outputText
          };
        }
      }

      if (session?.status === SessionStatus.Error) {
        return {
          status: 'error',
          sessionId,
          messageId: message?.id ?? null,
          code: 'SESSION_ERROR',
          message: 'Session entered error state',
          outputText: message?.outputText ?? null
        };
      }

      await sleep(POLL_INTERVAL_MS);
    }

    await this.sessionsCommandService.cancel(sessionId);
    return {
      status: 'timeout',
      sessionId,
      messageId
    };
  }

  async getAssistantMessageSnapshot(sessionId: string, messageId: string) {
    const message = await this.prisma.sessionMessage.findFirst({
      where: {
        id: messageId,
        sessionId,
        role: MessageRole.Assistant
      }
    });

    return message ? toMessageSnapshot(message) : null;
  }

  async getLatestAssistantMessageSnapshot(sessionId: string) {
    const message = await this.getLatestAssistantMessage(sessionId);
    return message ? toMessageSnapshot(message) : null;
  }

  private getLatestAssistantMessage(sessionId: string) {
    return this.prisma.sessionMessage.findFirst({
      where: {
        sessionId,
        role: MessageRole.Assistant
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
  }
}

function toMessageSnapshot(
  message: NonNullable<
    Awaited<
      ReturnType<GovernanceRunnerBridgeService['getLatestAssistantMessage']>
    >
  >
): GovernanceSessionMessageSnapshot {
  return {
    id: message.id,
    status: message.status as MessageStatus,
    outputText: message.outputText,
    errorPayload:
      message.errorPayload && typeof message.errorPayload === 'object'
        ? (message.errorPayload as Record<string, unknown>)
        : null,
    createdAt: message.createdAt
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
