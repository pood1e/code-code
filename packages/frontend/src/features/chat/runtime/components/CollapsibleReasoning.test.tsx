import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CollapsibleReasoning } from './CollapsibleReasoning';

vi.mock('./MarkdownRenderer', () => ({
  MarkdownRenderer: ({
    content,
    className
  }: {
    content: string;
    className?: string;
  }) => (
    <div data-testid="reasoning-markdown" data-class-name={className}>
      {content}
    </div>
  )
}));

describe('CollapsibleReasoning', () => {
  it('默认折叠，点击思考过程后应展开推理内容', async () => {
    const user = userEvent.setup();
    render(<CollapsibleReasoning text="详细推理" />);

    const toggle = screen.getByRole('button', { name: '思考过程：Thinking' });
    const container = toggle.parentElement?.parentElement?.querySelector('div.grid');

    expect(screen.getByTestId('reasoning-markdown')).toHaveTextContent('详细推理');
    expect(container).toHaveClass('grid-rows-[0fr]', 'opacity-0');

    await user.click(toggle);

    expect(container).toHaveClass('grid-rows-[1fr]', 'opacity-100', 'mt-1');
    expect(screen.getByTestId('reasoning-markdown')).toHaveAttribute(
      'data-class-name',
      expect.stringContaining('prose-sm')
    );
  });
});
