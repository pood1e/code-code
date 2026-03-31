import { lazy, Suspense } from 'react';
import { Skeleton } from 'antd';

const JsonEditorImpl = lazy(() => import('./JsonEditorImpl'));

export type EditorMode = 'json' | 'markdown';

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  mode?: EditorMode;
};

export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="json-editor-fallback">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      }
    >
      <JsonEditorImpl {...props} />
    </Suspense>
  );
}

export function JsonEditor(props: Omit<CodeEditorProps, 'mode'>) {
  return <CodeEditor {...props} mode="json" />;
}
