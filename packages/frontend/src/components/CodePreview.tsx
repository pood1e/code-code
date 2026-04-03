import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function CodePreview({
  value,
  mode = 'json'
}: {
  value: string;
  mode?: 'json' | 'markdown';
}) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy preview text: ', error);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {mode}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void copyToClipboard()}
        >
          {isCopied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          <span className="sr-only">复制内容</span>
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
        {value}
      </pre>
    </div>
  );
}
