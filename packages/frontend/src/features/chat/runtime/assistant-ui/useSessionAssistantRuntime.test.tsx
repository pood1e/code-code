import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MessageRole,
  MessageStatus,
  SessionStatus,
  type SessionMessageDetail
} from '@agent-workbench/shared';

import { useSessionAssistantRuntime } from './useSessionAssistantRuntime';
import type { SessionAssistantMessageRecord } from './thread-adapter';

type RuntimeStoreSnapshot = {
  messages: SessionAssistantMessageRecord[];
  isLoading: boolean;
  isRunning: boolean;
  isDisabled: boolean;
  onNew: (message: unknown) => Promise<void>;
  onCancel?: () => Promise<void>;
  onReload?: () => Promise<void>;
  onEdit?: (message: unknown) => Promise<void>;
  convertMessage: unknown;
  unstable_capabilities: {
    copy: boolean;
  };
};

const runtimeStoreMock = vi.hoisted(() => ({
  current: undefined as RuntimeStoreSnapshot | undefined
}));

const assistantUiMock = vi.hoisted(() => ({
  useExternalStoreRuntime: vi.fn((store: RuntimeStoreSnapshot) => {
    runtimeStoreMock.current = store;
    return { kind: 'runtime' };
  })
}));

const messageConverterMock = vi.hoisted(() => ({
  convertSessionMessageRecord: vi.fn(),
  getComposerText: vi.fn(() => '提取后的内容')
}));

vi.mock('@assistant-ui/react', () => ({
  useExternalStoreRuntime: assistantUiMock.useExternalStoreRuntime
}));

vi.mock('./message-converters', () => ({
  convertSessionMessageRecord: messageConverterMock.convertSessionMessageRecord,
  getComposerText: messageConverterMock.getComposerText
}));

function createRecord(): SessionAssistantMessageRecord {
  const message: SessionMessageDetail = {
    id: 'message-1',
    sessionId: 'session-1',
    role: MessageRole.User,
    status: MessageStatus.Complete,
    inputContent: { prompt: 'hello' },
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: 1,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T10:00:00.000Z'
  };

  return {
    message,
    runtime: undefined
  };
}

describe('useSessionAssistantRuntime', () => {
  beforeEach(() => {
    runtimeStoreMock.current = undefined;
    assistantUiMock.useExternalStoreRuntime.mockClear();
    messageConverterMock.getComposerText.mockClear();
  });

  it('应把 session 状态桥接成 assistant runtime store，并转发发送/重跑/取消/编辑能力', async () => {
    const onNew = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn().mockResolvedValue(undefined);
    const onReload = vi.fn().mockResolvedValue(undefined);
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const messages = [createRecord()];
    const appendMessage = {
      role: 'user',
      content: [{ type: 'text', text: '原始内容' }],
      sourceId: 'message-1'
    } as never;

    renderHook(() =>
      useSessionAssistantRuntime({
        messages,
        messagesReady: true,
        status: SessionStatus.Running,
        onNew,
        onCancel,
        onReload,
        onEdit
      })
    );

    expect(assistantUiMock.useExternalStoreRuntime).toHaveBeenCalledTimes(1);
    expect(runtimeStoreMock.current?.messages).toBe(messages);
    expect(runtimeStoreMock.current?.isLoading).toBe(false);
    expect(runtimeStoreMock.current?.isRunning).toBe(true);
    expect(runtimeStoreMock.current?.isDisabled).toBe(false);
    expect(runtimeStoreMock.current?.convertMessage).toBe(
      messageConverterMock.convertSessionMessageRecord
    );
    expect(runtimeStoreMock.current?.unstable_capabilities).toEqual({
      copy: true
    });

    await runtimeStoreMock.current?.onNew(appendMessage);
    expect(messageConverterMock.getComposerText).toHaveBeenCalledWith(
      appendMessage
    );
    expect(onNew).toHaveBeenCalledWith('提取后的内容', appendMessage);

    await runtimeStoreMock.current?.onReload?.();
    expect(onReload).toHaveBeenCalledTimes(1);

    await runtimeStoreMock.current?.onCancel?.();
    expect(onCancel).toHaveBeenCalledTimes(1);

    await runtimeStoreMock.current?.onEdit?.(appendMessage);
    expect(onEdit).toHaveBeenCalledWith(
      'message-1',
      '提取后的内容',
      appendMessage
    );
  });

  it('消息未就绪或 session 不可交互时，应禁用输入并标记 loading', () => {
    renderHook(() =>
      useSessionAssistantRuntime({
        messages: [createRecord()],
        messagesReady: false,
        status: SessionStatus.Creating,
        onNew: vi.fn().mockResolvedValue(undefined)
      })
    );

    expect(runtimeStoreMock.current?.isLoading).toBe(true);
    expect(runtimeStoreMock.current?.isRunning).toBe(false);
    expect(runtimeStoreMock.current?.isDisabled).toBe(true);
    expect(runtimeStoreMock.current?.onReload).toBeUndefined();
    expect(runtimeStoreMock.current?.onEdit).toBeUndefined();
  });

  it('编辑消息缺少 sourceId 时，应抛出明确错误', async () => {
    renderHook(() =>
      useSessionAssistantRuntime({
        messages: [createRecord()],
        messagesReady: true,
        status: SessionStatus.Ready,
        onNew: vi.fn().mockResolvedValue(undefined),
        onEdit: vi.fn().mockResolvedValue(undefined)
      })
    );

    await expect(
      runtimeStoreMock.current?.onEdit?.({
        role: 'user',
        content: [{ type: 'text', text: '没有 sourceId' }]
      } as never)
    ).rejects.toThrow('Edited message is missing sourceId');
  });
});
