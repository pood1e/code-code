import React, { Suspense, lazy, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Braces, ListTree, TableProperties } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { InlineCollapsibleBlock } from './InlineCollapsibleBlock';

const remarkPlugins = [remarkGfm];
const CodeBlockHighlighter = lazy(async () => {
  const module = await import('./CodeBlockHighlighter');
  return { default: module.CodeBlockHighlighter };
});

function CodeBlockFallback({
  language,
  value,
  density,
  collapsibleBlocks
}: {
  language: string;
  value: string;
  density: 'default' | 'compact';
  collapsibleBlocks: boolean;
}) {
  const isCompact = density === 'compact';
  const fallbackBody = (
    <pre
      className={cn(
        'overflow-x-auto text-foreground/90',
        isCompact ? 'p-3 text-[13px]' : 'p-4 text-sm'
      )}
    >
      {value}
    </pre>
  );

  if (isCompact && collapsibleBlocks) {
    return (
      <CollapsibleMarkdownBlock
        label="代码块"
        summary={language}
        icon={<Braces className="h-3.5 w-3.5 shrink-0" />}
      >
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          {fallbackBody}
        </div>
      </CollapsibleMarkdownBlock>
    );
  }

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden border border-border bg-card',
        isCompact ? 'my-2 rounded-md' : 'my-4 rounded-lg'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b border-border/60 bg-muted/60 text-muted-foreground',
          isCompact ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-xs'
        )}
      >
        <span className="font-mono lowercase">{language}</span>
      </div>
      {fallbackBody}
    </div>
  );
}

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  density?: 'default' | 'compact';
  collapsibleBlocks?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  density = 'default',
  collapsibleBlocks = false
}: MarkdownRendererProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isCompact = density === 'compact';

  return (
    <div
      className={cn(
        'prose prose-sm prose-slate dark:prose-invert max-w-none break-words',
        'prose-pre:p-0 prose-pre:bg-transparent',
        'prose-code:font-geist-mono prose-code:before:content-none prose-code:after:content-none',
        'prose-headings:font-geist-sans prose-headings:font-semibold',
        isCompact
          ? 'prose-p:my-1.5 prose-p:leading-6 prose-ul:my-1.5 prose-ol:my-1.5 prose-ul:pl-5 prose-ol:pl-5 prose-li:my-0.5 prose-li:marker:text-muted-foreground/40 prose-pre:my-2 prose-table:my-2 prose-headings:my-2'
          : 'prose-p:leading-relaxed',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            const isInline = inline === true;

            if (isInline) {
              return (
                <code
                  className={cn(
                    'rounded bg-muted/60 px-1 py-0.5 text-[0.92em] font-medium text-foreground/80',
                    className
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <Suspense
                fallback={
                  <CodeBlockFallback
                    language={language}
                    value={String(children).replace(/\n$/, '')}
                    density={density}
                    collapsibleBlocks={collapsibleBlocks}
                  />
                }
              >
                <CodeBlockHighlighter
                  language={language}
                  value={String(children).replace(/\n$/, '')}
                  isDark={isDark}
                  density={density}
                  collapsible={collapsibleBlocks}
                />
              </Suspense>
            );
          },
          table({ children }) {
            if (isCompact && collapsibleBlocks) {
              return (
                <CollapsibleMarkdownBlock
                  label="表格"
                  summary="表格"
                  icon={<TableProperties className="h-3.5 w-3.5 shrink-0" />}
                >
                  <div className="w-full overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">{children}</table>
                  </div>
                </CollapsibleMarkdownBlock>
              );
            }

            return (
              <div
                className={cn(
                  'w-full overflow-x-auto border',
                  isCompact ? 'my-2 rounded-md' : 'my-4 rounded-lg'
                )}
              >
                <table className="w-full text-sm">{children}</table>
              </div>
            );
          },
          ul({ children }) {
            if (!isCompact || !collapsibleBlocks) {
              return <ul>{children}</ul>;
            }

            return (
              <CollapsibleMarkdownBlock
                label="列表"
                summary={buildListSummary(children)}
                icon={<ListTree className="h-3.5 w-3.5 shrink-0" />}
              >
                <ul className="my-0 pl-5">{children}</ul>
              </CollapsibleMarkdownBlock>
            );
          },
          ol({ children }) {
            if (!isCompact || !collapsibleBlocks) {
              return <ol>{children}</ol>;
            }

            return (
              <CollapsibleMarkdownBlock
                label="列表"
                summary={buildListSummary(children)}
                icon={<ListTree className="h-3.5 w-3.5 shrink-0" />}
              >
                <ol className="my-0 pl-5">{children}</ol>
              </CollapsibleMarkdownBlock>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-muted/50 text-muted-foreground">
                {children}
              </thead>
            );
          },
          tr({ children }) {
            return <tr className="border-b last:border-b-0">{children}</tr>;
          },
          th({ children }) {
            return (
              <th
                className={cn(
                  'text-left font-semibold',
                  isCompact ? 'px-3 py-1.5' : 'px-4 py-2'
                )}
              >
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className={cn(isCompact ? 'px-3 py-1.5' : 'px-4 py-2')}>
                {children}
              </td>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              >
                {children}
              </a>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function countListItems(children: React.ReactNode) {
  return React.Children.toArray(children).filter((child) => {
    return React.isValidElement(child) && child.type === 'li';
  }).length;
}

function buildListSummary(children: React.ReactNode) {
  const itemCount = countListItems(children);
  if (itemCount === 0) {
    return '列表';
  }

  const firstItem = React.Children.toArray(children).find((child) => {
    return React.isValidElement(child) && child.type === 'li';
  });
  const firstText =
    buildCompactSummary(
      React.isValidElement<{ children?: React.ReactNode }>(firstItem)
        ? getNodeText(firstItem.props.children)
        : '',
      20
    ) || '首项';

  if (itemCount === 1) {
    return `列表 · ${firstText}`;
  }

  return `列表 · ${firstText} 等 ${itemCount} 项`;
}

function getNodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).replace(/\s+/g, ' ').trim();
  }

  if (Array.isArray(node)) {
    return node
      .map((item) => getNodeText(item))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return '';
  }

  return getNodeText(node.props.children);
}

function buildCompactSummary(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function CollapsibleMarkdownBlock({
  label,
  summary,
  icon,
  children
}: {
  label: string;
  summary: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <InlineCollapsibleBlock
      expandedLabel={label}
      summary={summary}
      icon={icon}
      widthClassName="my-2"
    >
      {children}
    </InlineCollapsibleBlock>
  );
}
