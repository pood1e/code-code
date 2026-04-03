import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  AssistantEmptyPart,
  AssistantReasoningPart,
  AssistantTextPart,
  AssistantToolPart
} from './AssistantMessageContent';

vi.mock('../../components/MarkdownRenderer', () => ({
  MarkdownRenderer: ({
    content,
    density
  }: {
    content: string;
    density?: string;
  }) => (
    <div data-testid="markdown" data-density={density}>
      {content}
    </div>
  )
}));

vi.mock('../../components/CollapsibleReasoning', () => ({
  CollapsibleReasoning: ({ text }: { text: string }) => (
    <div data-testid="reasoning">{text}</div>
  )
}));

describe('AssistantMessageContent', () => {
  it('文本 part 应渲染 markdown 内容', async () => {
    render(<AssistantTextPart text="第一段回答" />);

    expect(await screen.findByTestId('markdown')).toHaveTextContent(
      '第一段回答'
    );
    expect(screen.getByTestId('markdown')).toHaveAttribute(
      'data-density',
      'compact'
    );
  });

  it('thinking part 应渲染可折叠推理内容', async () => {
    render(<AssistantReasoningPart text="推理过程" />);

    expect(await screen.findByTestId('reasoning')).toHaveTextContent('推理过程');
  });

  it('tool part 展开后应展示参数和结果；无结果时不显示 Result 区块', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <AssistantToolPart
        toolKind="fallback"
        toolName="read_file"
        args={{ path: 'AGENTS.md' }}
        result={{ ok: true }}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /工具/
      })
    );

    expect(screen.getByText('原始参数')).toBeInTheDocument();
    expect(screen.getByText('原始结果')).toBeInTheDocument();
    expect(screen.getByText(/"path": "AGENTS\.md"/)).toBeInTheDocument();
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument();

    rerender(
      <AssistantToolPart
        toolKind="fallback"
        toolName="read_file"
        args={{ path: 'AGENTS.md' }}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /工具/
      })
    );

    expect(screen.getByText('原始参数')).toBeInTheDocument();
    expect(screen.queryByText('原始结果')).not.toBeInTheDocument();
  });

  it('shell tool part 应展示命令、退出码和输出', async () => {
    const user = userEvent.setup();

    render(
      <AssistantToolPart
        toolKind="shell"
        toolName="bash"
        args={{ command: 'ls -la' }}
        result={{ exitCode: 0, stdout: 'file-a\nfile-b' }}
      />
    );

    await user.click(screen.getByRole('button', { name: /Shell/ }));

    expect(screen.getByText('命令')).toBeInTheDocument();
    expect(screen.getByText('退出码')).toBeInTheDocument();
    expect(screen.getByText('输出')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shell/ })).toHaveAttribute(
      'title',
      'ls -la'
    );
    expect(screen.getAllByText('ls -la').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(
      screen.getByText((content, element) =>
        element?.tagName === 'PRE' && content.includes('file-a')
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('原始参数')).not.toBeInTheDocument();
    expect(screen.queryByText('原始结果')).not.toBeInTheDocument();
  });

  it('tool part 默认应先展示摘要，展开后再展示细节', async () => {
    const user = userEvent.setup();

    render(
      <AssistantToolPart
        toolKind="file_grep"
        toolName="grep"
        args={{ pattern: 'runtimeConfig', path: 'src' }}
        result={{ count: 3 }}
      />
    );

    const summaryButton = screen.getByRole('button', { name: /文件搜索/ });
    expect(summaryButton).toHaveAttribute(
      'title',
      'runtimeConfig · src'
    );
    expect(summaryButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(summaryButton);

    expect(summaryButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('查询')).toBeInTheDocument();
    expect(screen.getByText('范围')).toBeInTheDocument();
    expect(screen.getByText('命中')).toBeInTheDocument();
  });

  it('web search tool part 应展示查询和首个链接', async () => {
    const user = userEvent.setup();

    render(
      <AssistantToolPart
        toolKind="web_search"
        toolName="search"
        args={{ query: 'openai api' }}
        result={{
          results: [{ title: 'OpenAI API', url: 'https://platform.openai.com' }]
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /网页搜索/ }));

    expect(screen.getByText('查询')).toBeInTheDocument();
    expect(screen.getByText('结果数')).toBeInTheDocument();
    expect(screen.getByText('首个链接')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /网页搜索/ })).toHaveAttribute(
      'title',
      'openai api'
    );
    expect(screen.getAllByText('openai api').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('https://platform.openai.com')).toBeInTheDocument();
    expect(screen.queryByText('原始参数')).not.toBeInTheDocument();
    expect(screen.queryByText('原始结果')).not.toBeInTheDocument();
  });

  it('file diff tool part 应展示文件和变更', async () => {
    const user = userEvent.setup();

    render(
      <AssistantToolPart
        toolKind="file_diff"
        toolName="apply_patch"
        args={{ path: 'src/app.ts' }}
        result={{ diff: '@@ -1 +1 @@\n-old\n+new' }}
      />
    );

    await user.click(screen.getByRole('button', { name: /文件修改/ }));

    expect(screen.getByText('文件')).toBeInTheDocument();
    expect(screen.getByText('变更')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /文件修改/ })).toHaveAttribute(
      'title',
      'src/app.ts'
    );
    expect(screen.getAllByText('src/app.ts').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText((content, element) =>
        element?.tagName === 'PRE' && content.includes('@@ -1 +1 @@')
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('原始参数')).not.toBeInTheDocument();
    expect(screen.queryByText('原始结果')).not.toBeInTheDocument();
  });

  it('仅 running 状态应显示生成占位，其他状态不应渲染内容', () => {
    const { container, rerender } = render(
      <AssistantEmptyPart status={{ type: 'running' }} />
    );

    expect(container.firstChild).not.toBeNull();

    rerender(<AssistantEmptyPart status={{ type: 'idle' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
