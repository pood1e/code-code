import {
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  NotificationChannel,
  NotificationTask
} from '@prisma/client';
import { Prisma } from '@prisma/client';

import {
  type ChannelFilter,
  type InternalNotificationMessage,
  NotificationTaskStatus,
  type UpdateNotificationChannelInput
} from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';

export type CreateChannelInput = {
  scopeId: string;
  name: string;
  capabilityId: string;
  config: Record<string, unknown>;
  filter: ChannelFilter;
  enabled: boolean;
};

export type CreateTaskInput = {
  scopeId: string;
  channelId: string;
  channelName: string;
  messageId: string;
  messageType: string;
  message: InternalNotificationMessage;
};

export type TaskFilter = {
  scopeId?: string;
  channelId?: string;
  status?: NotificationTaskStatus;
  messageId?: string;
};

export type NotificationTaskWithChannel = NotificationTask & {
  channel: NotificationChannel | null;
};

@Injectable()
export class NotificationRepositoryService {
  constructor(private readonly prisma: PrismaService) {}

  async projectExists(scopeId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: scopeId },
      select: { id: true }
    });

    return project !== null;
  }

  findEnabledChannels(scopeId: string): Promise<NotificationChannel[]> {
    return this.prisma.notificationChannel.findMany({
      where: { scopeId, enabled: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  listChannels(scopeId?: string): Promise<NotificationChannel[]> {
    return this.prisma.notificationChannel.findMany({
      where: scopeId !== undefined ? { scopeId } : undefined,
      orderBy: { createdAt: 'desc' }
    });
  }

  findChannelById(id: string): Promise<NotificationChannel | null> {
    return this.prisma.notificationChannel.findUnique({
      where: { id }
    });
  }

  findChannelByScopeAndName(
    scopeId: string,
    name: string
  ): Promise<NotificationChannel | null> {
    return this.prisma.notificationChannel.findUnique({
      where: {
        uq_channel_scope_name: {
          scopeId,
          name
        }
      }
    });
  }

  createChannel(input: CreateChannelInput): Promise<NotificationChannel> {
    return this.prisma.notificationChannel.create({
      data: {
        scopeId: input.scopeId,
        name: input.name,
        capabilityId: input.capabilityId,
        config: input.config as Prisma.InputJsonValue,
        filter: input.filter as Prisma.InputJsonValue,
        enabled: input.enabled
      }
    });
  }

  updateChannel(
    id: string,
    input: UpdateNotificationChannelInput
  ): Promise<NotificationChannel> {
    return this.prisma.notificationChannel.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.capabilityId !== undefined && {
          capabilityId: input.capabilityId
        }),
        ...(input.config !== undefined && {
          config: input.config as Prisma.InputJsonValue
        }),
        ...(input.filter !== undefined && {
          filter: input.filter as Prisma.InputJsonValue
        }),
        ...(input.enabled !== undefined && { enabled: input.enabled })
      }
    });
  }

  deleteChannel(id: string): Promise<NotificationChannel> {
    return this.prisma.notificationChannel.delete({ where: { id } });
  }

  countActiveTasksForChannel(id: string): Promise<number> {
    return this.prisma.notificationTask.count({
      where: {
        channelId: id,
        status: {
          in: [
            NotificationTaskStatus.Pending,
            NotificationTaskStatus.Processing
          ]
        }
      }
    });
  }

  async createTasksBatch(inputs: CreateTaskInput[]): Promise<void> {
    await this.prisma.$transaction(
      inputs.map((input) =>
        this.prisma.notificationTask.create({
          data: {
            scopeId: input.scopeId,
            channelId: input.channelId,
            channelName: input.channelName,
            messageId: input.messageId,
            messageType: input.messageType,
            message: input.message as unknown as Prisma.InputJsonValue,
            status: NotificationTaskStatus.Pending
          }
        })
      )
    );
  }

  async claimPendingTask(): Promise<NotificationTask | null> {
    const candidate = await this.prisma.notificationTask.findFirst({
      where: { status: NotificationTaskStatus.Pending },
      orderBy: { createdAt: 'asc' }
    });
    if (!candidate) {
      return null;
    }

    const result = await this.prisma.notificationTask.updateMany({
      where: { id: candidate.id, status: NotificationTaskStatus.Pending },
      data: { status: NotificationTaskStatus.Processing }
    });

    if (result.count === 0) {
      return null;
    }

    return { ...candidate, status: NotificationTaskStatus.Processing };
  }

  async updateTaskStatus(
    id: string,
    status: NotificationTaskStatus,
    lastError?: string
  ): Promise<boolean> {
    const result = await this.prisma.notificationTask.updateMany({
      where: { id },
      data: {
        status,
        lastError: lastError ?? null
      }
    });

    return result.count > 0;
  }

  listTasks(filter?: TaskFilter): Promise<NotificationTaskWithChannel[]> {
    return this.prisma.notificationTask.findMany({
      where: {
        ...(filter?.scopeId !== undefined && { scopeId: filter.scopeId }),
        ...(filter?.channelId !== undefined && { channelId: filter.channelId }),
        ...(filter?.status !== undefined && { status: filter.status }),
        ...(filter?.messageId !== undefined && { messageId: filter.messageId })
      },
      include: {
        channel: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findTaskById(id: string): Promise<NotificationTask> {
    const task = await this.prisma.notificationTask.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException(`NotificationTask ${id} not found`);
    }
    return task;
  }

  findTaskByIdOrNull(id: string): Promise<NotificationTask | null> {
    return this.prisma.notificationTask.findUnique({ where: { id } });
  }

  resetTaskToPending(id: string): Promise<NotificationTask> {
    return this.prisma.notificationTask.update({
      where: { id },
      data: {
        status: NotificationTaskStatus.Pending,
        lastError: null
      }
    });
  }

  async resetTimedOutTasks(thresholdMinutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    const result = await this.prisma.notificationTask.updateMany({
      where: {
        status: NotificationTaskStatus.Processing,
        updatedAt: { lt: cutoff }
      },
      data: { status: NotificationTaskStatus.Pending }
    });
    return result.count;
  }

  async cleanupOldTasks(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.notificationTask.deleteMany({
      where: {
        status: {
          in: [NotificationTaskStatus.Success, NotificationTaskStatus.Failed]
        },
        createdAt: { lt: cutoff }
      }
    });
    return result.count;
  }
}
