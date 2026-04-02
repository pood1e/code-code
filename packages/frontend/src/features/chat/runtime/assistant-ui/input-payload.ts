import { sendSessionMessageInputSchema } from '@agent-workbench/shared';

export function parseSessionInputText(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return {
      error: '消息输入不是有效的 JSON。'
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      error: '消息输入必须是 JSON 对象。'
    };
  }

  const validationResult = sendSessionMessageInputSchema.safeParse({
    input: parsed
  });

  if (!validationResult.success) {
    return {
      error: validationResult.error.issues[0]?.message ?? '消息输入校验失败。'
    };
  }

  return {
    data: validationResult.data
  };
}
