import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function InputHint({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-2.5 right-5 rounded-md bg-background/80 px-1.5 py-0.5 text-[11px] text-muted-foreground/70 backdrop-blur-[2px]',
        className
      )}
    >
      {children}
    </div>
  );
}
