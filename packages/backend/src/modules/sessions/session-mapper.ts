import { Injectable } from '@nestjs/common';
import {
  MessageRole,
  MessageStatus,
  MetricKind,
  SessionStatus,
  errorPayloadSchema,
  platformSessionConfigSchema,
  sessionMessageContentPartsSchema,
  sessionMessageRuntimeConfigSchema,
  type SessionDetail,
  type SessionMessageDetail,
  type SessionMessageMetric,
  type SessionSummary,
  type SessionToolUse
} from '@agent-workbench/shared';

import { asPlainObject, castEnum, sanitizeJson } from '../../common/json.utils';
import type {
  SessionMessageRow,
  SessionMetricRow,
  SessionRow
} from './session.types';

@Injectable()
export class SessionMapper {
  toSessionSummary(session: SessionRow): SessionSummary {
    return {
      id: session.id,
      scopeId: session.scopeId,
      runnerId: session.runnerId,
      runnerType: session.runnerType,
      status: castEnum(
        SessionStatus,
        session.status,
        'SessionStatus'
      ) as SessionSummary['status'],
      lastEventId: session.lastEventId,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }

  toSessionDetail(session: SessionRow): SessionDetail {
    return {
      ...this.toSessionSummary(session),
      platformSessionConfig: platformSessionConfigSchema.parse(
        sanitizeJson(session.platformSessionConfig)
      ),
      runnerSessionConfig: asPlainObject(session.runnerSessionConfig),
      defaultRuntimeConfig: session.defaultRuntimeConfig
        ? asPlainObject(session.defaultRuntimeConfig)
        : null
    };
  }

  toSessionMessageDetail(
    message: SessionMessageRow,
    toolUses: SessionToolUse[],
    metrics: SessionMessageMetric[]
  ): SessionMessageDetail {
    return {
      id: message.id,
      sessionId: message.sessionId,
      role: castEnum(
        MessageRole,
        message.role,
        'MessageRole'
      ) as SessionMessageDetail['role'],
      status: castEnum(MessageStatus, message.status, 'MessageStatus'),
      inputContent: message.inputContent
        ? asPlainObject(message.inputContent)
        : null,
      runtimeConfig: message.runtimeConfig
        ? sessionMessageRuntimeConfigSchema.parse(
            sanitizeJson(message.runtimeConfig)
          )
        : null,
      outputText: message.outputText,
      thinkingText: message.thinkingText,
      contentParts: sessionMessageContentPartsSchema.parse(
        sanitizeJson(message.contentParts ?? [])
      ),
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

  toSessionMessageMetric(metric: SessionMetricRow): SessionMessageMetric {
    return {
      id: metric.id,
      sessionId: metric.sessionId,
      messageId: metric.messageId,
      eventId: metric.eventId,
      kind: castEnum(MetricKind, metric.kind, 'MetricKind'),
      data: sanitizeJson(metric.data) as SessionMessageMetric['data'],
      createdAt: metric.createdAt.toISOString()
    };
  }
}
