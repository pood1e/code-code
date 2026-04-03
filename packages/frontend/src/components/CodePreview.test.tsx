import type { ComponentPropsWithoutRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodePreview } from './CodePreview';

vi.mock('lucide-react', () => ({
  Check: () => <span>check</span>,
  Copy: () => <span>copy</span>
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  )
}));

describe('CodePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      },
      configurable: true
    });
  });

  it('应展示模式标签和原始内容', () => {
    render(<CodePreview value={'{"ok":true}'} mode="json" />);

    expect(screen.getByText('json')).toBeInTheDocument();
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
  });

  it('markdown 模式下应展示复制按钮和原始文本', () => {
    render(<CodePreview value={'# hello'} mode="markdown" />);

    expect(screen.getByText('markdown')).toBeInTheDocument();
    expect(screen.getByText('# hello')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /复制内容/ })
    ).toBeInTheDocument();
  });

  it('复制成功后应写入剪贴板，并短暂显示成功状态', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    render(<CodePreview value={'{"ok":true}'} mode="json" />);

    expect(screen.getByText('copy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /复制内容/ }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"ok":true}');
    await waitFor(() => {
      expect(screen.getByText('check')).toBeInTheDocument();
    });
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
  });
});
