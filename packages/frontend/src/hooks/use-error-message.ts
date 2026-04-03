import { useCallback } from 'react';
import { toast } from 'sonner';

import { toApiRequestError } from '@/api/client';

type HandleErrorOptions = {
  /** HTTP status codes to silently skip (caller handles them separately) */
  skipCodes?: number[];
  /** Contextual prefix prepended to the toast message */
  context?: string;
};

/**
 * Returns a stable callback for displaying query-level errors as toasts.
 *
 * Industry convention:
 * - **Query errors** → toast (non-blocking, global feedback)
 * - **Mutation errors** → inline error near the trigger (actionable feedback)
 *
 * For mutations, prefer showing inline errors via `setSubmitError` and avoid
 * calling this hook to prevent double-showing the same error as both toast + inline.
 */
export function useErrorMessage() {
  return useCallback((error: unknown, options?: HandleErrorOptions) => {
    const apiError = toApiRequestError(error);

    if (options?.skipCodes?.includes(apiError.code)) {
      return;
    }

    const message = options?.context
      ? `${options.context}: ${apiError.message}`
      : apiError.message;

    toast.error(message);
  }, []);
}
