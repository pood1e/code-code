import type { ComponentPropsWithoutRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const highlighterMock = vi.hoisted(() => {
  const registerLanguage = vi.fn();
  const PrismLight = Object.assign(
    ({
      language,
      children
    }: {
      language: string;
      children: string;
    }) => (
      <pre data-language={language}>
        <code>{children}</code>
      </pre>
    ),
    { registerLanguage }
  );

  return {
    registerLanguage,
    PrismLight
  };
});

vi.mock('react-syntax-highlighter', () => ({
  PrismLight: highlighterMock.PrismLight
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: { theme: 'dark' },
  oneLight: { theme: 'light' }
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/typescript', () => ({
  default: 'typescript'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/javascript', () => ({
  default: 'javascript'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/jsx', () => ({
  default: 'jsx'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/tsx', () => ({
  default: 'tsx'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/bash', () => ({
  default: 'bash'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/json', () => ({
  default: 'json'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/yaml', () => ({
  default: 'yaml'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/python', () => ({
  default: 'python'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/go', () => ({
  default: 'go'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/rust', () => ({
  default: 'rust'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/css', () => ({
  default: 'css'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/markdown', () => ({
  default: 'markdown'
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/sql', () => ({
  default: 'sql'
}));

vi.mock('lucide-react', () => ({
  Braces: () => <span aria-hidden="true">braces-icon</span>,
  ChevronRight: () => <span aria-hidden="true">chevron-icon</span>,
  Check: () => <span aria-hidden="true">check-icon</span>,
  Copy: () => <span aria-hidden="true">copy-icon</span>
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

import { CodeBlockHighlighter } from './CodeBlockHighlighter';

describe('CodeBlockHighlighter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应注册语言并展示代码内容与复制入口', () => {
    const { rerender } = render(
      <CodeBlockHighlighter
        language="ts"
        value={'const answer = 42;'}
        isDark={false}
        collapsible={false}
      />
    );

    expect(highlighterMock.registerLanguage).toHaveBeenCalledTimes(19);
    expect(screen.getByText('ts')).toBeInTheDocument();
    expect(screen.getByText('const answer = 42;')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '代码块：ts' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument();
    expect(screen.getByText('copy-icon')).toBeInTheDocument();

    rerender(
      <CodeBlockHighlighter
        language="ts"
        value={'const answer = 42;'}
        isDark
        collapsible={false}
      />
    );

    expect(highlighterMock.registerLanguage).toHaveBeenCalledTimes(19);
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument();
  });

  it('compact 模式代码块应默认折叠，展开后才显示代码和复制入口', async () => {
    const { user } = setupUser();

    render(
      <CodeBlockHighlighter
        language="ts"
        value={'const answer = 42;'}
        isDark={false}
        density="compact"
        collapsible
      />
    );

    const toggle = screen.getByRole('button', { name: '代码块：ts' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: '复制代码' })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('const answer = 42;')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument();
  });

  it('复制成功后应写入剪贴板，并短暂切换为成功状态', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    render(
      <CodeBlockHighlighter
        language="ts"
        value={'const answer = 42;'}
        isDark={false}
        collapsible={false}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '复制代码' }));
    });

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('const answer = 42;');
      expect(screen.getByText('check-icon')).toBeInTheDocument();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    });
  });

  it('复制失败时不应崩溃，并应记录错误', async () => {
    const clipboardError = new Error('copy failed');
    const writeText = vi.fn().mockRejectedValue(clipboardError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    render(
      <CodeBlockHighlighter
        language="ts"
        value={'const answer = 42;'}
        isDark={false}
        collapsible={false}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '复制代码' }));
    });

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('const answer = 42;');
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to copy text: ',
        clipboardError
      );
      expect(screen.getByText('copy-icon')).toBeInTheDocument();
    });
  });
});

function setupUser() {
  return {
    user: {
      click: async (element: HTMLElement) => {
        await act(async () => {
          fireEvent.click(element);
        });
      }
    }
  };
}
