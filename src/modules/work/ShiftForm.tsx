import { Trash2 } from 'lucide-react';
import { Button, FormActions, Input, Modal, Select, Textarea, optionsFrom, type EditorTarget } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { formatMinutes } from '@/lib/dates';
import { SHIFT_KIND_LABEL, isOvernight, isValidTime, shiftDurationMinutes, trimTime, type ShiftKind } from '@/lib/shifts';
import { isoDate, maxLength, type Rule } from '@/lib/validation';
import { workShifts } from '@/services';
import type { ShiftTemplate, WorkShift } from '@/types/database';

export const KIND_DEFAULT_TIMES: Record<Exclude<ShiftKind, 'rest'>, { start: string; end: string }> = {
  day: { start: '06:00', end: '14:00' },
  night: { start: '22:00', end: '06:00' },
  custom: { start: '08:00', end: '17:00' },
};

interface Values {
  shift_date: string;
  kind: ShiftKind;
  start_time: string;
  end_time: string;
  label: string;
  notes: string;
}

const timeUnlessRest: Rule<Values> = (value, values) => {
  if (values.kind === 'rest') return null;
  if (typeof value !== 'string' || !isValidTime(value)) return 'Hora no válida';
  return values.start_time === values.end_time ? 'El inicio y el fin no pueden ser iguales' : null;
};

/** Explains how long a shift lasts and whether it crosses midnight. */
export function ShiftDurationHint({ start, end }: { start: string; end: string }) {
  if (!isValidTime(start) || !isValidTime(end) || start === end) return null;
  return (
    <p className="rounded-lg border border-line bg-void px-3 py-2 text-sm text-ink-soft">
      Duración: <span className="num text-ink">{formatMinutes(shiftDurationMinutes(start, end))}</span>
      {isOvernight(start, end) && <span className="text-violet"> · termina el día siguiente</span>}
    </p>
  );
}

interface Props {
  target: EditorTarget<WorkShift>;
  defaultDate: string;
  templates: ShiftTemplate[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: (shift: WorkShift) => void;
}

export function ShiftForm({ target, defaultDate, templates, onClose, onSaved, onDelete }: Props) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm<Values>(
    {
      shift_date: editing?.shift_date ?? defaultDate,
      kind: editing?.kind ?? 'day',
      start_time: trimTime(editing?.start_time ?? null) || KIND_DEFAULT_TIMES.day.start,
      end_time: trimTime(editing?.end_time ?? null) || KIND_DEFAULT_TIMES.day.end,
      label: editing?.label ?? '',
      notes: editing?.notes ?? '',
    },
    { shift_date: [isoDate()], start_time: [timeUnlessRest], end_time: [timeUnlessRest], label: [maxLength(60)], notes: [maxLength(1000)] },
  );
  const v = form.values;
  const isRest = v.kind === 'rest';

  const changeKind = (kind: ShiftKind) => {
    form.set('kind', kind);
    if (kind !== 'rest') {
      form.set('start_time', KIND_DEFAULT_TIMES[kind].start);
      form.set('end_time', KIND_DEFAULT_TIMES[kind].end);
    }
  };

  const applyTemplate = (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    form.setValues((prev) => ({
      ...prev,
      kind: template.kind,
      start_time: trimTime(template.start_time),
      end_time: trimTime(template.end_time),
      label: template.name,
    }));
  };

  const save = form.submit(async (values) => {
    const payload = {
      shift_date: values.shift_date,
      kind: values.kind,
      start_time: values.kind === 'rest' ? null : values.start_time,
      end_time: values.kind === 'rest' ? null : values.end_time,
      label: values.label.trim(),
      notes: values.notes.trim(),
    };
    const ok = await run(() => (editing ? workShifts.update(editing.id, payload) : workShifts.create(payload)), editing ? 'Turno actualizado.' : 'Turno registrado.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar turno' : 'Nuevo turno'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        {templates.length > 0 && !isRest && (
          <Select
            label="Usar horario guardado"
            value=""
            placeholder="Seleccionar…"
            options={templates.map((t) => ({ value: t.id, label: `${t.name} (${trimTime(t.start_time)}–${trimTime(t.end_time)})` }))}
            onChange={(e) => applyTemplate(e.target.value)}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Fecha" type="date" value={v.shift_date} error={form.errors.shift_date} onChange={(e) => form.set('shift_date', e.target.value)} />
          <Select label="Tipo" value={v.kind} options={optionsFrom(SHIFT_KIND_LABEL)} onChange={(e) => changeKind(e.target.value as ShiftKind)} />
        </div>
        {!isRest && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Hora de inicio" type="time" value={v.start_time} error={form.errors.start_time} onChange={(e) => form.set('start_time', e.target.value)} />
              <Input label="Hora de fin" type="time" value={v.end_time} error={form.errors.end_time} onChange={(e) => form.set('end_time', e.target.value)} />
            </div>
            <ShiftDurationHint start={v.start_time} end={v.end_time} />
          </>
        )}
        <Input label="Etiqueta (opcional)" placeholder={isRest ? 'Ej. Descanso compensatorio' : 'Ej. Bodega norte'} value={v.label} error={form.errors.label} onChange={(e) => form.set('label', e.target.value)} />
        <Textarea label="Notas (opcional)" value={v.notes} error={form.errors.notes} onChange={(e) => form.set('notes', e.target.value)} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {editing ? (
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => onDelete(editing)} disabled={pending}>
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <FormActions onCancel={onClose} pending={pending} />
        </div>
      </form>
    </Modal>
  );
}
