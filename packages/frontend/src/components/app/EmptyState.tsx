import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  size?: 'default' | 'compact';
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  size = 'default'
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        size === 'compact' ? 'py-10' : 'py-16',
        className
      )}
    >
      {icon ? (
        <div className="mb-4 text-muted-foreground/60">{icon}</div>
      ) : null}
      <div className="max-w-sm space-y-2">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
