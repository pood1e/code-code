import type {
  ChannelFilter,
  FieldMatcher,
  InternalNotificationMessage
} from '@agent-workbench/shared';

/**
 * 判断事件是否匹配 Channel 的过滤器。
 *
 * 逻辑：
 * 1. messageTypes 列表 OR 匹配（任一命中）
 * 2. conditions 列表 AND 匹配（全部命中）
 *
 * 纯函数，无副作用，可独立测试。
 */
export function matchesChannelFilter(
  filter: ChannelFilter,
  message: InternalNotificationMessage
): boolean {
  // 1. messageType OR 匹配
  const typeMatched = filter.messageTypes.some((pattern) => {
    if (pattern.endsWith('.*')) {
      return message.type.startsWith(pattern.slice(0, -1));
    }
    return pattern === message.type;
  });
  if (!typeMatched) return false;

  // 2. conditions AND 匹配（无条件时直接通过）
  if (!filter.conditions?.length) return true;

  return filter.conditions.every((matcher) =>
    evaluateFieldMatcher(matcher, message.metadata)
  );
}

/**
 * 评估单条 FieldMatcher。
 * 所有运算符都将 metadata 字段值转为字符串后比较（Exists/DoesNotExist 除外）。
 *
 */
export function evaluateFieldMatcher(
  matcher: FieldMatcher,
  metadata: Record<string, unknown>
): boolean {
  const value = metadata[matcher.field];
  const stringValue = value != null ? String(value) : undefined;

  switch (matcher.operator) {
    case 'Exists':
      return value != null;

    case 'DoesNotExist':
      return value == null;

    case 'In':
      return stringValue != null && (matcher.values ?? []).includes(stringValue);

    case 'NotIn':
      // 字段不存在视为不在集合中 → 匹配 NotIn
      return stringValue == null || !(matcher.values ?? []).includes(stringValue);

    case 'Prefix':
      return (
        stringValue != null && stringValue.startsWith(matcher.values?.[0] ?? '')
      );

    case 'Suffix':
      return (
        stringValue != null && stringValue.endsWith(matcher.values?.[0] ?? '')
      );

    default: {
      console.warn(`[NotificationFilter] Unknown operator: ${String(matcher.operator)}`);
      return false;
    }
  }
}
