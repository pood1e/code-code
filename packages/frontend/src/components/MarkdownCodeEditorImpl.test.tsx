import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MarkdownCodeEditorImpl from './MarkdownCodeEditorImpl';

const codeMirrorEditorMock = vi.hoisted(() => ({
  component: vi.fn(() => <div data-testid="markdown-editor" />)
}));

const markdownLanguageMock = vi.hoisted(() => ({
  markdown: vi.fn(() => ({ language: 'markdown' }))
}));

vi.mock('./CodeMirrorEditor', () => ({
  CodeMirrorEditor: codeMirrorEditorMock.component
}));

vi.mock('@codemirror/lang-markdown', () => ({
  markdown: markdownLanguageMock.markdown
}));

describe('MarkdownCodeEditorImpl', () => {
  it('应以 markdown 扩展包装 CodeMirrorEditor', () => {
    const onChange = vi.fn();
    render(
      <MarkdownCodeEditorImpl value='# Title' onChange={onChange} />
    );

    expect(markdownLanguageMock.markdown).toHaveBeenCalledTimes(1);
    expect(codeMirrorEditorMock.component).toHaveBeenCalledWith(
      expect.objectContaining({
        value: '# Title',
        onChange,
        readOnly: false,
        extensions: [{ language: 'markdown' }]
      }),
      undefined
    );
  });
});
