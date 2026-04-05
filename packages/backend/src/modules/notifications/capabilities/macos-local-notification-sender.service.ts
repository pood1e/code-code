import { execFile } from 'node:child_process';

import { Injectable } from '@nestjs/common';

import type { LocalNotificationSendInput } from './local-notification-send.input';

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

@Injectable()
export class MacOsLocalNotificationSenderService {
  send(input: LocalNotificationSendInput): Promise<void> {
    const scriptParts = [
      `display notification "${escapeAppleScriptString(input.body)}"`,
      `with title "${escapeAppleScriptString(input.title)}"`
    ];

    if (input.subtitle) {
      scriptParts.push(
        `subtitle "${escapeAppleScriptString(input.subtitle)}"`
      );
    }

    return new Promise<void>((resolve, reject) => {
      execFile('osascript', ['-e', scriptParts.join(' ')], (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}
