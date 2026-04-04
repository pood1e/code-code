import type {
  NotificationChannel,
  NotificationTask
} from '@prisma/client';

import {
  ChannelFilter,
  type InternalNotificationMessage,
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
      capabilityId: model.capabilityId,
      config: model.config as Record<string, unknown>,
      filter: model.filter as unknown as ChannelFilter,
      enabled: model.enabled,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    };
  }

  /**
   * 转换 Task 为 Summary。
   * 历史任务始终展示创建任务时写入的通道名快照，避免被后续改名污染。
   */
  static toTaskSummary(model: NotificationTask): NotificationTaskSummary {
    const message = model.message as unknown as InternalNotificationMessage;

    return {
      id: model.id,
      scopeId: model.scopeId,
      channelId: model.channelId,
      channelName: model.channelName,
      channelDeleted: model.channelId === null,
      messageId: model.messageId,
      messageType: model.messageType,
      messageTitle: message.title,
      status: model.status as NotificationTaskStatus,
      lastError: model.lastError ?? null,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    };
  }
}
