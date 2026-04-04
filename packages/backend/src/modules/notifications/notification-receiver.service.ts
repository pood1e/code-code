import { Injectable } from '@nestjs/common';
import type { NotificationChannel } from '@prisma/client';
import { randomUUID } from 'crypto';

import { ChannelFilter } from '@agent-workbench/shared';

import { matchesChannelFilter } from './notification-filter';
import { NotificationRepositoryService } from './notification-repository.service';

/**
 * 事件接收服务。
 * 职责：接收外部事件 → 按 scopeId 查找启用渠道 → 内存过滤 → 批量写入通知任务。
 * 不感知后续发送过程，发送由 Dispatcher 异步驱动。
 */
@Injectable()
export class NotificationReceiverService {
  constructor(private readonly repository: NotificationRepositoryService) {}

  /**
   * 接收一个通知事件。
   * - 生成唯一 eventId
   * - 按 scopeId 查找启用渠道
   * - 在内存中匹配 Channel.filter（eventTypes + conditions）
   * - 事务内批量创建通知任务
   *
   * @returns eventId — 本次事件的唯一标识，供调用方做聚合查询
   */
  async receive(
    scopeId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<string> {
    const eventId = randomUUID();

    const channels = await this.repository.findEnabledChannels(scopeId);

    const matched = channels.filter((ch) =>
      matchesChannelFilter(
        ch.filter as unknown as ChannelFilter,
        eventType,
        payload
      )
    );

    if (matched.length > 0) {
      await this.repository.createTasksBatch(
        matched.map((ch: NotificationChannel) => ({
          scopeId,
          channelId: ch.id,
          eventId,
          eventType,
          payload
        }))
      );
    }

    return eventId;
  }
}
