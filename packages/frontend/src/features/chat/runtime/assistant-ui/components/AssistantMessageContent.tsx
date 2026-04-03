import React from 'react';
import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
  args,
  result,
  isError
}: ToolCallMessagePartProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none',
          isError ? 'text-destructive/80' : 'text-muted-foreground/60'
        )}
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 transition-transform duration-200',
            isOpen && 'rotate-90'
          )}
        />
        <span className="text-[11px] font-medium uppercase tracking-wider">
          Tool • {toolName}
        </span>
      </button>

      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out ml-1',
          isOpen
            ? 'grid-rows-[1fr] opacity-100 mt-1'
            : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="border-l-2 border-border/40 pl-3 py-1 mb-2 space-y-2">
            <div>
              <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                Args
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted/30 p-2 text-[11px] text-foreground/70">
                {stringifyValue(args)}
              </pre>
            </div>
            {result != null ? (
              <div>
                <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                  Result
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted/30 p-2 text-[11px] text-foreground/70">
                  {stringifyValue(result)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssistantEmptyPart({ status }: { status: { type: string } }) {
  if (status.type !== 'running') {
    return null;
  }

  return (
    <div className="flex items-center text-muted-foreground/50 py-2">
      <Loader2 className="size-4 animate-spin" />
    </div>
  );
}
