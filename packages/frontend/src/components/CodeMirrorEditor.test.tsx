import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Extension } from '@codemirror/state';

import { CodeMirrorEditor } from './CodeMirrorEditor';

const codeMirrorMock = vi.hoisted(() => ({
  component: vi.fn(
    ({
      value,
      editable,
      extensions,
      basicSetup
    }: {
      value: string;
      editable: boolean;
      extensions: unknown[];
      basicSetup: Record<string, unknown>;
    }) => (
      <div data-testid="codemirror">
        <span>{value}</span>
        <span>{editable ? 'editable' : 'readonly'}</span>
        <span>{String(extensions.length)}</span>
        <span>{JSON.stringify(basicSetup)}</span>
      </div>
    )
  )
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: codeMirrorMock.component
}));

describe('CodeMirrorEditor', () => {
  it('应把 value、extensions 和 basicSetup 传给 CodeMirror', () => {
    const extensions = [{} as Extension];
    render(
      <CodeMirrorEditor
        value='{"ok":true}'
        onChange={() => undefined}
        extensions={extensions}
      />
    );

    expect(screen.getByTestId('codemirror')).toHaveTextContent('{"ok":true}');
    expect(screen.getByTestId('codemirror')).toHaveTextContent('editable');
    expect(codeMirrorMock.component).toHaveBeenCalledWith(
      expect.objectContaining({
        value: '{"ok":true}',
        editable: true,
        extensions,
        basicSetup: {
          lineNumbers: true,
          foldGutter: false
        }
      }),
      undefined
    );
  });

  it('readOnly 时应禁用编辑', () => {
    const extensions = [{} as Extension];
    render(
      <CodeMirrorEditor
        value="# heading"
        onChange={() => undefined}
        readOnly
        extensions={extensions}
      />
    );

    expect(screen.getByTestId('codemirror')).toHaveTextContent('readonly');
  });
});
