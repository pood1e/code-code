import { lazy, Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

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
        <div className="space-y-3 rounded-2xl border border-border/40 bg-background/70 p-4">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-56 rounded-2xl" />
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
