import React, { useState, memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';

interface CollapsibleReasoningProps {
  text: string;
}

export const CollapsibleReasoning = memo(function CollapsibleReasoning({ text }: CollapsibleReasoningProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground/60 transition-transform duration-200",
            isOpen && "rotate-90"
          )}
        />
        <span className="text-[11px] font-medium text-muted-foreground/60">
          Thinking
        </span>
      </button>
      
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out ml-1",
          isOpen ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-l-2 border-border/40 pl-3 py-1 mb-2">
            <MarkdownRenderer content={text} className="text-[12px] opacity-70 prose-p:leading-relaxed prose-sm dark:prose-invert max-w-none" />
          </div>
        </div>
      </div>
    </div>
  );
});
