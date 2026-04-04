import { useCallback, useEffect, useRef, useState } from 'react';

type UseClipboardCopyOptions = {
  resetDelayMs?: number;
  onError?: (error: unknown) => void;
};

export function useClipboardCopy({
  resetDelayMs = 2000,
  onError
}: UseClipboardCopyOptions = {}) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current === null) {
      return;
    }

    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);

  useEffect(() => {
    return clearResetTimer;
  }, [clearResetTimer]);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearResetTimer();
        resetTimerRef.current = window.setTimeout(() => {
          setCopied(false);
          resetTimerRef.current = null;
        }, resetDelayMs);
      } catch (error) {
        onError?.(error);
      }
    },
    [clearResetTimer, onError, resetDelayMs]
  );

  return { copied, copy };
}
