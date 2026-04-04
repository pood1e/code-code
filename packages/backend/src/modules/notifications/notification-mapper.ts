import type { NotificationChannel, NotificationTask } from '@prisma/client';

import {
  ChannelFilter,
  type NotificationChannelSummary,
  type NotificationTaskSummary,
  NotificationTaskStatus
} from '@agent-workbench/shared';

/**
 * Prisma model → API 响应类型转换。
 * Prisma model 不直接暴露给 API 消费者。
 */
export class NotificationMapper {
  static toChannelSummary(model: NotificationChannel): NotificationChannelSummary {
    return {
      id: model.id,
      scopeId: model.scopeId,
      name: model.name,
      channelType: model.channelType,
      config: model.config as Record<string, unknown>,
      filter: model.filter as unknown as ChannelFilter,
      enabled: model.enabled,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    };
  }

  /**
   * 转换 Task 为 Summary。
   * channelName 可选传入（Controller 层批量查询后注入），否则降级显示 channelId。
   */
  static toTaskSummary(
    model: NotificationTask,
    channelName?: string
  ): NotificationTaskSummary {
    return {
      id: model.id,
      scopeId: model.scopeId,
      channelId: model.channelId,
      channelName: channelName ?? model.channelId,
      eventId: model.eventId,
      eventType: model.eventType,
      status: model.status as NotificationTaskStatus,
      lastError: model.lastError ?? null,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    };
  }
}
