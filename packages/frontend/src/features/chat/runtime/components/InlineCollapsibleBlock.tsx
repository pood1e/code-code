import React from 'react';
import { ChevronRight } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export function InlineCollapsibleBlock({
  expandedLabel,
  summary,
  icon,
  initiallyOpen = false,
  action,
  widthClassName,
  bodyClassName,
  children
}: {
  expandedLabel: string;
  summary: string;
  icon: React.ReactNode;
  initiallyOpen?: boolean;
  action?: React.ReactNode;
  widthClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(initiallyOpen);
  const [hasOpened, setHasOpened] = React.useState(initiallyOpen);
  const triggerLabel = `${expandedLabel}：${summary}`;

  React.useEffect(() => {
    setIsOpen(initiallyOpen);
    if (initiallyOpen) {
      setHasOpened(true);
    }
  }, [initiallyOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setHasOpened(true);
  }, [isOpen]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('max-w-full', widthClassName)}
    >
      <div className="flex items-center gap-1">
        <CollapsibleTrigger
          aria-label={triggerLabel}
          title={summary}
          className="flex w-fit max-w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] text-muted-foreground/70 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-90'
            )}
          />
          {icon}
          <span className="truncate font-medium">{summary}</span>
        </CollapsibleTrigger>

        {isOpen ? action : null}
      </div>

      <CollapsibleContent
        forceMount={hasOpened ? true : undefined}
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          isOpen ? 'mt-1 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              'ml-1 border-l-2 border-border/40 py-1 pl-3',
              bodyClassName
            )}
          >
            {hasOpened ? children : null}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
