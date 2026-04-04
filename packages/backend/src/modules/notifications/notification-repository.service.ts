import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationChannel, NotificationTask } from '@prisma/client';
import { Prisma } from '@prisma/client';

import {
  ChannelFilter,
  NotificationTaskStatus,
  UpdateNotificationChannelInput
} from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';

export type CreateChannelInput = {
  scopeId: string;
  name: string;
  channelType: string;
  config: Record<string, unknown>;
  filter: ChannelFilter;
  enabled: boolean;
};

export type CreateTaskInput = {
  scopeId: string;
  channelId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export type TaskFilter = {
  scopeId?: string;
  channelId?: string;
  status?: NotificationTaskStatus;
  eventId?: string;
};

/**
 * 通知系统数据库读写封装。
 * 完全通过 Prisma Client 操作，不暴露具体数据库实现细节。
 */
@Injectable()
export class NotificationRepositoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── NotificationChannel ────────────────────────────────────────────────────

  findEnabledChannels(scopeId: string): Promise<NotificationChannel[]> {
    return this.prisma.notificationChannel.findMany({
      where: { scopeId, enabled: true }
    });
  }

  listChannels(scopeId?: string): Promise<NotificationChannel[]> {
    return this.prisma.notificationChannel.findMany({
      where: scopeId !== undefined ? { scopeId } : undefined,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findChannelById(id: string): Promise<NotificationChannel> {
    const channel = await this.prisma.notificationChannel.findUnique({
      where: { id }
    });
    if (!channel) {
      throw new NotFoundException(`NotificationChannel ${id} not found`);
    }
    return channel;
  }

  async createChannel(input: CreateChannelInput): Promise<NotificationChannel> {
    const existing = await this.prisma.notificationChannel.findUnique({
      where: {
        uq_channel_scope_name: {
          scopeId: input.scopeId,
          name: input.name
        }
      }
    });
    if (existing) {
      throw new ConflictException(
        `Notification channel "${input.name}" already exists in scope "${input.scopeId}"`
      );
    }
    return this.prisma.notificationChannel.create({
      data: {
        scopeId: input.scopeId,
        name: input.name,
        channelType: input.channelType,
        config: input.config as Prisma.InputJsonValue,
        filter: input.filter as Prisma.InputJsonValue,
        enabled: input.enabled
      }
    });
  }

  async updateChannel(
    id: string,
    input: UpdateNotificationChannelInput
  ): Promise<NotificationChannel> {
    await this.findChannelById(id);
    return this.prisma.notificationChannel.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.channelType !== undefined && { channelType: input.channelType }),
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

  async deleteChannel(id: string): Promise<void> {
    await this.findChannelById(id);
    const activeTaskCount = await this.prisma.notificationTask.count({
      where: {
        channelId: id,
        status: { in: [NotificationTaskStatus.Pending, NotificationTaskStatus.Processing] }
      }
    });
    if (activeTaskCount > 0) {
      throw new ConflictException(
        `Cannot delete channel ${id}: it has ${activeTaskCount} active task(s). Wait for them to complete or fail first.`
      );
    }
    await this.prisma.notificationChannel.delete({ where: { id } });
  }

  // ─── NotificationTask ────────────────────────────────────────────────────────

  /**
   * 事务内批量创建任务。任意一条失败则全部回滚。
   */
  async createTasksBatch(inputs: CreateTaskInput[]): Promise<void> {
    await this.prisma.$transaction(
      inputs.map((input) =>
        this.prisma.notificationTask.create({
          data: {
            scopeId: input.scopeId,
            channelId: input.channelId,
            eventId: input.eventId,
            eventType: input.eventType,
            payload: input.payload as Prisma.InputJsonValue,
            status: NotificationTaskStatus.Pending
          }
        })
      )
    );
  }

  /**
   * 乐观并发拉取 1 条 pending 任务并原子更新为 processing。
   * - findFirst 取候选
   * - updateMany(where: { id, status: 'pending' }) 原子更新
   * - count === 0 表示已被其他实例抢走，返回 null
   */
  async claimPendingTask(): Promise<NotificationTask | null> {
    const candidate = await this.prisma.notificationTask.findFirst({
      where: { status: NotificationTaskStatus.Pending },
      orderBy: { createdAt: 'asc' }
    });
    if (!candidate) return null;

    const result = await this.prisma.notificationTask.updateMany({
      where: { id: candidate.id, status: NotificationTaskStatus.Pending },
      data: { status: NotificationTaskStatus.Processing }
    });

    if (result.count === 0) return null;

    return { ...candidate, status: NotificationTaskStatus.Processing };
  }

  updateTaskStatus(
    id: string,
    status: NotificationTaskStatus,
    lastError?: string
  ): Promise<NotificationTask> {
    return this.prisma.notificationTask.update({
      where: { id },
      data: {
        status,
        lastError: lastError ?? null
      }
    });
  }

  listTasks(filter?: TaskFilter): Promise<NotificationTask[]> {
    return this.prisma.notificationTask.findMany({
      where: {
        ...(filter?.scopeId !== undefined && { scopeId: filter.scopeId }),
        ...(filter?.channelId !== undefined && { channelId: filter.channelId }),
        ...(filter?.status !== undefined && { status: filter.status }),
        ...(filter?.eventId !== undefined && { eventId: filter.eventId })
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

  /**
   * 手动重置失败任务为 pending，用于运维重试。
   * 仅允许 failed 状态的任务重置。
   */
  async resetFailedTask(id: string): Promise<NotificationTask> {
    const task = await this.findTaskById(id);
    if (task.status !== NotificationTaskStatus.Failed) {
      throw new ConflictException(
        `Task ${id} is in "${task.status}" status, only "failed" tasks can be retried`
      );
    }
    return this.prisma.notificationTask.update({
      where: { id },
      data: {
        status: NotificationTaskStatus.Pending,
        lastError: null
      }
    });
  }

  // ─── Maintenance ──────────────────────────────────────────────────────────────

  /**
   * 重置超时的 processing 任务为 pending。
   * @returns 重置的任务数量
   */
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

  /**
   * 清理保留期外的 success/failed 任务。
   * @returns 删除的任务数量
   */
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
