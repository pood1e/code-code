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
  const extensions = mode === 'markdown' ? [markdown()] : [json()];

  return (
    <div className="editor-shell">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        editable={!readOnly}
      />
    </div>
  );
}
