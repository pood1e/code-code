import React, { memo } from 'react';
import { Braces, Check, Copy } from 'lucide-react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight
} from 'react-syntax-highlighter/dist/esm/styles/prism';

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

import { Button } from '@/components/ui/button';
import { useClipboardCopy } from '@/hooks/use-clipboard-copy';
import { cn } from '@/lib/utils';
import { InlineCollapsibleBlock } from './InlineCollapsibleBlock';

let languagesRegistered = false;
const prismLanguages = [
  ['typescript', ts],
  ['ts', ts],
  ['javascript', js],
  ['js', js],
  ['jsx', jsx],
  ['tsx', tsx],
  ['bash', bash],
  ['sh', bash],
  ['json', json],
  ['yaml', yaml],
  ['yml', yaml],
  ['python', python],
  ['py', python],
  ['go', go],
  ['rust', rust],
  ['css', css],
  ['markdown', markdown],
  ['md', markdown],
  ['sql', sql]
] as const;

function registerLanguages() {
  if (languagesRegistered) {
    return;
  }

  for (const [name, definition] of prismLanguages) {
    SyntaxHighlighter.registerLanguage(name, definition);
  }

  languagesRegistered = true;
}

export const CodeBlockHighlighter = memo(function CodeBlockHighlighter({
  language,
  value,
  isDark,
  density = 'default',
  collapsible = false
}: {
  language: string;
  value: string;
  isDark: boolean;
  density?: 'default' | 'compact';
  collapsible?: boolean;
}) {
  const { copied, copy } = useClipboardCopy({
    onError(error) {
      console.error('Failed to copy text: ', error);
    }
  });
  const isCompact = density === 'compact';
  const copyLabel = copied ? '已复制代码' : '复制代码';
  const blockWidthClassName = cn(
    'inline-block max-w-full align-top',
    isCompact ? 'my-2' : 'my-3'
  );

  registerLanguages();

  return (
    <InlineCollapsibleBlock
      expandedLabel="代码块"
      summary={language}
      icon={
        <Braces
          className={cn(isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'shrink-0')}
        />
      }
      initiallyOpen={!collapsible}
      widthClassName={blockWidthClassName}
      bodyClassName="ml-0 max-w-[min(46rem,100%)] border-l-0 py-0 pl-0"
      action={
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            isCompact ? 'h-5 w-5' : 'h-6 w-6'
          )}
          aria-label={copyLabel}
          title={copyLabel}
          onClick={() => void copy(value)}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span className="sr-only">{copyLabel}</span>
        </Button>
      }
    >
      <div
        className={cn(
          'max-w-[min(46rem,100%)] overflow-x-auto border text-foreground/90 [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-0 focus-visible:outline-none',
          isCompact
            ? 'rounded-md border-border/60 bg-card/90 p-3 text-[13px] leading-6'
            : 'rounded-lg border-border/70 bg-card/95 p-4 text-sm leading-6'
        )}
      >
        <SyntaxHighlighter
          language={language}
          style={isDark ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            backgroundColor: 'transparent'
          }}
          wrapLines
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </InlineCollapsibleBlock>
  );
});
