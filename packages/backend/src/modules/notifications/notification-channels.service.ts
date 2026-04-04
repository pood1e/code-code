import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import type {
  CreateNotificationChannelInput,
  NotificationChannelSummary,
  UpdateNotificationChannelInput
} from '@agent-workbench/shared';

import { NotificationMapper } from './notification-mapper';
import { NotificationCapabilitiesService } from './notification-capabilities.service';
import { NotificationRepositoryService } from './notification-repository.service';

@Injectable()
export class NotificationChannelsService {
  constructor(
    private readonly repository: NotificationRepositoryService,
    private readonly capabilitiesService: NotificationCapabilitiesService
  ) {}

  async list(scopeId?: string): Promise<NotificationChannelSummary[]> {
    const channels = await this.repository.listChannels(scopeId);
    return channels.map(NotificationMapper.toChannelSummary);
  }

  async getById(id: string): Promise<NotificationChannelSummary> {
    const channel = await this.getChannelOrThrow(id);
    return NotificationMapper.toChannelSummary(channel);
  }

  async create(
    input: CreateNotificationChannelInput
  ): Promise<NotificationChannelSummary> {
    await this.assertProjectExists(input.scopeId);
    await this.assertChannelNameAvailable(input.scopeId, input.name);

    const config = this.capabilitiesService.validateConfig(
      input.capabilityId,
      input.config ?? {}
    );

    const channel = await this.repository.createChannel({
      scopeId: input.scopeId,
      name: input.name,
      capabilityId: input.capabilityId,
      config,
      filter: input.filter,
      enabled: input.enabled ?? true
    });

    return NotificationMapper.toChannelSummary(channel);
  }

  async update(
    id: string,
    input: UpdateNotificationChannelInput
  ): Promise<NotificationChannelSummary> {
    const current = await this.getChannelOrThrow(id);

    if (input.name !== undefined && input.name !== current.name) {
      await this.assertChannelNameAvailable(current.scopeId, input.name, id);
    }

    const nextCapabilityId = input.capabilityId ?? current.capabilityId;
    const config = this.capabilitiesService.resolveValidatedConfig({
      capabilityId: nextCapabilityId,
      currentConfig: current.config as Record<string, unknown>,
      patch: input
    });

    const channel = await this.repository.updateChannel(id, {
      ...input,
      config
    });

    return NotificationMapper.toChannelSummary(channel);
  }

  async delete(id: string): Promise<{ deleted: string }> {
    const channel = await this.getChannelOrThrow(id);
    const activeTaskCount = await this.repository.countActiveTasksForChannel(id);

    if (activeTaskCount > 0) {
      throw new ConflictException(
        `无法删除该通道：当前仍有 ${activeTaskCount} 条通知任务正在处理中。请等待任务完成后再删除。`
      );
    }

    await this.repository.deleteChannel(id);

    return { deleted: channel.id };
  }

  private async getChannelOrThrow(id: string) {
    const channel = await this.repository.findChannelById(id);
    if (!channel) {
      throw new NotFoundException(`NotificationChannel ${id} not found`);
    }

    return channel;
  }

  private async assertProjectExists(scopeId: string): Promise<void> {
    const projectExists = await this.repository.projectExists(scopeId);
    if (!projectExists) {
      throw new NotFoundException(`Project ${scopeId} not found`);
    }
  }

  private async assertChannelNameAvailable(
    scopeId: string,
    name: string,
    currentChannelId?: string
  ): Promise<void> {
    const existing = await this.repository.findChannelByScopeAndName(
      scopeId,
      name
    );

    if (existing && existing.id !== currentChannelId) {
      throw new ConflictException(
        `当前 Project 已存在同名通知通道「${name}」，请更换名称后重试。`
      );
    }
  }
}
