import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import type {
  ChannelFilter,
  CreateNotificationMessageInput,
  InternalNotificationMessage,
  NotificationMessageReceipt,
  NotificationSeverity
} from '@agent-workbench/shared';

import { matchesChannelFilter } from './notification-filter';
import { NotificationRepositoryService } from './notification-repository.service';

@Injectable()
export class NotificationReceiverService {
  constructor(private readonly repository: NotificationRepositoryService) {}

  async receive(
    input: CreateNotificationMessageInput
  ): Promise<NotificationMessageReceipt> {
    const projectExists = await this.repository.projectExists(input.scopeId);
    if (!projectExists) {
      throw new NotFoundException(`Project ${input.scopeId} not found`);
    }

    const message: InternalNotificationMessage = {
      scopeId: input.scopeId,
      type: input.type,
      title: input.title,
      body: input.body,
      severity: (input.severity ?? 'info') as NotificationSeverity,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? new Date().toISOString()
    };

    const messageId = randomUUID();
    const channels = await this.repository.findEnabledChannels(message.scopeId);

    const matchedChannels = channels.filter((channel) =>
      matchesChannelFilter(channel.filter as ChannelFilter, message)
    );

    if (matchedChannels.length > 0) {
      await this.repository.createTasksBatch(
        matchedChannels.map((channel) => ({
          scopeId: message.scopeId,
          channelId: channel.id,
          channelName: channel.name,
          messageId,
          messageType: message.type,
          message
        }))
      );
    }

    return {
      messageId,
      createdTaskCount: matchedChannels.length
    };
  }
}
