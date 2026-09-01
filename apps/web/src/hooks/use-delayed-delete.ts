'use client';

import { useRef, useEffect, useCallback } from 'react';

import { toast } from 'src/components/snackbar';

export const PERMANENT_DELETE_DELAY_MS = 5_000;

export function scheduleDelayedDelete(
  operation: () => Promise<unknown>,
  onComplete: () => void,
  onError: (error: unknown) => void,
  delay = PERMANENT_DELETE_DELAY_MS
) {
  let cancelled = false;
  const timer = globalThis.setTimeout(
    async () => {
      if (cancelled) return;
      try {
        await operation();
        onComplete();
      } catch (error) {
        onError(error);
      }
    },
    Math.max(PERMANENT_DELETE_DELAY_MS, delay)
  );

  return () => {
    cancelled = true;
    globalThis.clearTimeout(timer);
  };
}

export function useDelayedDelete() {
  const pending = useRef(new Set<() => void>());

  useEffect(
    () => () => {
      pending.current.forEach((cancel) => cancel());
      pending.current.clear();
    },
    []
  );

  return useCallback(
    ({
      label,
      operation,
      onComplete,
      onError,
    }: {
      label: string;
      operation: () => Promise<unknown>;
      onComplete: () => void;
      onError: (error: unknown) => void;
    }) => {
      let cancel = () => {};
      cancel = scheduleDelayedDelete(
        operation,
        () => {
          pending.current.delete(cancel);
          onComplete();
        },
        (error) => {
          pending.current.delete(cancel);
          onError(error);
        }
      );
      pending.current.add(cancel);
      toast.warning(`${label} will be permanently deleted in 5 seconds`, {
        duration: PERMANENT_DELETE_DELAY_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            cancel();
            pending.current.delete(cancel);
            toast.success('Permanent deletion cancelled');
          },
        },
      });
    },
    []
  );
}
