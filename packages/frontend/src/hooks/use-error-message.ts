import { useCallback } from 'react';
import { toast } from 'sonner';

import { toApiRequestError } from '@/api/client';

export function useErrorMessage() {
  return useCallback((error: unknown) => {
    const apiError = toApiRequestError(error);
    toast.error(apiError.message);
  }, []);
}
