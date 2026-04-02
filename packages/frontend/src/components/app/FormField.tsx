import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  description,
  error,
  className,
  children
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {label ? (
        <div className="space-y-1">
          <Label htmlFor={htmlFor} className="text-sm font-semibold">
            {label}
          </Label>
          {description ? (
            <p className="text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
