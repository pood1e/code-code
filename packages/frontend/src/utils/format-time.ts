export function formatRelativeTime(value: string) {
  const targetTime = new Date(value).getTime();
  const deltaMs = targetTime - Date.now();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const formatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });

  if (Math.abs(deltaMs) < hourMs) {
    return formatter.format(Math.round(deltaMs / minuteMs), 'minute');
  }

  if (Math.abs(deltaMs) < dayMs) {
    return formatter.format(Math.round(deltaMs / hourMs), 'hour');
  }

  return formatter.format(Math.round(deltaMs / dayMs), 'day');
}
