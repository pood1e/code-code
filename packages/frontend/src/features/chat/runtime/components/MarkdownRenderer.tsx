import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { createMarkdownComponents } from './markdown-renderer.components';

const remarkPlugins = [remarkGfm];

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
        components={createMarkdownComponents({
          collapsibleBlocks,
          density,
          isDark
        })}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
