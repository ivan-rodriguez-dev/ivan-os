import { useCallback, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { errorMessage } from '@/lib/errors';

/**
 * Runs a mutation with shared UX: pending flag, success toast, error toast.
 * Resolves to true on success so callers can close a dialog or reload data.
 */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (action: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
      setPending(true);
      try {
        await action();
        if (successMessage) toast.success(successMessage);
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  return { run, pending };
}
