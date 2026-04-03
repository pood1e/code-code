import { useMemo } from 'react';
import { markdown } from '@codemirror/lang-markdown';

import { CodeMirrorEditor } from './CodeMirrorEditor';

type MarkdownCodeEditorImplProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

export default function MarkdownCodeEditorImpl({
  value,
  onChange,
  readOnly = false
}: MarkdownCodeEditorImplProps) {
  const extensions = useMemo(() => [markdown()], []);

  return (
    <CodeMirrorEditor
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      extensions={extensions}
    />
  );
}
