import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MarkdownRenderer } from './MarkdownRenderer';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'light'
  })
}));

describe('MarkdownRenderer', () => {
  it('应渲染普通 markdown 内容而不依赖代码高亮块', () => {
    render(
      <MarkdownRenderer content={'普通段落，包含 `inline code` 和 [链接](https://example.com)'} />
    );

    expect(
      screen.getByText((_, element) =>
        element?.tagName === 'P' &&
        (element.textContent?.includes('普通段落，包含') ?? false)
      )
    ).toBeInTheDocument();
    expect(screen.getByText('inline code')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '链接' })).toHaveAttribute(
      'href',
      'https://example.com'
    );
  });

  it('应渲染 fenced code block，并在异步高亮模块就绪后展示代码块操作', async () => {
    render(
      <MarkdownRenderer
        content={'```ts\nconst answer = 42;\nconsole.log(answer);\n```'}
      />
    );

    expect(await screen.findByText('ts')).toBeInTheDocument();
    expect(await screen.findByText(/const answer = 42;/)).toBeInTheDocument();
    expect(screen.getByText(/console\.log\(answer\);/)).toBeInTheDocument();
  });

  it('未声明语言的 fenced code block 也应按代码块渲染，而不是退化成 inline code', async () => {
    render(
      <MarkdownRenderer content={'```\nplain code block\nsecond line\n```'} />
    );

    expect(await screen.findByText('text')).toBeInTheDocument();
    expect(await screen.findByText(/plain code block/)).toBeInTheDocument();
    expect(
      screen.queryByText((_, element) => element?.tagName === 'CODE')
    ).not.toBeInTheDocument();
  });

  it('应按表格语义和外链安全属性渲染 gfm 内容', () => {
    render(
      <MarkdownRenderer
        content={
          '| 列1 | 列2 |\n| --- | --- |\n| A | B |\n\n[外链](https://example.com)'
        }
      />
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '列1' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '列2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'B' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '外链' })).toHaveAttribute(
      'target',
      '_blank'
    );
    expect(screen.getByRole('link', { name: '外链' })).toHaveAttribute(
      'rel',
      'noreferrer'
    );
  });

  it('compact 模式应收紧段落和代码块密度，用于 chat 展示', async () => {
    render(
      <MarkdownRenderer
        density="compact"
        collapsibleBlocks
        content={'第一段\n\n第二段\n\n```ts\nconst answer = 42;\n```'}
      />
    );

    const container = screen.getByText('第一段').closest('div');
    expect(container?.className).toContain('prose-p:my-1.5');
    expect(await screen.findByText('ts')).toBeInTheDocument();
  });

  it('compact 模式列表应局部折叠，而不是折叠整条 assistant 消息', async () => {
    const user = userEvent.setup();

    render(
      <MarkdownRenderer
        density="compact"
        collapsibleBlocks
        content={'开头说明\n\n- 第一项\n- 第二项\n- 第三项'}
      />
    );

    expect(screen.getByText('开头说明')).toBeInTheDocument();
    const toggle = screen.getByRole('button', {
      name: '列表：列表 · 第一项 等 3 项'
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('第一项')).toBeInTheDocument();
    expect(screen.getByText('第三项')).toBeInTheDocument();
  });

  it('compact 模式表格应局部折叠', async () => {
    const user = userEvent.setup();

    render(
      <MarkdownRenderer
        density="compact"
        collapsibleBlocks
        content={'| 列1 | 列2 |\n| --- | --- |\n| A | B |'}
      />
    );

    const toggle = screen.getByRole('button', { name: '表格：表格' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
