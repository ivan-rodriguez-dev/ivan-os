import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Toast {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (kind: Toast['kind'], message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-lg border bg-raised px-4 py-3 text-sm shadow-xl shadow-black/40',
              toast.kind === 'error' ? 'border-danger/50' : 'border-ok/40',
            )}
          >
            {toast.kind === 'error' ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
            )}
            <p className="flex-1 text-ink">{toast.message}</p>
            <button type="button" onClick={() => dismiss(toast.id)} className="text-ink-mute hover:text-ink" aria-label="Cerrar aviso">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
