import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { NotificationConfig } from './notification-config';
import { NotificationRepositoryService } from './notification-repository.service';

/**
 * 维护任务服务。
 * 两个独立的递归 setTimeout 循环，与 Dispatcher 轮询完全解耦：
 * - 超时检测：重置卡住的 processing 任务为 pending
 * - 数据清理：删除超出保留期的 success/failed 任务
 *
 * 使用递归 setTimeout 而非 setInterval 的原因：
 * - 天然防止前一次执行未完成时下一次提前触发（防重叠）
 * - 若执行出现异常，catch 后安全调度下一次，不中断循环
 */
@Injectable()
export class NotificationMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private timeoutCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly repository: NotificationRepositoryService,
    private readonly config: NotificationConfig
  ) {}

  onModuleInit() {
    if (!this.config.autoStart) {
      return;
    }

    this.scheduleTimeoutCheck(this.config.timeoutCheckIntervalMs);
    this.scheduleCleanup(this.config.cleanupIntervalMs);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timeoutCheckTimer !== null) clearTimeout(this.timeoutCheckTimer);
    if (this.cleanupTimer !== null) clearTimeout(this.cleanupTimer);
  }

  /**
   * 直接触发一次超时检测，供测试调用——不依赖真实定时器。
   * @returns 重置的任务数量
   */
  async checkTimeoutOnce(): Promise<number> {
    return this.repository.resetTimedOutTasks(this.config.timeoutThresholdMinutes);
  }

  /**
   * 直接触发一次数据清理，供测试调用——不依赖真实定时器。
   * @returns 删除的任务数量
   */
  async cleanupOnce(): Promise<number> {
    return this.repository.cleanupOldTasks(this.config.retentionDays);
  }

  private scheduleTimeoutCheck(delayMs: number) {
    if (this.stopped) return;
    this.timeoutCheckTimer = setTimeout(async () => {
      try {
        const count = await this.checkTimeoutOnce();
        if (count > 0) {
          console.info(`[Maintenance] Reset ${count} timed-out task(s) to pending`);
        }
      } catch (err) {
        console.error('[Maintenance] Timeout check error:', err);
      }
      this.scheduleTimeoutCheck(this.config.timeoutCheckIntervalMs);
    }, delayMs);
  }

  private scheduleCleanup(delayMs: number) {
    if (this.stopped) return;
    this.cleanupTimer = setTimeout(async () => {
      try {
        const count = await this.cleanupOnce();
        if (count > 0) {
          console.info(`[Maintenance] Cleaned up ${count} expired task(s)`);
        }
      } catch (err) {
        console.error('[Maintenance] Cleanup error:', err);
      }
      this.scheduleCleanup(this.config.cleanupIntervalMs);
    }, delayMs);
  }
}
