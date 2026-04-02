import type {
  MetricKind,
  SessionMessageDetail,
  SessionStatus,
  UsageChunk
} from '@agent-workbench/shared';
import {
  MetricKind as MetricKindEnum,
  SessionStatus as SessionStatusEnum
} from '@agent-workbench/shared';

export type SessionUsageData = UsageChunk['data'];

export type SessionMessageRuntimeState = {
  thinkingText?: string;
  usage?: SessionUsageData;
  cancelledAt?: string;
};

export type SessionMessageRuntimeMap = Record<
  string,
  SessionMessageRuntimeState | undefined
>;

export type SessionAssistantMessageRecord = {
  message: SessionMessageDetail;
  runtime: SessionMessageRuntimeState | undefined;
};

export function buildSessionAssistantMessageRecords(
  messages: SessionMessageDetail[],
  runtimeState: SessionMessageRuntimeMap
): SessionAssistantMessageRecord[] {
  return messages.map((message) => ({
    message,
    runtime: {
      thinkingText: runtimeState[message.id]?.thinkingText ?? message.thinkingText ?? undefined,
      usage:
        runtimeState[message.id]?.usage ??
        message.metrics.find(
          (metric) => metric.kind === (MetricKindEnum.TokenUsage as MetricKind)
        )?.data,
      cancelledAt:
        runtimeState[message.id]?.cancelledAt ?? message.cancelledAt ?? undefined
    }
  }));
}

export function getSessionLastEventId(
  messages: SessionMessageDetail[],
  seed = 0
) {
  return messages.reduce((maxValue, message) => {
    const toolEventId = message.toolUses.reduce(
      (toolMaxValue, toolUse) => Math.max(toolMaxValue, toolUse.eventId),
      0
    );
    const metricEventId = message.metrics.reduce(
      (metricMaxValue, metric) => Math.max(metricMaxValue, metric.eventId),
      0
    );

    return Math.max(maxValue, message.eventId ?? 0, toolEventId, metricEventId);
  }, seed);
}

export function isSessionRunning(status: SessionStatus) {
  return status === SessionStatusEnum.Running;
}

export function isSessionInteractionDisabled(status: SessionStatus) {
  return (
    status === SessionStatusEnum.Creating ||
    status === SessionStatusEnum.Disposing ||
    status === SessionStatusEnum.Disposed ||
    status === SessionStatusEnum.Error
  );
}
