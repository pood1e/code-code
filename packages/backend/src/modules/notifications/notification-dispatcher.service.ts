import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { NotificationTask } from '@prisma/client';
import {
  catchError,
  defer,
  EMPTY,
  mergeMap,
  Observable,
  retry,
  Subject,
  Subscription,
  timer
} from 'rxjs';

import {
  type InternalNotificationMessage,
  NotificationTaskStatus
} from '@agent-workbench/shared';

import { NotificationCapabilityRegistry } from './notification-capability.registry';
import { NotificationConfig } from './notification-config';
import { NotificationRepositoryService } from './notification-repository.service';

@Injectable()
export class NotificationDispatcherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly taskSubject$ = new Subject<NotificationTask>();
  private pipelineSubscription: Subscription | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly repository: NotificationRepositoryService,
    private readonly capabilityRegistry: NotificationCapabilityRegistry,
    private readonly config: NotificationConfig
  ) {}

  onModuleInit() {
    this.setupPipeline();
    if (this.config.autoStart) {
      this.scheduleNextPoll(0);
    }
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
    }
    this.pipelineSubscription?.unsubscribe();
    this.taskSubject$.complete();
  }

  async pollOnce(): Promise<boolean> {
    const task = await this.repository.claimPendingTask();
    if (!task) {
      return false;
    }

    this.taskSubject$.next(task);
    return true;
  }

  private setupPipeline() {
    this.pipelineSubscription = this.taskSubject$
      .pipe(
        mergeMap((task) =>
          this.processTask(task).pipe(
            catchError((error: unknown) => {
              console.error(
                `[Dispatcher] Unexpected error in pipeline for task ${task.id}:`,
                error
              );
              return EMPTY;
            })
          )
        )
      )
      .subscribe();
  }

  private processTask(task: NotificationTask): Observable<void> {
    return defer(async () => {
      if (!task.channelId) {
        await this.repository.updateTaskStatus(
          task.id,
          NotificationTaskStatus.Failed,
          '通道已被删除'
        );
        return null;
      }

      const channel = await this.repository.findChannelById(task.channelId);
      if (!channel) {
        await this.repository.updateTaskStatus(
          task.id,
          NotificationTaskStatus.Failed,
          '通道已被删除'
        );
        return null;
      }

      if (!channel.enabled) {
        await this.repository.updateTaskStatus(
          task.id,
          NotificationTaskStatus.Failed,
          '通道已被禁用'
        );
        return null;
      }

      const capability = this.capabilityRegistry.get(channel.capabilityId);
      if (!capability) {
        await this.repository.updateTaskStatus(
          task.id,
          NotificationTaskStatus.Failed,
          `通知能力「${channel.capabilityId}」未注册`
        );
        return null;
      }

      let mappedMessage;
      try {
        const message = task.message as unknown as InternalNotificationMessage;
        mappedMessage = await capability.mapMessage(
          message,
          channel.config as Record<string, unknown>
        );
      } catch (error) {
        await this.repository.updateTaskStatus(
          task.id,
          NotificationTaskStatus.Failed,
          `消息映射失败：${this.extractErrorMessage(error)}`
        );
        return null;
      }

      return {
        capability,
        channelConfig: channel.config as Record<string, unknown>,
        mappedMessage
      };
    }).pipe(
      mergeMap((context) => {
        if (!context) {
          return EMPTY;
        }

        const { capability, channelConfig, mappedMessage } = context;
        const maxRetries = this.capabilityRegistry.getMaxRetries(capability.id);
        let lastErrorMessage = '';

        return defer(() => capability.send(channelConfig, mappedMessage)).pipe(
          retry({
            count: maxRetries - 1,
            delay: (error, retryCount) => {
              lastErrorMessage = this.extractErrorMessage(error);
              return timer(Math.pow(2, retryCount - 1) * 1000);
            },
            resetOnSuccess: false
          }),
          mergeMap(async () => {
            await this.repository.updateTaskStatus(
              task.id,
              NotificationTaskStatus.Success
            );
          }),
          catchError((error: unknown) => {
            const errorMessage =
              this.extractErrorMessage(error) || lastErrorMessage;
            return defer(async () => {
              await this.repository.updateTaskStatus(
                task.id,
                NotificationTaskStatus.Failed,
                errorMessage
              );
            });
          })
        );
      }),
      catchError((error: unknown) =>
        defer(async () => {
          await this.repository.updateTaskStatus(
            task.id,
            NotificationTaskStatus.Failed,
            this.extractErrorMessage(error)
          );
        })
      )
    );
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }

  private scheduleNextPoll(delayMs: number) {
    if (this.stopped) {
      return;
    }

    this.pollTimer = setTimeout(async () => {
      try {
        const claimed = await this.pollOnce();
        this.scheduleNextPoll(claimed ? 0 : this.config.pollIntervalMs);
      } catch (error) {
        console.error('[Dispatcher] Poll error:', error);
        this.scheduleNextPoll(this.config.pollIntervalMs);
      }
    }, delayMs);
  }
}
