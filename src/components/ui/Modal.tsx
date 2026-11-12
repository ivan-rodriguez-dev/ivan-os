import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button, IconButton } from './Button';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** Native <dialog>: focus trap, Esc to close and inert background come from the browser. */
export function Modal({ open, title, onClose, children, wide = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-label={title}
      className={`m-auto w-[calc(100vw-1.5rem)] animate-rise rounded-xl border border-line-strong bg-panel p-0 text-ink shadow-2xl shadow-black/60 backdrop:bg-void/80 backdrop:backdrop-blur-sm ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 className="text-[1rem] font-semibold">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </dialog>
  );
}

/** Standard footer for forms inside a Modal. */
export function FormActions({ onCancel, pending, submitLabel = 'Guardar' }: { onCancel: () => void; pending: boolean; submitLabel?: string }) {
  return (
    <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="ghost" onClick={onCancel} disabled={pending}>
        Cancelar
      </Button>
      <Button type="submit" variant="primary" loading={pending}>
        {submitLabel}
      </Button>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Eliminar', pending = false, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-ink-soft">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
