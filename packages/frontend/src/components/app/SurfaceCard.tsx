import { forwardRef, type ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

type SurfaceCardProps = ComponentPropsWithoutRef<'div'>;

export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-border/60 bg-card p-5 sm:p-6',
        className
      )}
      {...props}
    />
  )
);

SurfaceCard.displayName = 'SurfaceCard';
