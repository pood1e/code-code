import { useMemo } from 'react';
import { json } from '@codemirror/lang-json';

import { CodeMirrorEditor } from './CodeMirrorEditor';

type JsonCodeEditorImplProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

export default function JsonCodeEditorImpl({
  value,
  onChange,
  readOnly = false
}: JsonCodeEditorImplProps) {
  const extensions = useMemo(() => [json()], []);

  return (
    <CodeMirrorEditor
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      extensions={extensions}
    />
  );
}
