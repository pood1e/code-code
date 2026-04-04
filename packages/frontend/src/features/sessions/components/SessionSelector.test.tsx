import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionStatus } from '@agent-workbench/shared';

import { SessionSelector } from './SessionSelector';

const sessions = [
  {
    id: 'session-1',
    runnerId: 'runner-1',
    runnerType: 'mock',
    updatedAt: '2026-04-03T10:00:00.000Z',
    status: SessionStatus.Ready
  },
  {
    id: 'session-2',
    runnerId: 'runner-2',
    runnerType: 'mock',
    updatedAt: '2026-04-03T11:00:00.000Z',
    status: SessionStatus.Running
  }
];

describe('SessionSelector', () => {
  it('应展示当前会话名称并支持切换到其他会话', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <SessionSelector
        sessions={sessions}
        selectedSessionId="session-1"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': '备用会话'
        }}
        onSelect={onSelect}
        onDispose={vi.fn()}
        disposingSessionId={null}
      />
    );

    await user.click(screen.getByRole('button', { name: '主会话' }));
    await user.click(screen.getByRole('button', { name: /^备用会话/ }));

    expect(onSelect).toHaveBeenCalledWith('session-2');
    expect(
      screen.queryByRole('button', { name: /^备用会话/ })
    ).not.toBeInTheDocument();
  });

  it('未选中会话时应展示 placeholder', () => {
    render(
      <SessionSelector
        sessions={sessions}
        selectedSessionId={null}
        placeholder="新建会话"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': '备用会话'
        }}
        onSelect={vi.fn()}
        onDispose={vi.fn()}
        disposingSessionId={null}
      />
    );

    expect(
      screen.getByRole('button', { name: /新建会话/ })
    ).toBeInTheDocument();
  });

  it('点击删除按钮应只触发删除回调，不应触发切换会话', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onDispose = vi.fn();

    render(
      <SessionSelector
        sessions={sessions}
        selectedSessionId="session-1"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': '备用会话'
        }}
        onSelect={onSelect}
        onDispose={onDispose}
        disposingSessionId={null}
      />
    );

    await user.click(screen.getByRole('button', { name: '主会话' }));
    await user.click(screen.getByRole('button', { name: '删除会话 备用会话' }));

    expect(onDispose).toHaveBeenCalledWith('session-2');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('正在销毁中的会话删除按钮应禁用', async () => {
    const user = userEvent.setup();

    render(
      <SessionSelector
        sessions={sessions}
        selectedSessionId="session-1"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': '备用会话'
        }}
        onSelect={vi.fn()}
        onDispose={vi.fn()}
        disposingSessionId="session-2"
      />
    );

    await user.click(screen.getByRole('button', { name: '主会话' }));

    expect(
      screen.getByRole('button', { name: '删除会话 备用会话' })
    ).toBeDisabled();
  });
});
