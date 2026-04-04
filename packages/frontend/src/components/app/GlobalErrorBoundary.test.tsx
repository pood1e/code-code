import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalErrorBoundary } from './GlobalErrorBoundary';

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <span aria-hidden="true">alert-icon</span>,
  RefreshCw: () => <span aria-hidden="true">refresh-icon</span>
}));

let shouldThrow = false;

function CrashWhenRequested() {
  if (shouldThrow) {
    throw new Error('Boom');
  }

  return <div>safe content</div>;
}

describe('GlobalErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = false;
    vi.restoreAllMocks();
  });

  it('无错误时应渲染 children', () => {
    render(
      <GlobalErrorBoundary>
        <div>normal content</div>
      </GlobalErrorBoundary>
    );

    expect(screen.getByText('normal content')).toBeInTheDocument();
  });

  it('捕获错误后应展示错误态，并支持 retry 恢复', async () => {
    shouldThrow = true;
    const user = userEvent.setup();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(
      <GlobalErrorBoundary>
        <CrashWhenRequested />
      </GlobalErrorBoundary>,
      {
        onCaughtError: () => undefined,
        onRecoverableError: () => undefined
      }
    );

    expect(
      screen.getByRole('heading', { name: 'Something went wrong' })
    ).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();

    shouldThrow = false;

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('safe content')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('点击 Reload page 应刷新页面', async () => {
    shouldThrow = true;
    const user = userEvent.setup();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const reloadSpy = vi.fn();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadSpy
      }
    });

    render(
      <GlobalErrorBoundary>
        <CrashWhenRequested />
      </GlobalErrorBoundary>
    );

    await user.click(screen.getByRole('button', { name: 'Reload page' }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
