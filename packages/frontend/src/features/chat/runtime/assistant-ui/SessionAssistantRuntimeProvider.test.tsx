import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionStatus } from '@agent-workbench/shared';

import { SessionAssistantRuntimeProvider } from './SessionAssistantRuntimeProvider';
import type { SessionAssistantMessageRecord } from './thread-adapter';

const runtimeMock = vi.hoisted(() => ({
  runtime: { kind: 'session-runtime' },
  useSessionAssistantRuntime: vi.fn(() => ({ kind: 'session-runtime' })),
  AssistantRuntimeProvider: vi.fn(
    ({
      runtime,
      children
    }: {
      runtime: { kind: string };
      children: React.ReactNode;
    }) => (
      <div data-runtime={runtime.kind}>
        <span>provider-mounted</span>
        {children}
      </div>
    )
  )
}));

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: runtimeMock.AssistantRuntimeProvider
}));

vi.mock('./useSessionAssistantRuntime', () => ({
  useSessionAssistantRuntime: runtimeMock.useSessionAssistantRuntime
}));

describe('SessionAssistantRuntimeProvider', () => {
  it('应创建 session runtime，并交给 AssistantRuntimeProvider 包裹子节点', () => {
    const onNew = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn().mockResolvedValue(undefined);
    const onReload = vi.fn().mockResolvedValue(undefined);
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const messages: SessionAssistantMessageRecord[] = [];

    render(
      <SessionAssistantRuntimeProvider
        messages={messages}
        messagesReady
        status={SessionStatus.Ready}
        onNew={onNew}
        onCancel={onCancel}
        onReload={onReload}
        onEdit={onEdit}
      >
        <div>thread-body</div>
      </SessionAssistantRuntimeProvider>
    );

    expect(runtimeMock.useSessionAssistantRuntime).toHaveBeenCalledWith({
      messages,
      messagesReady: true,
      status: SessionStatus.Ready,
      onNew,
      onCancel,
      onReload,
      onEdit
    });
    expect(runtimeMock.AssistantRuntimeProvider).toHaveBeenCalled();
    expect(screen.getByText('provider-mounted')).toBeInTheDocument();
    expect(screen.getByText('thread-body')).toBeInTheDocument();
    expect(screen.getByText('provider-mounted').parentElement).toHaveAttribute(
      'data-runtime',
      'session-runtime'
    );
  });
});
