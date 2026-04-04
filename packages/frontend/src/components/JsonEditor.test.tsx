import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CodeEditor, JsonEditor } from './JsonEditor';

describe('JsonEditor', () => {
  it('只读模式应展示轻量预览而不是交互式编辑器', () => {
    render(
      <CodeEditor
        value={'{"type":"stdio"}'}
        onChange={() => undefined}
        readOnly
      />
    );

    expect(screen.getByText('json')).toBeInTheDocument();
    expect(screen.getByText('{"type":"stdio"}')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制内容' })).toBeInTheDocument();
  });

  it('JsonEditor 默认应按 json 模式展示只读预览', () => {
    render(
      <JsonEditor
        value={'{"ok":true}'}
        onChange={() => undefined}
        readOnly
      />
    );

    expect(screen.getByText('json')).toBeInTheDocument();
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
  });
});
