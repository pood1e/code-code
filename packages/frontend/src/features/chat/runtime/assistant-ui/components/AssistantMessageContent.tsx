import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { Badge } from '@/components/ui/badge';
import { CollapsibleReasoning } from '../../components/CollapsibleReasoning';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import { stringifyValue } from '../context';

export function AssistantTextPart({ text }: { text: string }) {
  return (
    <div className="w-full font-sans text-foreground/90">
      <MarkdownRenderer content={text} />
    </div>
  );
}

export function AssistantReasoningPart({ text }: { text: string }) {
  return <CollapsibleReasoning text={text} />;
}

export function AssistantToolPart({
  toolName,
  toolCallId,
  args,
  result,
  isError
}: ToolCallMessagePartProps) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Tool Use
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{toolName}</p>
        </div>
        {toolCallId ? (
          <span className="text-xs text-muted-foreground">{toolCallId}</span>
        ) : null}
      </div>

      <div className="mt-3 space-y-3 text-xs text-foreground">
        <div>
          <p className="mb-1 font-medium text-muted-foreground">Args</p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background/80 p-2">
            {stringifyValue(args)}
          </pre>
        </div>
        {result != null ? (
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Result</p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background/80 p-2">
              {stringifyValue(result)}
            </pre>
          </div>
        ) : null}
        {isError ? (
          <Badge variant="destructive" className="rounded-md">
            Tool Error
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

export function AssistantEmptyPart({
  status
}: {
  status: { type: string };
}) {
  if (status.type !== 'running') {
    return null;
  }

  return (
    <p className="text-sm leading-6 text-muted-foreground">等待输出...</p>
  );
}
