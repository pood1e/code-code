import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  NotificationCapabilitySummary,
  UpdateNotificationChannelInput
} from '@agent-workbench/shared';

import { NotificationCapabilityRegistry } from './notification-capability.registry';
import type { NotificationCapability } from './notification-capability.interface';

@Injectable()
export class NotificationCapabilitiesService {
  constructor(
    private readonly capabilityRegistry: NotificationCapabilityRegistry
  ) {}

  list(): NotificationCapabilitySummary[] {
    return this.capabilityRegistry.getAllResponses();
  }

  getOrThrow(capabilityId: string): NotificationCapability {
    const capability = this.capabilityRegistry.get(capabilityId);
    if (!capability) {
      throw new BadRequestException(
        `通知能力「${capabilityId}」未注册，当前不能创建或更新该通道。`
      );
    }

    return capability;
  }

  validateConfig(
    capabilityId: string,
    config: Record<string, unknown>
  ): Record<string, unknown> {
    const capability = this.getOrThrow(capabilityId);
    const result = capability.configSchema.safeParse(config);

    if (!result.success) {
      const details = result.error.issues
        .map((issue) => {
          const path = issue.path.join('.');
          return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
        })
        .join('；');
      throw new BadRequestException(
        `通知能力「${capabilityId}」配置不合法：${details}`
      );
    }

    return result.data as Record<string, unknown>;
  }

  resolveValidatedConfig(input: {
    capabilityId: string;
    currentConfig: Record<string, unknown>;
    patch?: UpdateNotificationChannelInput | undefined;
  }): Record<string, unknown> {
    const nextConfig = (input.patch?.config ?? input.currentConfig) as Record<
      string,
      unknown
    >;

    return this.validateConfig(input.capabilityId, nextConfig);
  }
}
