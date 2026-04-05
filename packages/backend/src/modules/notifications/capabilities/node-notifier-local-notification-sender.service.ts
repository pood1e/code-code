import { Injectable } from '@nestjs/common';
import notifier from 'node-notifier';

import type { LocalNotificationSendInput } from './local-notification-send.input';

@Injectable()
export class NodeNotifierLocalNotificationSenderService {
  send(input: LocalNotificationSendInput): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      notifier.notify(
        {
          title: input.title,
          message: input.body,
          subtitle: input.subtitle,
          wait: false
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    });
  }
}
