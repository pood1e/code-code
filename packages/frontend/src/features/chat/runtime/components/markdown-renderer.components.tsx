import React, { Suspense, lazy } from 'react';
import { Braces, ListTree, TableProperties } from 'lucide-react';
import type { Components } from 'react-markdown';

import { cn } from '@/lib/utils';

import { InlineCollapsibleBlock } from './InlineCollapsibleBlock';

const CodeBlockHighlighter = lazy(async () => {
  const module = await import('./CodeBlockHighlighter');
  return { default: module.CodeBlockHighlighter };
});

type MarkdownDensity = 'default' | 'compact';

type MarkdownComponentFactoryOptions = {
  collapsibleBlocks: boolean;
  density: MarkdownDensity;
  isDark: boolean;
};

type MarkdownCodeRendererProps = React.ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  node?: unknown;
};

export function createMarkdownComponents({
  collapsibleBlocks,
  density,
  isDark
}: MarkdownComponentFactoryOptions): Components {
  const isCompact = density === 'compact';
  const shouldCollapseStructuredBlocks = isCompact && collapsibleBlocks;

  return {
    code({
      inline,
      className,
      children,
      ...props
    }: MarkdownCodeRendererProps) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : 'text';
      const isInline = inline === true;
      const codeValue = getCodeBlockValue(children);

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
              value={codeValue}
              density={density}
              collapsibleBlocks={collapsibleBlocks}
            />
          }
        >
          <CodeBlockHighlighter
            language={language}
            value={codeValue}
            isDark={isDark}
            density={density}
            collapsible={collapsibleBlocks}
          />
        </Suspense>
      );
    },
    table({ children }) {
      if (shouldCollapseStructuredBlocks) {
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
      return renderListBlock({
        children,
        ordered: false,
        shouldCollapse: shouldCollapseStructuredBlocks
      });
    },
    ol({ children }) {
      return renderListBlock({
        children,
        ordered: true,
        shouldCollapse: shouldCollapseStructuredBlocks
      });
    },
    thead({ children }) {
      return <thead className="bg-muted/50 text-muted-foreground">{children}</thead>;
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
  };
}

function CodeBlockFallback({
  language,
  value,
  density,
  collapsibleBlocks
}: {
  language: string;
  value: string;
  density: MarkdownDensity;
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
        widthClassName="my-2 inline-block max-w-full align-top"
      >
        <div className="max-w-[min(46rem,100%)] overflow-x-auto rounded-md border border-border/60 bg-card/90">
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

function CollapsibleMarkdownBlock({
  label,
  summary,
  icon,
  widthClassName,
  children
}: {
  label: string;
  summary: string;
  icon: React.ReactNode;
  widthClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <InlineCollapsibleBlock
      expandedLabel={label}
      summary={summary}
      icon={icon}
      widthClassName={widthClassName ?? 'my-2'}
    >
      {children}
    </InlineCollapsibleBlock>
  );
}

function renderListBlock({
  children,
  ordered,
  shouldCollapse
}: {
  children: React.ReactNode;
  ordered: boolean;
  shouldCollapse: boolean;
}) {
  const listContent = ordered ? (
    <ol className="my-0 pl-5">{children}</ol>
  ) : (
    <ul className="my-0 pl-5">{children}</ul>
  );

  if (!shouldCollapse) {
    return ordered ? <ol>{children}</ol> : <ul>{children}</ul>;
  }

  return (
    <CollapsibleMarkdownBlock
      label="列表"
      summary={buildListSummary(children)}
      icon={<ListTree className="h-3.5 w-3.5 shrink-0" />}
    >
      {listContent}
    </CollapsibleMarkdownBlock>
  );
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

function countListItems(children: React.ReactNode) {
  return React.Children.toArray(children).filter((child) => {
    return React.isValidElement(child) && child.type === 'li';
  }).length;
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

function getCodeBlockValue(children: React.ReactNode) {
  return String(children).replace(/\n$/, '');
}
