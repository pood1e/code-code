import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionStatus } from '@agent-workbench/shared';

import { SessionStatusBadge } from './SessionStatusBadge';

describe('SessionStatusBadge', () => {
  it.each([
    [SessionStatus.Creating, '创建中'],
    [SessionStatus.Ready, '就绪'],
    [SessionStatus.Running, '运行中'],
    [SessionStatus.Disposing, '销毁中'],
    [SessionStatus.Disposed, '已销毁'],
    [SessionStatus.Error, '异常']
  ])('应展示 %s 对应的中文状态文案', (status, label) => {
    render(<SessionStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
