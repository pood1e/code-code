/** 框架默认最大重试次数（Channel 未指定时使用） */
export const DEFAULT_MAX_RETRIES = 3;

/** Channel 多值注入 Token */
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

/**
 * 通知渠道统一接口。
 * 每个渠道类型负责将通知发送到目标系统，由框架负责重试与状态管理。
 * 同一渠道类型可在数据库中创建多个实例（各自携带独立配置）。
 */
export interface INotificationChannel {
  /** 渠道类型标识，对应 NotificationChannel.channelType */
  readonly channelType: string;

  /**
   * 该渠道类型的最大发送尝试次数（含首次，不含重试）。
   * 框架默认值为 DEFAULT_MAX_RETRIES。
   */
  readonly maxRetries?: number;

  /**
   * 发送通知。
   * 成功时静默返回，失败时必须抛出异常（框架凭此触发重试）。
   *
   * @param config - 渠道实例配置（NotificationChannel.config），由实现自行解析
   * @param payload - 事件 payload
   */
  send(
    config: Record<string, unknown>,
    payload: Record<string, unknown>
  ): Promise<void>;
}
