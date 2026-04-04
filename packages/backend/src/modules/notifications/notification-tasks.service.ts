import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import {
  type NotificationTaskSummary,
  NotificationTaskStatus
} from '@agent-workbench/shared';

import { NotificationMapper } from './notification-mapper';
import {
  NotificationRepositoryService,
  type TaskFilter
} from './notification-repository.service';

@Injectable()
export class NotificationTasksService {
  constructor(private readonly repository: NotificationRepositoryService) {}

  async list(filter?: TaskFilter): Promise<NotificationTaskSummary[]> {
    const tasks = await this.repository.listTasks(filter);
    return tasks.map((task) => NotificationMapper.toTaskSummary(task));
  }

  async retry(id: string): Promise<NotificationTaskSummary> {
    const task = await this.repository.findTaskByIdOrNull(id);
    if (!task) {
      throw new NotFoundException(`NotificationTask ${id} not found`);
    }

    if (task.status !== NotificationTaskStatus.Failed) {
      throw new ConflictException(
        `Task ${id} is in "${task.status}" status, only "failed" tasks can be retried`
      );
    }

    if (task.channelId === null) {
      throw new ConflictException('该通知通道已删除，历史记录不可重试。');
    }

    const updatedTask = await this.repository.resetTaskToPending(id);
    return NotificationMapper.toTaskSummary(updatedTask);
  }
}
