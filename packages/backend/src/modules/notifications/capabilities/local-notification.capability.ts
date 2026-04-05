import { z } from 'zod';

import type { InternalNotificationMessage } from '@agent-workbench/shared';

import { NotificationCapabilityProvider } from '../notification-capability.decorator';
import type {
  NotificationCapability,
  NotificationCapabilityMessage
} from '../notification-capability.interface';
import { LocalNotificationSenderService } from './local-notification-sender.service';

const localNotificationConfigSchema = z.object({});

@NotificationCapabilityProvider()
export class LocalNotificationCapability implements NotificationCapability {
  constructor(private readonly sender: LocalNotificationSenderService) {}

  readonly id = 'local-notification';
  readonly name = '本地通知';
  readonly description = '通过宿主机系统通知中心发送本地通知。';
  readonly configSchema = localNotificationConfigSchema;

  mapMessage(
    message: InternalNotificationMessage
  ): NotificationCapabilityMessage {
    return {
      title: message.title,
      message: message.body,
      subtitle: message.type
    };
  }

  async send(
    _config: Record<string, unknown>,
    message: NotificationCapabilityMessage
  ): Promise<void> {
    await this.sender.send({
      title: String(message.title ?? ''),
      body: String(message.message ?? ''),
      subtitle:
        typeof message.subtitle === 'string' ? message.subtitle : undefined
    });
  }
}
