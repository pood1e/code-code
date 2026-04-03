import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageStatus } from '@agent-workbench/shared';

import {
  formatDomainMessageStatus,
  stringifyValue,
  ThreadConfigContext
} from './context';

describe('assistant thread context helpers', () => {
  it('formatDomainMessageStatus 应只为错误消息返回中文状态', () => {
    expect(formatDomainMessageStatus(MessageStatus.Error)).toBe('异常');
    expect(formatDomainMessageStatus(MessageStatus.Sent)).toBeNull();
    expect(formatDomainMessageStatus(MessageStatus.Streaming)).toBeNull();
    expect(formatDomainMessageStatus(MessageStatus.Complete)).toBeNull();
  });

  it('stringifyValue 应按用户可读方式序列化常见值', () => {
    expect(stringifyValue(null)).toBe('');
    expect(stringifyValue('plain text')).toBe('plain text');
    expect(stringifyValue({ ok: true })).toBe('{\n  "ok": true\n}');
    expect(stringifyValue(new Error('boom'))).toBe('boom');
  });

  it('stringifyValue 遇到不可 JSON 化对象时，应回退到错误消息或对象标签', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(stringifyValue(circular)).toBe('[object Object]');

    expect(
      stringifyValue({
        toJSON() {
          throw new Error('cannot stringify');
        }
      })
    ).toBe('[object Object]');
  });

  it('ThreadConfigContext 默认值和 provider 值都应可被消费', () => {
    function Consumer() {
      const value = React.useContext(ThreadConfigContext);
      return <p>{value.assistantName ?? 'default-assistant'}</p>;
    }

    const { rerender } = render(<Consumer />);
    expect(screen.getByText('default-assistant')).toBeInTheDocument();

    rerender(
      <ThreadConfigContext.Provider value={{ assistantName: 'Qwen' }}>
        <Consumer />
      </ThreadConfigContext.Provider>
    );

    expect(screen.getByText('Qwen')).toBeInTheDocument();
  });
});
