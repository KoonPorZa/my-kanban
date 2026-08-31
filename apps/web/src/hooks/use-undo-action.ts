'use client';

import { useCallback } from 'react';

import { toast } from 'src/components/snackbar';

export function useUndoAction() {
  return useCallback(
    ({
      message,
      undo,
      successMessage = 'Action undone',
      errorMessage = 'Could not undo the action',
    }: {
      message: string;
      undo: () => Promise<unknown>;
      successMessage?: string;
      errorMessage?: string;
    }) => {
      toast.success(message, {
        duration: 8_000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await undo();
              toast.success(successMessage);
            } catch {
              toast.error(errorMessage);
            }
          },
        },
      });
    },
    []
  );
}
