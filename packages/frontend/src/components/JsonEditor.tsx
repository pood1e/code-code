import { lazy, Suspense } from 'react';

import { CodePreview } from '@/components/CodePreview';
import { Skeleton } from '@/components/ui/skeleton';

const JsonCodeEditorImpl = lazy(() => import('./JsonCodeEditorImpl'));
const MarkdownCodeEditorImpl = lazy(() => import('./MarkdownCodeEditorImpl'));

export type EditorMode = 'json' | 'markdown';

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  mode?: EditorMode;
};

export function CodeEditor(props: CodeEditorProps) {
  if (props.readOnly) {
    return <CodePreview value={props.value} mode={props.mode} />;
  }

  const EditorImpl =
    props.mode === 'markdown' ? MarkdownCodeEditorImpl : JsonCodeEditorImpl;

  return (
    <Suspense
      fallback={
        <div className="space-y-3 rounded-2xl border border-border/40 bg-background/70 p-4">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      }
    >
      <EditorImpl {...props} />
    </Suspense>
  );
}

export function JsonEditor(props: Omit<CodeEditorProps, 'mode'>) {
  return <CodeEditor {...props} mode="json" />;
}
