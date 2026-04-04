import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InputHint } from '@/components/app/InputHint';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function MessageComposerShell({
  header,
  footer,
  children,
  className
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-[1.5rem] border border-input bg-background shadow-sm transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
        className
      )}
    >
      {header ? <div className="px-4 pb-1.5 pt-3.5 sm:px-5">{header}</div> : null}
      {children}
      {footer ? (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function MessageComposerInputArea({
  hint,
  children,
  className
}: {
  hint: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative px-4 pb-0.5 sm:px-5', className)}>
      {children}
      <InputHint>{hint}</InputHint>
    </div>
  );
}

export function MessageComposerFooterMeta({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-1.5', className)}>
      {children}
    </div>
  );
}

export function MessageComposerFooterActions({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'ml-auto flex shrink-0 items-center justify-end gap-1.5 pl-1',
        className
      )}
    >
      {children}
    </div>
  );
}

export function MessageComposerField({
  label,
  htmlFor,
  error,
  children,
  className
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function MessageComposerError({
  title,
  message,
  className
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
