import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[calc(var(--radius)*1.2)] border border-dashed border-border/80 bg-muted/25 px-6 py-12 text-center',
        className
      )}
    >
      <div className="mb-4 rounded-full border border-border/80 bg-background/80 p-3 text-muted-foreground">
        {icon ?? <Inbox />}
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
