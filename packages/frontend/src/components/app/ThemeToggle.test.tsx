import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from './ThemeToggle';

const themeMock = vi.hoisted(() => ({
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: vi.fn()
}));

vi.mock('next-themes', () => ({
  useTheme: () => themeMock
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    themeMock.theme = 'system';
    themeMock.resolvedTheme = 'dark';
    themeMock.setTheme.mockReset();
  });

  it('应提供浅色、深色、跟随系统三个选项', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: '切换主题' }));

    expect(screen.getByRole('menuitemradio', { name: '浅色' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: '深色' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: '跟随系统' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitemradio', { name: '浅色' }));
    expect(themeMock.setTheme).toHaveBeenCalledWith('light');
  });

  it('当前为 system 时应保持 system 选中，而不是伪装成 light/dark', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: '切换主题' }));

    expect(screen.getByRole('menuitemradio', { name: '跟随系统' })).toHaveAttribute(
      'data-state',
      'checked'
    );
  });
});
