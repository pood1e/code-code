/** 通知任务状态 */
export enum NotificationTaskStatus {
  Pending = 'pending',
  Processing = 'processing',
  Success = 'success',
  Failed = 'failed',
}

/**
 * 字段匹配运算符（参考 K8s matchExpressions + AWS EventBridge）。
 *
 * | 运算符        | 语义                             | values 要求  |
 * |--------------|----------------------------------|-------------|
 * | In           | 字段值在 values 集合中（OR）       | 非空数组     |
 * | NotIn        | 字段值不在 values 集合中           | 非空数组     |
 * | Exists       | 字段存在且非 null/undefined        | 必须为空     |
 * | DoesNotExist | 字段不存在或为 null/undefined      | 必须为空     |
 * | Prefix       | 字段值（转 string）以 values[0] 开头 | 恰好 1 项    |
 * | Suffix       | 字段值（转 string）以 values[0] 结尾 | 恰好 1 项    |
 */
export enum FieldMatchOperator {
  In = 'In',
  NotIn = 'NotIn',
  Exists = 'Exists',
  DoesNotExist = 'DoesNotExist',
  Prefix = 'Prefix',
  Suffix = 'Suffix',
}

/** 单条 payload 字段匹配规则（v1 仅支持顶层 key） */
export type FieldMatcher = {
  field: string;
  operator: FieldMatchOperator;
  /** In/NotIn：非空数组；Prefix/Suffix：恰好 1 项；Exists/DoesNotExist：省略 */
  values?: string[];
};

/** Channel 事件过滤器 */
export type ChannelFilter = {
  /**
   * 事件类型匹配列表（OR：任一命中即匹配）。
   * - 精确: "session.completed"
   * - 通配: "session.*" 匹配所有 session. 前缀的事件
   * - 至少 1 项
   */
  eventTypes: string[];

  /**
   * payload 字段条件（AND：所有条件均须满足）。
   * 为空或省略时仅按 eventTypes 过滤。
   */
  conditions?: FieldMatcher[];
};

/** 通知渠道 — API 响应 */
export type NotificationChannelSummary = {
  id: string;
  scopeId: string;
  name: string;
  channelType: string;
  config: Record<string, unknown>;
  filter: ChannelFilter;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 通知任务 — API 响应 */
export type NotificationTaskSummary = {
  id: string;
  scopeId: string;
  channelId: string;
  channelName: string;
  eventId: string;
  eventType: string;
  status: NotificationTaskStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 事件接收输入 */
export type NotificationEventInput = {
  scopeId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

/** 渠道创建输入 */
export type CreateNotificationChannelInput = {
  scopeId: string;
  name: string;
  channelType: string;
  config?: Record<string, unknown>;
  filter: ChannelFilter;
  enabled?: boolean;
};

/** 渠道更新输入 */
export type UpdateNotificationChannelInput = {
  name?: string;
  channelType?: string;
  config?: Record<string, unknown>;
  filter?: ChannelFilter;
  enabled?: boolean;
};
