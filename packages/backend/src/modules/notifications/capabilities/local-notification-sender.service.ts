import { Injectable } from '@nestjs/common';

import type { LocalNotificationSendInput } from './local-notification-send.input';
import { MacOsLocalNotificationSenderService } from './macos-local-notification-sender.service';
import { NodeNotifierLocalNotificationSenderService } from './node-notifier-local-notification-sender.service';

@Injectable()
export class LocalNotificationSenderService {
  constructor(
    private readonly macOsSender: MacOsLocalNotificationSenderService,
    private readonly nodeNotifierSender: NodeNotifierLocalNotificationSenderService
  ) {}

  async send(input: LocalNotificationSendInput): Promise<void> {
    if (process.platform === 'darwin') {
      await this.macOsSender.send(input);
      return;
    }

    await this.nodeNotifierSender.send(input);
  }
}
