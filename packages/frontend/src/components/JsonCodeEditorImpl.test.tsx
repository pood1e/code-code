import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import JsonCodeEditorImpl from './JsonCodeEditorImpl';

const codeMirrorEditorMock = vi.hoisted(() => ({
  component: vi.fn(() => <div data-testid="json-editor" />)
}));

const jsonLanguageMock = vi.hoisted(() => ({
  json: vi.fn(() => ({ language: 'json' }))
}));

vi.mock('./CodeMirrorEditor', () => ({
  CodeMirrorEditor: codeMirrorEditorMock.component
}));

vi.mock('@codemirror/lang-json', () => ({
  json: jsonLanguageMock.json
}));

describe('JsonCodeEditorImpl', () => {
  it('应以 json 扩展包装 CodeMirrorEditor', () => {
    const onChange = vi.fn();
    render(
      <JsonCodeEditorImpl value='{"hello":"world"}' onChange={onChange} readOnly />
    );

    expect(jsonLanguageMock.json).toHaveBeenCalledTimes(1);
    expect(codeMirrorEditorMock.component).toHaveBeenCalledWith(
      expect.objectContaining({
        value: '{"hello":"world"}',
        onChange,
        readOnly: true,
        extensions: [{ language: 'json' }]
      }),
      undefined
    );
  });
});
