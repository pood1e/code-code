import CodeMirror from '@uiw/react-codemirror';
import type { Extension } from '@codemirror/state';

export function CodeMirrorEditor({
  value,
  onChange,
  readOnly = false,
  extensions
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  extensions: Extension[];
}) {
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
