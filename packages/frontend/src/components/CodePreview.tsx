import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useClipboardCopy } from '@/hooks/use-clipboard-copy';

export function CodePreview({
  value,
  mode = 'json'
}: {
  value: string;
  mode?: 'json' | 'markdown';
}) {
  const { copied, copy } = useClipboardCopy({
    onError(error) {
      console.error('Failed to copy preview text: ', error);
    }
  });
  const copyLabel = copied ? '已复制内容' : '复制内容';

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
          aria-label={copyLabel}
          title={copyLabel}
          onClick={() => void copy(value)}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          <span className="sr-only">{copyLabel}</span>
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
        {value}
      </pre>
    </div>
  );
}
