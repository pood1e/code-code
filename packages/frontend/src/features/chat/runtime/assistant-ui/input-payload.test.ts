import { describe, expect, it } from 'vitest';

import { parseSessionInputText } from './input-payload';

describe('parseSessionInputText', () => {
  it('应解析合法 JSON 对象并包装为 send payload', () => {
    expect(parseSessionInputText('{"prompt":"hello"}')).toEqual({
      data: {
        input: {
          prompt: 'hello'
        }
      }
    });
  });

  it('JSON 语法错误时应返回可展示的错误文案', () => {
    expect(parseSessionInputText('{')).toEqual({
      error: '消息输入不是有效的 JSON。'
    });
  });

  it('非对象 JSON 应被拒绝', () => {
    expect(parseSessionInputText('[]')).toEqual({
      error: '消息输入必须是 JSON 对象。'
    });
  });
});
