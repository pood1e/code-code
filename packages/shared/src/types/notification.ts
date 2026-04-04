import type { SchemaDescriptor } from './agent-runner';

/** 通知任务状态 */
export enum NotificationTaskStatus {
  Pending = 'pending',
  Processing = 'processing',
  Success = 'success',
  Failed = 'failed'
}

/** 系统内部统一通知严重级别 */
export enum NotificationSeverity {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error'
}

/**
 * 字段匹配运算符（参考 K8s matchExpressions + AWS EventBridge）。
 *
 * | 运算符        | 语义                               | values 要求  |
 * |--------------|------------------------------------|-------------|
 * | In           | 字段值在 values 集合中（OR）         | 非空数组     |
 * | NotIn        | 字段值不在 values 集合中             | 非空数组     |
 * | Exists       | 字段存在且非 null/undefined          | 必须为空     |
 * | DoesNotExist | 字段不存在或为 null/undefined        | 必须为空     |
 * | Prefix       | 字段值（转 string）以 values[0] 开头 | 恰好 1 项    |
 * | Suffix       | 字段值（转 string）以 values[0] 结尾 | 恰好 1 项    |
 */
export enum FieldMatchOperator {
  In = 'In',
  NotIn = 'NotIn',
  Exists = 'Exists',
  DoesNotExist = 'DoesNotExist',
  Prefix = 'Prefix',
  Suffix = 'Suffix'
}

/** 单条 metadata 字段匹配规则（v1 仅支持顶层 key） */
export type FieldMatcher = {
  field: string;
  operator: FieldMatchOperator;
  values?: string[];
};

/** 通道消息过滤器 */
export type ChannelFilter = {
  /**
   * 消息类型匹配列表（OR：任一命中即匹配）。
   * - 精确: "session.completed"
   * - 通配: "session.*" 匹配所有 session. 前缀的消息
   * - 至少 1 项
   */
  messageTypes: string[];

  /**
   * metadata 字段条件（AND：所有条件均须满足）。
   * 为空或省略时仅按 messageTypes 过滤。
   */
  conditions?: FieldMatcher[];
};

/** 系统内部统一通知消息 */
export type InternalNotificationMessage = {
  scopeId: string;
  type: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  metadata: Record<string, unknown>;
  createdAt: string;
};

/** 外部写入内部通知消息时的输入 */
export type CreateNotificationMessageInput = {
  scopeId: string;
  type: string;
  title: string;
  body: string;
  severity?: NotificationSeverity;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

/** 手工或系统接收内部通知后的回执 */
export type NotificationMessageReceipt = {
  messageId: string;
  createdTaskCount: number;
};

/** 通知能力元信息 */
export type NotificationCapabilitySummary = {
  id: string;
  name: string;
  description: string;
  configSchema: SchemaDescriptor;
};

/** 通知渠道 — API 响应 */
export type NotificationChannelSummary = {
  id: string;
  scopeId: string;
  name: string;
  capabilityId: string;
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
  channelId: string | null;
  channelName: string;
  channelDeleted: boolean;
  messageId: string;
  messageType: string;
  messageTitle: string;
  status: NotificationTaskStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 渠道创建输入 */
export type CreateNotificationChannelInput = {
  scopeId: string;
  name: string;
  capabilityId: string;
  config?: Record<string, unknown>;
  filter: ChannelFilter;
  enabled?: boolean;
};

/** 渠道更新输入 */
export type UpdateNotificationChannelInput = {
  name?: string;
  capabilityId?: string;
  config?: Record<string, unknown>;
  filter?: ChannelFilter;
  enabled?: boolean;
};
