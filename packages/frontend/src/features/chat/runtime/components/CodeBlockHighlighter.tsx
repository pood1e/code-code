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
import { cn } from '@/lib/utils';
import { InlineCollapsibleBlock } from './InlineCollapsibleBlock';

let languagesRegistered = false;

function registerLanguages() {
  if (languagesRegistered) {
    return;
  }

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
  const [isCopied, setIsCopied] = React.useState(false);
  const resetTimerRef = React.useRef<number | null>(null);
  const isCompact = density === 'compact';

  registerLanguages();

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setIsCopied(false);
        resetTimerRef.current = null;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy text: ', error);
    }
  };

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
      widthClassName={isCompact ? 'my-2' : 'my-4'}
      bodyClassName="ml-0 border-l-0 py-0 pl-0"
      action={
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            isCompact ? 'h-5 w-5' : 'h-6 w-6'
          )}
          onClick={() => void copyToClipboard()}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span className="sr-only">{isCopied ? '已复制代码' : '复制代码'}</span>
        </Button>
      }
    >
      <div
        className={cn(
          'overflow-x-auto border border-border bg-card text-foreground/90 [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-0 focus-visible:outline-none',
          isCompact ? 'rounded-md p-3 text-[13px]' : 'rounded-lg p-4 text-sm'
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
