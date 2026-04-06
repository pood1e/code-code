import { Injectable } from '@nestjs/common';

import {
  MessageRole,
  MessageStatus,
  SessionWorkspaceResourceKind,
  type PipelineAgentConfig
} from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { SessionsCommandService } from '../sessions/sessions-command.service';
import type { PipelineRecord } from './pipeline.repository';

const DEFAULT_SESSION_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 200;

export type PipelineSessionResult =
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

export type PipelineSessionMessageSnapshot = {
  id: string;
  status: MessageStatus;
  outputText: string | null;
  errorPayload: Record<string, unknown> | null;
  createdAt: Date;
};

@Injectable()
export class PipelineSessionBridgeService {
  constructor(
    private readonly sessionsCommandService: SessionsCommandService,
    private readonly prisma: PrismaService
  ) {}

  async createSessionAndSendPrompt(input: {
    pipeline: PipelineRecord;
    agentConfig: PipelineAgentConfig;
    prompt: string;
  }): Promise<{ sessionId: string; messageId: string | null }> {
    if (!input.pipeline.runnerId) {
      throw new Error(`Pipeline ${input.pipeline.id} is missing runnerId`);
    }

    const session = await this.sessionsCommandService.create({
      scopeId: input.pipeline.scopeId,
      runnerId: input.pipeline.runnerId,
      workspaceResources: input.agentConfig.workspaceResources.map((resource) =>
        resource === 'doc'
          ? SessionWorkspaceResourceKind.Doc
          : SessionWorkspaceResourceKind.Code
      ),
      workspaceResourceConfig: {},
      skillIds: input.agentConfig.skillIds,
      ruleIds: input.agentConfig.ruleIds,
      mcps: input.agentConfig.mcps.map((mcp) => ({
        resourceId: mcp.resourceId,
        configOverride: mcp.configOverride
      })),
      runnerSessionConfig: input.agentConfig.runnerSessionConfig,
      initialMessage: {
        input: { prompt: input.prompt },
        runtimeConfig: input.agentConfig.runtimeConfig
      }
    });

    const message = await this.getLatestAssistantMessage(session.id);
    return {
      sessionId: session.id,
      messageId: message?.id ?? null
    };
  }

  async sendFollowUpPrompt(input: {
    sessionId: string;
    prompt: string;
    agentConfig: PipelineAgentConfig;
  }): Promise<string | null> {
    await this.sessionsCommandService.sendMessage(input.sessionId, {
      input: { prompt: input.prompt },
      runtimeConfig: input.agentConfig.runtimeConfig
    });

    const message = await this.getLatestAssistantMessage(input.sessionId);
    return message?.id ?? null;
  }

  async waitForResult(
    sessionId: string,
    messageId: string | null,
    timeoutMs = DEFAULT_SESSION_TIMEOUT_MS
  ): Promise<PipelineSessionResult> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const message = messageId
        ? await this.prisma.sessionMessage.findUnique({
            where: { id: messageId }
          })
        : await this.getLatestAssistantMessage(sessionId);

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

      await sleep(POLL_INTERVAL_MS);
    }

    await this.sessionsCommandService.cancel(sessionId);
    return {
      status: 'timeout',
      sessionId,
      messageId
    };
  }

  async getAssistantMessageSnapshot(
    sessionId: string,
    messageId: string
  ): Promise<PipelineSessionMessageSnapshot | null> {
    const message = await this.prisma.sessionMessage.findFirst({
      where: {
        id: messageId,
        sessionId,
        role: MessageRole.Assistant
      }
    });

    return message ? toMessageSnapshot(message) : null;
  }

  async getLatestAssistantMessageSnapshot(
    sessionId: string
  ): Promise<PipelineSessionMessageSnapshot | null> {
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

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toMessageSnapshot(
  message: NonNullable<
    Awaited<ReturnType<PipelineSessionBridgeService['getLatestAssistantMessage']>>
  >
): PipelineSessionMessageSnapshot {
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
