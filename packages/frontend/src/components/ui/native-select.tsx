import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
      className
    )}
    {...props}
  />
));
NativeSelect.displayName = 'NativeSelect';

const CompactNativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    containerClassName?: string;
  }
>(({ className, containerClassName, ...props }, ref) => (
  <div className={cn('relative inline-flex max-w-full items-center', containerClassName)}>
    <select
      ref={ref}
      className={cn(
        'h-9 w-full cursor-pointer appearance-none rounded-full border border-border/70 bg-background/90 px-3 pr-8 text-xs font-medium text-foreground shadow-sm outline-none transition-colors hover:border-border hover:bg-accent/35 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:border-border/40 disabled:bg-muted/20 disabled:text-muted-foreground/60 disabled:opacity-100',
        className
      )}
      {...props}
    />
    <ChevronDown className="pointer-events-none absolute right-3 size-3 text-muted-foreground/80" />
  </div>
));
CompactNativeSelect.displayName = 'CompactNativeSelect';

export { CompactNativeSelect, NativeSelect };
