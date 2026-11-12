import { Pencil, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useAction } from '@/hooks/useAction';
import { IconButton } from './Button';
import { ConfirmDialog } from './Modal';

export type EditorTarget<Row> = { mode: 'new' } | { mode: 'edit'; row: Row };

/** Tracks which row (if any) is open in a create/edit form and which is pending deletion. */
export function useEditor<Row>() {
  const [target, setTarget] = useState<EditorTarget<Row> | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  return {
    target,
    deleting,
    openNew: useCallback(() => setTarget({ mode: 'new' }), []),
    openEdit: useCallback((row: Row) => setTarget({ mode: 'edit', row }), []),
    close: useCallback(() => setTarget(null), []),
    askDelete: useCallback((row: Row) => setDeleting(row), []),
    closeDelete: useCallback(() => setDeleting(null), []),
  };
}

interface DeleteDialogProps<Row> {
  row: Row | null;
  /** Human name of the row, used in the confirmation text. */
  name: (row: Row) => string;
  remove: (row: Row) => Promise<unknown>;
  onDone: () => void;
  onClose: () => void;
  consequence?: string;
}

export function DeleteDialog<Row>({ row, name, remove, onDone, onClose, consequence }: DeleteDialogProps<Row>) {
  const { run, pending } = useAction();
  return (
    <ConfirmDialog
      open={row !== null}
      title="Confirmar eliminación"
      message={row ? `¿Eliminar "${name(row)}"? ${consequence ?? 'Esta acción no se puede deshacer.'}` : ''}
      pending={pending}
      onClose={onClose}
      onConfirm={async () => {
        if (!row) return;
        if (await run(() => remove(row), 'Eliminado correctamente.')) {
          onClose();
          onDone();
        }
      }}
    />
  );
}

export function RowActions({ name, onEdit, onDelete }: { name: string; onEdit?: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center">
      {onEdit && (
        <IconButton label={`Editar ${name}`} onClick={onEdit}>
          <Pencil className="size-4" />
        </IconButton>
      )}
      <IconButton label={`Eliminar ${name}`} tone="danger" onClick={onDelete}>
        <Trash2 className="size-4" />
      </IconButton>
    </div>
  );
}
