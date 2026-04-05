import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionStatus } from '@agent-workbench/shared';

import { SessionSelector } from './SessionSelector';

const sessions = [
  {
    id: 'session-1',
    title: null,
    runnerId: 'runner-1',
    runnerType: 'mock',
    updatedAt: '2026-04-03T10:00:00.000Z',
    status: SessionStatus.Ready
  },
  {
    id: 'session-2',
    title: '备用会话',
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
        selectedChatId="session-1"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': 'Runner 2'
        }}
        onSelect={onSelect}
        onDispose={vi.fn()}
        onRename={vi.fn()}
        disposingChatId={null}
        renamingChatId={null}
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
        selectedChatId={null}
        placeholder="新建会话"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': 'Runner 2'
        }}
        onSelect={vi.fn()}
        onDispose={vi.fn()}
        onRename={vi.fn()}
        disposingChatId={null}
        renamingChatId={null}
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
        selectedChatId="session-1"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': 'Runner 2'
        }}
        onSelect={onSelect}
        onDispose={onDispose}
        onRename={vi.fn()}
        disposingChatId={null}
        renamingChatId={null}
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
        selectedChatId="session-1"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': 'Runner 2'
        }}
        onSelect={vi.fn()}
        onDispose={vi.fn()}
        onRename={vi.fn()}
        disposingChatId="session-2"
        renamingChatId={null}
      />
    );

    await user.click(screen.getByRole('button', { name: '主会话' }));

    expect(
      screen.getByRole('button', { name: '删除会话 备用会话' })
    ).toBeDisabled();
  });

  it('应支持重命名 chat，且不触发切换', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRename = vi.fn().mockResolvedValue(undefined);

    render(
      <SessionSelector
        sessions={sessions}
        selectedChatId="session-1"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': 'Runner 2'
        }}
        onSelect={onSelect}
        onDispose={vi.fn()}
        onRename={onRename}
        disposingChatId={null}
        renamingChatId={null}
      />
    );

    await user.click(screen.getByRole('button', { name: '主会话' }));
    await user.click(screen.getByRole('button', { name: '重命名会话 备用会话' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '新的标题');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(onRename).toHaveBeenCalledWith('session-2', '新的标题');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('重命名输入留空时应清空自定义标题', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn().mockResolvedValue(undefined);

    render(
      <SessionSelector
        sessions={sessions}
        selectedChatId="session-1"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': 'Runner 2'
        }}
        onSelect={vi.fn()}
        onDispose={vi.fn()}
        onRename={onRename}
        disposingChatId={null}
        renamingChatId={null}
      />
    );

    await user.click(screen.getByRole('button', { name: '主会话' }));
    await user.click(screen.getByRole('button', { name: '重命名会话 备用会话' }));
    await user.clear(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(onRename).toHaveBeenCalledWith('session-2', null);
  });

  it('正在重命名中的 chat 不应允许再次打开重命名弹窗', async () => {
    const user = userEvent.setup();

    render(
      <SessionSelector
        sessions={sessions}
        selectedChatId="session-1"
        runnerNameById={{
          'runner-1': '主会话',
          'runner-2': 'Runner 2'
        }}
        onSelect={vi.fn()}
        onDispose={vi.fn()}
        onRename={vi.fn()}
        disposingChatId={null}
        renamingChatId="session-2"
      />
    );

    await user.click(screen.getByRole('button', { name: '主会话' }));

    expect(
      screen.getByRole('button', { name: '重命名会话 备用会话' })
    ).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
