import type { ZodTypeAny } from 'zod';

import type { InternalNotificationMessage } from '@agent-workbench/shared';

export type NotificationCapabilityMessage = Record<string, unknown>;

export const DEFAULT_MAX_RETRIES = 3;

export interface NotificationCapability {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly configSchema: ZodTypeAny;
  readonly maxRetries?: number;

  mapMessage(
    message: InternalNotificationMessage,
    config: Record<string, unknown>
  ):
    | NotificationCapabilityMessage
    | Promise<NotificationCapabilityMessage>;

  send(
    config: Record<string, unknown>,
    message: NotificationCapabilityMessage
  ): Promise<void>;
}
