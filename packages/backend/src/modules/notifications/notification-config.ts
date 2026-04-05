import { Injectable } from '@nestjs/common';

/**
 * 通知系统配置，集中管理所有可调参数。
 * 所有参数均支持环境变量覆盖，提供合理默认值。
 */
@Injectable()
export class NotificationConfig {
  /** 是否在模块启动时自动启动轮询与维护任务 */
  readonly autoStart: boolean;

  /** Dispatcher 无任务时的轮询等待间隔（毫秒） */
  readonly pollIntervalMs: number;

  /** 超时检测定时任务执行间隔（毫秒） */
  readonly timeoutCheckIntervalMs: number;

  /** processing 状态超时阈值（分钟），超过后重置为 pending */
  readonly timeoutThresholdMinutes: number;

  /** 数据清理定时任务执行间隔（毫秒） */
  readonly cleanupIntervalMs: number;

  /** success/failed 任务保留天数，超期直接删除 */
  readonly retentionDays: number;

  constructor() {
    this.autoStart = this.readBoolean('NOTIFICATION_AUTO_START', true);
    this.pollIntervalMs = this.readPositiveInt(
      'NOTIFICATION_POLL_INTERVAL_MS',
      5_000
    );
    this.timeoutCheckIntervalMs = this.readPositiveInt(
      'NOTIFICATION_TIMEOUT_CHECK_INTERVAL_MS',
      60_000
    );
    this.timeoutThresholdMinutes = this.readPositiveInt(
      'NOTIFICATION_TIMEOUT_THRESHOLD_MINUTES',
      10
    );
    this.cleanupIntervalMs = this.readPositiveInt(
      'NOTIFICATION_CLEANUP_INTERVAL_MS',
      86_400_000
    );
    this.retentionDays = this.readPositiveInt('NOTIFICATION_RETENTION_DAYS', 7);
  }

  private readPositiveInt(key: string, fallback: number): number {
    const raw = process.env[key];
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private readBoolean(key: string, fallback: boolean): boolean {
    const raw = process.env[key];
    if (raw === undefined) {
      return fallback;
    }

    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }

    return fallback;
  }
}
