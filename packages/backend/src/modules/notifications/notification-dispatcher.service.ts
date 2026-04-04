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

import { ChannelFilter, NotificationTaskStatus } from '@agent-workbench/shared';

import { NotificationChannelRegistry } from './notification-channel-registry';
import { NotificationConfig } from './notification-config';
import { NotificationRepositoryService } from './notification-repository.service';

/**
 * 事件分发服务。
 * - 递归 setTimeout 驱动轮询：天然防重叠、异常安全、易于停止
 * - RxJS Subject + mergeMap 并发处理各任务，互不阻塞
 * - Channel 级别 maxRetries + 指数退避重试
 * - Dispatcher 实时读取 Channel 记录获取最新 config
 */
@Injectable()
export class NotificationDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly taskSubject$ = new Subject<NotificationTask>();
  private pipelineSubscription: Subscription | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly repository: NotificationRepositoryService,
    private readonly channelRegistry: NotificationChannelRegistry,
    private readonly config: NotificationConfig
  ) {}

  onModuleInit() {
    this.setupPipeline();
    this.scheduleNextPoll(0);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    this.pipelineSubscription?.unsubscribe();
    this.taskSubject$.complete();
  }

  /**
   * 单次轮询，供测试直接调用——不依赖真实定时器。
   * 推入 Subject 后立即返回，不等待发送完成。
   */
  async pollOnce(): Promise<boolean> {
    const task = await this.repository.claimPendingTask();
    if (task) {
      this.taskSubject$.next(task);
      return true;
    }
    return false;
  }

  private setupPipeline() {
    this.pipelineSubscription = this.taskSubject$
      .pipe(
        mergeMap((task) =>
          this.processTask(task).pipe(
            catchError((err: unknown) => {
              console.error(
                `[Dispatcher] Unexpected error in pipeline for task ${task.id}:`,
                err
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
      // 实时读取 Channel 记录获取最新 config（Channel 可能在入队后被修改）
      let channel: Awaited<ReturnType<typeof this.repository.findChannelById>>;
      try {
        channel = await this.repository.findChannelById(task.channelId);
      } catch {
        // Channel 已被删除
        await this.repository.updateTaskStatus(
          task.id,
          NotificationTaskStatus.Failed,
          'Channel deleted'
        );
        return null;
      }

      if (!channel.enabled) {
        await this.repository.updateTaskStatus(
          task.id,
          NotificationTaskStatus.Failed,
          'Channel disabled'
        );
        return null;
      }

      const implementation = this.channelRegistry.resolve(channel.channelType);
      if (!implementation) {
        console.warn(
          `[Dispatcher] Unknown channelType "${channel.channelType}" for task ${task.id}. ` +
            'Keeping status as processing; timeout detector will reset it.'
        );
        return null;
      }

      return { channel, implementation };
    }).pipe(
      mergeMap((ctx) => {
        if (!ctx) return EMPTY;
        const { channel, implementation } = ctx;
        const maxRetries = this.channelRegistry.getMaxRetries(channel.channelType);
        let lastErrorMessage = '';

        return defer(() =>
          implementation.send(
            channel.config as Record<string, unknown>,
            task.payload as Record<string, unknown>
          )
        ).pipe(
          retry({
            count: maxRetries - 1,
            delay: (_err, retryCount) => {
              lastErrorMessage = this.extractErrorMessage(_err);
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
          catchError((err: unknown) => {
            const errorMessage = this.extractErrorMessage(err) || lastErrorMessage;
            return defer(async () => {
              await this.repository.updateTaskStatus(
                task.id,
                NotificationTaskStatus.Failed,
                errorMessage
              );
            });
          })
        );
      })
    );
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
  }

  private scheduleNextPoll(delayMs: number) {
    if (this.stopped) return;
    this.pollTimer = setTimeout(async () => {
      try {
        const claimed = await this.pollOnce();
        this.scheduleNextPoll(claimed ? 0 : this.config.pollIntervalMs);
      } catch (err) {
        console.error('[Dispatcher] Poll error:', err);
        this.scheduleNextPoll(this.config.pollIntervalMs);
      }
    }, delayMs);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _ensureChannelFilterImportNotStripped(_f: ChannelFilter) {}
