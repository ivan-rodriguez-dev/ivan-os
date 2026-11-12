import { Clock, Plus } from 'lucide-react';
import { Badge, Button, DeleteDialog, EmptyState, FormActions, Input, Modal, Panel, QueryView, RowActions, Select, useEditor, type EditorTarget } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import type { QueryState } from '@/hooks/useQuery';
import { formatMinutes } from '@/lib/dates';
import { SHIFT_KIND_LABEL, isOvernight, shiftDurationMinutes, trimTime } from '@/lib/shifts';
import { maxLength, required, time, type Rule } from '@/lib/validation';
import { shiftTemplates } from '@/services';
import type { ShiftTemplate } from '@/types/database';
import { KIND_DEFAULT_TIMES, ShiftDurationHint } from './ShiftForm';

type Kind = ShiftTemplate['kind'];
const KIND_OPTIONS = (['day', 'night', 'custom'] as const).map((value) => ({ value, label: SHIFT_KIND_LABEL[value] }));

interface Values {
  name: string;
  kind: Kind;
  start_time: string;
  end_time: string;
}

const differentTimes: Rule<Values> = (_value, values) => (values.start_time === values.end_time ? 'El inicio y el fin no pueden ser iguales' : null);

function TemplateForm({ target, onClose, onSaved }: { target: EditorTarget<ShiftTemplate>; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm<Values>(
    {
      name: editing?.name ?? '',
      kind: editing?.kind ?? 'day',
      start_time: trimTime(editing?.start_time ?? null) || KIND_DEFAULT_TIMES.day.start,
      end_time: trimTime(editing?.end_time ?? null) || KIND_DEFAULT_TIMES.day.end,
    },
    { name: [required(), maxLength(60)], start_time: [time()], end_time: [time(), differentTimes] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = { ...values, name: values.name.trim() };
    const ok = await run(() => (editing ? shiftTemplates.update(editing.id, payload) : shiftTemplates.create(payload)), editing ? 'Horario actualizado.' : 'Horario creado.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar horario' : 'Nuevo horario'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Nombre" placeholder="Ej. Turno mañana" value={v.name} error={form.errors.name} onChange={(e) => form.set('name', e.target.value)} />
        <Select
          label="Tipo"
          value={v.kind}
          options={KIND_OPTIONS}
          onChange={(e) => {
            const kind = e.target.value as Kind;
            form.setValues((prev) => ({ ...prev, kind, start_time: KIND_DEFAULT_TIMES[kind].start, end_time: KIND_DEFAULT_TIMES[kind].end }));
          }}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Hora de inicio" type="time" value={v.start_time} error={form.errors.start_time} onChange={(e) => form.set('start_time', e.target.value)} />
          <Input label="Hora de fin" type="time" value={v.end_time} error={form.errors.end_time} onChange={(e) => form.set('end_time', e.target.value)} />
        </div>
        <ShiftDurationHint start={v.start_time} end={v.end_time} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

export function TemplatesPanel({ query }: { query: QueryState<ShiftTemplate[]> }) {
  const editor = useEditor<ShiftTemplate>();
  const reload = () => void query.reload();

  return (
    <Panel
      title="Horarios personalizados"
      flush
      actions={
        <Button size="sm" icon={<Plus className="size-4" />} onClick={editor.openNew}>
          Nuevo horario
        </Button>
      }
    >
      <QueryView query={query}>
        {(templates) =>
          templates.length === 0 ? (
            <EmptyState icon={Clock} title="Sin horarios guardados" description="Guarda tus horarios habituales para registrar turnos con un clic." />
          ) : (
            <ul className="divide-y divide-line">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="num text-sm text-ink-soft">
                      {trimTime(t.start_time)} – {trimTime(t.end_time)} · {formatMinutes(shiftDurationMinutes(t.start_time, t.end_time))}
                      {isOvernight(t.start_time, t.end_time) && ' · +1 día'}
                    </p>
                  </div>
                  <Badge tone={t.kind === 'night' ? 'violet' : t.kind === 'day' ? 'accent' : 'warn'}>{SHIFT_KIND_LABEL[t.kind]}</Badge>
                  <RowActions name={t.name} onEdit={() => editor.openEdit(t)} onDelete={() => editor.askDelete(t)} />
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>
      {editor.target && <TemplateForm target={editor.target} onClose={editor.close} onSaved={reload} />}
      <DeleteDialog row={editor.deleting} name={(t) => t.name} remove={(t) => shiftTemplates.remove(t.id)} onDone={reload} onClose={editor.closeDelete} consequence="Los turnos ya registrados no cambian." />
    </Panel>
  );
}
