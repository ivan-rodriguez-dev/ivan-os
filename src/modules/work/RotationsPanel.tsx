import { CalendarPlus, Plus, Repeat, X } from 'lucide-react';
import { useState } from 'react';
import { Button, DeleteDialog, EmptyState, FormActions, IconButton, Input, Modal, Panel, QueryView, RowActions, Select, optionsFrom, useEditor, type EditorTarget } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import type { QueryState } from '@/hooks/useQuery';
import { addDays, diffDays, todayISO } from '@/lib/dates';
import { SHIFT_KIND_LABEL, isValidTime, trimTime, type RotationStep, type ShiftKind } from '@/lib/shifts';
import { isoDate, maxLength, required, type Rule } from '@/lib/validation';
import { shiftRotations, workShifts } from '@/services';
import type { ShiftRotation } from '@/types/database';
import { KIND_DEFAULT_TIMES } from './ShiftForm';

const MAX_STEPS = 60;
const MAX_RANGE_DAYS = 366;

const newStep = (kind: ShiftKind): RotationStep =>
  kind === 'rest' ? { kind, start_time: null, end_time: null } : { kind, start_time: KIND_DEFAULT_TIMES[kind].start, end_time: KIND_DEFAULT_TIMES[kind].end };

const stepError = (step: RotationStep): string | null => {
  if (step.kind === 'rest') return null;
  if (!step.start_time || !step.end_time || !isValidTime(step.start_time) || !isValidTime(step.end_time)) return 'Hora no válida';
  return step.start_time === step.end_time ? 'El inicio y el fin no pueden ser iguales' : null;
};

const stepText = (step: RotationStep) => (step.kind === 'rest' ? 'Descanso' : `${SHIFT_KIND_LABEL[step.kind]} ${trimTime(step.start_time)}–${trimTime(step.end_time)}`);

const STEP_DOT: Record<ShiftKind, string> = { day: 'bg-accent', night: 'bg-violet', custom: 'bg-warn', rest: 'bg-line-strong' };

function RotationForm({ target, onClose, onSaved }: { target: EditorTarget<ShiftRotation>; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const [steps, setSteps] = useState<RotationStep[]>(
    editing?.pattern.map((s) => ({ ...s, start_time: s.start_time ? trimTime(s.start_time) : null, end_time: s.end_time ? trimTime(s.end_time) : null })) ?? [
      newStep('day'),
      newStep('day'),
      newStep('night'),
      newStep('night'),
      newStep('rest'),
      newStep('rest'),
    ],
  );
  const [showStepErrors, setShowStepErrors] = useState(false);
  const form = useForm({ name: editing?.name ?? '' }, { name: [required(), maxLength(60)] });

  const patch = (index: number, change: Partial<RotationStep>) => setSteps((list) => list.map((s, i) => (i === index ? { ...s, ...change } : s)));

  const save = form.submit(async (values) => {
    if (steps.length === 0 || steps.some((s) => stepError(s))) {
      setShowStepErrors(true);
      return;
    }
    const payload = { name: values.name.trim(), pattern: steps };
    const ok = await run(() => (editing ? shiftRotations.update(editing.id, payload) : shiftRotations.create(payload)), editing ? 'Rotación actualizada.' : 'Rotación creada.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open wide title={editing ? 'Editar rotación' : 'Nueva rotación'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Nombre" placeholder="Ej. 2 días · 2 noches · 2 descansos" value={form.values.name} error={form.errors.name} onChange={(e) => form.set('name', e.target.value)} />
        <div>
          <p className="text-sm font-medium text-ink-soft">Ciclo ({steps.length} días)</p>
          <p className="text-sm text-ink-mute">Cada fila es un día. El ciclo se repite al aplicarlo al calendario.</p>
        </div>
        {showStepErrors && steps.length === 0 && (
          <p role="alert" className="text-sm text-danger">
            Agrega al menos un día al ciclo.
          </p>
        )}
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => {
            const error = showStepErrors ? stepError(step) : null;
            return (
              <li key={index} className="rounded-lg border border-line bg-void p-2.5">
                <div className="flex items-end gap-2">
                  <span className="num w-7 shrink-0 pb-2.5 text-center text-sm text-ink-mute">{index + 1}</span>
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="col-span-2 sm:col-span-1">
                      <Select label={`Día ${index + 1}: tipo`} value={step.kind} options={optionsFrom(SHIFT_KIND_LABEL)} onChange={(e) => patch(index, newStep(e.target.value as ShiftKind))} />
                    </div>
                    {step.kind !== 'rest' && (
                      <>
                        <Input label="Inicio" type="time" value={step.start_time ?? ''} onChange={(e) => patch(index, { start_time: e.target.value })} />
                        <Input label="Fin" type="time" value={step.end_time ?? ''} onChange={(e) => patch(index, { end_time: e.target.value })} />
                      </>
                    )}
                  </div>
                  <IconButton label={`Quitar día ${index + 1}`} tone="danger" className="mb-1" onClick={() => setSteps((list) => list.filter((_, i) => i !== index))}>
                    <X className="size-4" />
                  </IconButton>
                </div>
                {error && (
                  <p role="alert" className="mt-1.5 pl-9 text-sm text-danger">
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        <Button size="sm" className="self-start" icon={<Plus className="size-4" />} disabled={steps.length >= MAX_STEPS} onClick={() => setSteps((list) => [...list, newStep('day')])}>
          Agregar día
        </Button>
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

interface ApplyValues {
  from: string;
  to: string;
  replace: boolean;
}

const rangeRule: Rule<ApplyValues> = (_value, values) => {
  const days = diffDays(values.from, values.to);
  if (Number.isNaN(days)) return null;
  if (days < 0) return 'Debe ser igual o posterior a la fecha de inicio';
  return days >= MAX_RANGE_DAYS ? `El rango máximo es de ${MAX_RANGE_DAYS} días` : null;
};

function ApplyRotationForm({ rotation, onClose, onApplied }: { rotation: ShiftRotation; onClose: () => void; onApplied: () => void }) {
  const { run, pending } = useAction();
  const toast = useToast();
  const today = todayISO();
  const form = useForm<ApplyValues>({ from: today, to: addDays(today, rotation.pattern.length * 4 - 1), replace: true }, { from: [isoDate()], to: [isoDate(), rangeRule] });
  const v = form.values;
  const days = diffDays(v.from, v.to) + 1;

  const apply = form.submit(async (values) => {
    let count = 0;
    const ok = await run(async () => {
      count = await workShifts.applyRotation(rotation, values.from, values.to, values.replace);
    });
    if (ok) {
      toast.success(`Rotación aplicada: ${count} días generados.`);
      onClose();
      onApplied();
    }
  });

  return (
    <Modal open title={`Aplicar "${rotation.name}"`} onClose={onClose}>
      <form noValidate onSubmit={apply} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Desde" type="date" value={v.from} error={form.errors.from} onChange={(e) => form.set('from', e.target.value)} />
          <Input label="Hasta" type="date" value={v.to} error={form.errors.to} onChange={(e) => form.set('to', e.target.value)} />
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-line bg-void px-3 py-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={v.replace} onChange={(e) => form.set('replace', e.target.checked)} />
          <span>
            <span className="font-medium text-ink">Reemplazar turnos existentes en el rango</span>
            <span className="block text-ink-mute">Si lo desmarcas, los turnos nuevos se suman a los que ya existen.</span>
          </span>
        </label>
        {days > 0 && days <= MAX_RANGE_DAYS && (
          <p className="text-sm text-ink-soft">
            Se generarán <span className="num text-ink">{days}</span> días a partir del día 1 del ciclo.
          </p>
        )}
        <FormActions onCancel={onClose} pending={pending} submitLabel="Aplicar al calendario" />
      </form>
    </Modal>
  );
}

export function RotationsPanel({ query, onApplied }: { query: QueryState<ShiftRotation[]>; onApplied: () => void }) {
  const editor = useEditor<ShiftRotation>();
  const [applying, setApplying] = useState<ShiftRotation | null>(null);
  const reload = () => void query.reload();

  return (
    <Panel
      title="Rotaciones laborales"
      flush
      actions={
        <Button size="sm" icon={<Plus className="size-4" />} onClick={editor.openNew}>
          Nueva rotación
        </Button>
      }
    >
      <QueryView query={query}>
        {(rotations) =>
          rotations.length === 0 ? (
            <EmptyState icon={Repeat} title="Sin rotaciones" description="Define un ciclo (por ejemplo 2 días, 2 noches, 2 descansos) y aplícalo al calendario para generar semanas de turnos." />
          ) : (
            <ul className="divide-y divide-line">
              {rotations.map((rotation) => (
                <li key={rotation.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{rotation.name}</p>
                    <ol className="mt-2 flex flex-wrap gap-1.5" aria-label="Ciclo">
                      {rotation.pattern.map((step, i) => (
                        <li key={i} title={stepText(step)} className="num flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs text-ink-soft">
                          <span className={`size-1.5 rounded-full ${STEP_DOT[step.kind]}`} aria-hidden />
                          {step.kind === 'rest' ? 'Desc.' : trimTime(step.start_time)}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="primary" icon={<CalendarPlus className="size-4" />} onClick={() => setApplying(rotation)}>
                      Aplicar
                    </Button>
                    <RowActions name={rotation.name} onEdit={() => editor.openEdit(rotation)} onDelete={() => editor.askDelete(rotation)} />
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>
      {editor.target && <RotationForm target={editor.target} onClose={editor.close} onSaved={reload} />}
      {applying && <ApplyRotationForm rotation={applying} onClose={() => setApplying(null)} onApplied={onApplied} />}
      <DeleteDialog row={editor.deleting} name={(r) => r.name} remove={(r) => shiftRotations.remove(r.id)} onDone={reload} onClose={editor.closeDelete} consequence="Los turnos ya generados se conservan." />
    </Panel>
  );
}
