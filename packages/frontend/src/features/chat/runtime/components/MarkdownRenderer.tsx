import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';

SyntaxHighlighter.registerLanguage('typescript', ts);
SyntaxHighlighter.registerLanguage('ts', ts);
SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('js', js);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('sql', sql);

const remarkPlugins = [remarkGfm];
import { useTheme } from 'next-themes';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className={cn(
        'prose prose-sm prose-slate dark:prose-invert max-w-none break-words',
        'prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent',
        'prose-code:font-geist-mono prose-code:before:content-none prose-code:after:content-none',
        'prose-headings:font-geist-sans prose-headings:font-semibold',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            const isInline = inline || !match;

            if (isInline) {
              return (
                <code
                  className={cn(
                    'bg-muted px-1.5 py-0.5 rounded-md text-sm font-medium',
                    className
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                language={language}
                value={String(children).replace(/\n$/, '')}
                isDark={isDark}
              />
            );
          },
          table({ children }) {
            return (
              <div className="my-4 w-full overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-muted/50 text-muted-foreground">{children}</thead>;
          },
          tr({ children }) {
            return <tr className="border-b last:border-b-0">{children}</tr>;
          },
          th({ children }) {
            return <th className="px-4 py-2 text-left font-semibold">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-2">{children}</td>;
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

const CodeBlock = memo(function CodeBlock({
  language,
  value,
  isDark
}: {
  language: string;
  value: string;
  isDark: boolean;
}) {
  const [isCopied, setIsCopied] = React.useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="relative my-4 flex flex-col overflow-hidden rounded-lg border bg-zinc-950 dark:bg-zinc-900 border-border">
      <div className="flex items-center justify-between bg-zinc-900 dark:bg-zinc-950 px-4 py-1.5 text-xs text-zinc-400">
        <span className="font-mono lowercase">{language}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-400 hover:text-zinc-100 transition-colors"
          onClick={() => void copyToClipboard()}
        >
          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="sr-only">Copy code</span>
        </Button>
      </div>
      <div className="overflow-x-auto p-4 text-sm [&>pre]:!m-0 [&>pre]:!p-0 [&>pre]:!bg-transparent focus-visible:outline-none">
        <SyntaxHighlighter
          language={language}
          style={isDark ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            backgroundColor: 'transparent'
          }}
          wrapLines={true}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});
