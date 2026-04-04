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
  runtimeState: SessionMessageRuntimeMap,
  previousRecords?: SessionAssistantMessageRecord[]
): SessionAssistantMessageRecord[] {
  let hasChanges = false;
  const newRecords: SessionAssistantMessageRecord[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const prevRecord = previousRecords?.[i];
    const state = runtimeState[message.id];

    const thinkingText =
      state?.thinkingText ?? message.thinkingText ?? undefined;
    const usage =
      state?.usage ??
      message.metrics.find(
        (metric) => metric.kind === (MetricKindEnum.TokenUsage as MetricKind)
      )?.data;
    const cancelledAt = state?.cancelledAt ?? message.cancelledAt ?? undefined;

    // 如果与前一个记录的依赖完全一致，复用旧引用
    if (
      prevRecord &&
      prevRecord.message === message &&
      prevRecord.runtime?.thinkingText === thinkingText &&
      prevRecord.runtime?.usage === usage &&
      prevRecord.runtime?.cancelledAt === cancelledAt
    ) {
      newRecords.push(prevRecord);
    } else {
      hasChanges = true;
      newRecords.push({
        message,
        runtime: {
          thinkingText,
          usage,
          cancelledAt
        }
      });
    }
  }

  // 如果数组长度一致且没有任何子级改变，直接复用上一次的整个数组引用
  if (
    !hasChanges &&
    previousRecords &&
    previousRecords.length === messages.length
  ) {
    return previousRecords;
  }

  return newRecords;
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

export function canSessionReload(status: SessionStatus) {
  return !isSessionRunning(status) && !isSessionInteractionDisabled(status);
}

export function isSessionInteractionDisabled(status: SessionStatus) {
  return (
    status === SessionStatusEnum.Creating ||
    status === SessionStatusEnum.Disposing ||
    status === SessionStatusEnum.Disposed ||
    status === SessionStatusEnum.Error
  );
}

export function getSessionInteractionDisabledHint(
  status: SessionStatus,
  messagesReady: boolean
) {
  if (!messagesReady) {
    return '正在加载历史消息...';
  }

  switch (status) {
    case SessionStatusEnum.Creating:
      return '会话正在创建...';
    case SessionStatusEnum.Error:
      return '会话已异常，请新建会话';
    case SessionStatusEnum.Disposing:
    case SessionStatusEnum.Disposed:
      return '会话已不可用';
    default:
      return null;
  }
}
