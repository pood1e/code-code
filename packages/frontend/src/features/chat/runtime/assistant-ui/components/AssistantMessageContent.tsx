import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import type { ToolCallKind } from '@agent-workbench/shared';

import { cn } from '@/lib/utils';

import { InlineCollapsibleBlock } from '../../components/InlineCollapsibleBlock';
import { buildToolView } from '../tool-view';

const CollapsibleReasoning = lazy(async () => {
  const module = await import('../../components/CollapsibleReasoning');
  return { default: module.CollapsibleReasoning };
});
const MarkdownRenderer = lazy(async () => {
  const module = await import('../../components/MarkdownRenderer');
  return { default: module.MarkdownRenderer };
});

export function AssistantTextPart({ text }: { text: string }) {
  return (
    <div className="max-w-[min(46rem,100%)] font-sans text-foreground/90">
      <Suspense
        fallback={<div className="whitespace-pre-wrap break-words">{text}</div>}
      >
        <MarkdownRenderer content={text} density="compact" collapsibleBlocks />
      </Suspense>
    </div>
  );
}

export function AssistantReasoningPart({ text }: { text: string }) {
  return (
    <Suspense
      fallback={
        <div className="max-w-[min(46rem,100%)] rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          正在加载推理内容...
        </div>
      }
    >
      <CollapsibleReasoning text={text} />
    </Suspense>
  );
}

export function AssistantToolPart({
  toolKind,
  toolName,
  args,
  result,
  isError
}: {
  toolKind: ToolCallKind;
  toolName: string;
  args: unknown;
  result?: unknown;
  isError?: boolean;
}) {
  const toolView = buildToolView(toolKind, toolName, args, result);
  const ToolIcon = toolView.icon;

  return (
    <InlineCollapsibleBlock
      expandedLabel={toolView.label}
      summary={toolView.summary ?? toolView.label}
      icon={
        <ToolIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            isError ? 'text-destructive/80' : undefined
          )}
        />
      }
      widthClassName="mb-1 inline-block max-w-full align-top"
      bodyClassName="mb-2 max-w-[min(42rem,100%)] space-y-2"
      action={
        isError ? (
          <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
            失败
          </span>
        ) : undefined
      }
    >
      {toolView.details.map((detail) => (
        <ToolDetailBlock
          key={`${toolView.label}-${detail.label}`}
          label={detail.label}
          value={detail.value}
        />
      ))}
      {toolView.terminalOutput ? (
        <ToolTerminalOutput value={toolView.terminalOutput} />
      ) : null}
      {toolView.rawBlocks.map((detail) => (
        <ToolDetailBlock
          key={`${toolView.label}-${detail.label}`}
          label={detail.label}
          value={detail.value}
          tone="subtle"
        />
      ))}
    </InlineCollapsibleBlock>
  );
}

function ToolDetailBlock({
  label,
  value,
  tone = 'default'
}: {
  label: string;
  value: string;
  tone?: 'default' | 'subtle';
}) {
  return (
    <div className="max-w-full">
      <ToolSectionLabel>{label}</ToolSectionLabel>
      <pre
        className={cn(
          'max-w-full overflow-x-auto whitespace-pre-wrap rounded p-2 text-[11px]',
          tone === 'subtle'
            ? 'border border-border/40 bg-muted/15 text-foreground/60'
            : 'bg-muted/30 text-foreground/70'
        )}
      >
        {value}
      </pre>
    </div>
  );
}

function ToolTerminalOutput({ value }: { value: string }) {
  return (
    <div className="max-w-full">
      <ToolSectionLabel>输出</ToolSectionLabel>
      <pre className="max-w-full overflow-x-auto rounded-md border border-border/60 bg-card px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/80">
        {value}
      </pre>
    </div>
  );
}

function ToolSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-0.5 text-[10px] font-medium text-muted-foreground/55">
      {children}
    </p>
  );
}

export function AssistantEmptyPart({ status }: { status: { type: string } }) {
  if (status.type !== 'running') {
    return null;
  }

  return (
    <div className="flex items-center py-2 text-muted-foreground/50">
      <Loader2 className="size-4 animate-spin" />
    </div>
  );
}
