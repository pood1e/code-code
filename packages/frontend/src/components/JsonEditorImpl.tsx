import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';

type JsonEditorImplProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  mode?: 'json' | 'markdown';
};

export default function JsonEditorImpl({
  value,
  onChange,
  readOnly = false,
  mode = 'json'
}: JsonEditorImplProps) {
  const extensions = useMemo(
    () => (mode === 'markdown' ? [markdown()] : [json()]),
    [mode]
  );

  return (
    <div className="editor-shell overflow-hidden rounded-2xl border border-border/40 bg-background/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        editable={!readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false
        }}
      />
    </div>
  );
}
