import { forwardRef, type ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

type SurfaceCardProps = ComponentPropsWithoutRef<'div'>;

export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[calc(var(--radius)*1.1)] border border-border/70 bg-card/80 p-4 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.18)] sm:p-5',
        className
      )}
      {...props}
    />
  )
);

SurfaceCard.displayName = 'SurfaceCard';
