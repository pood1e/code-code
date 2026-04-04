import { Inject, Injectable } from '@nestjs/common';

import {
  DEFAULT_MAX_RETRIES,
  INotificationChannel,
  NOTIFICATION_CHANNELS
} from './notification-channel.interface';

/**
 * 渠道类型注册表。
 * 将多值注入的 Channel 实现数组转为按 channelType 索引的 Map，
 * 提供类型安全的单一查找入口，并在启动时做重复注册校验。
 */
@Injectable()
export class NotificationChannelRegistry {
  private readonly registry = new Map<string, INotificationChannel>();

  constructor(
    @Inject(NOTIFICATION_CHANNELS) channels: INotificationChannel[]
  ) {
    for (const ch of channels) {
      if (this.registry.has(ch.channelType)) {
        throw new Error(
          `Duplicate notification channel type registered: "${ch.channelType}"`
        );
      }
      this.registry.set(ch.channelType, ch);
    }
  }

  /**
   * 按渠道类型查找实现。
   * 未找到时返回 undefined，由调用方决定如何处理（如 Dispatcher 记录警告）。
   */
  resolve(channelType: string): INotificationChannel | undefined {
    return this.registry.get(channelType);
  }

  /**
   * 取当前渠道类型的最大重试次数，未指定时使用框架默认值。
   */
  getMaxRetries(channelType: string): number {
    return this.resolve(channelType)?.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /** 已注册的全部渠道类型名称 */
  registeredChannelTypes(): string[] {
    return [...this.registry.keys()];
  }
}
