import { Check, ChevronLeft, ChevronRight, Plus, Repeat2, Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, DeleteDialog, EmptyState, FormActions, IconButton, Input, Modal, PageHeader, Panel, ProgressBar, QueryView, RowActions, Select, optionsFrom, useEditor, type EditorTarget } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/cn';
import { WEEKDAY_LABELS, addDays, formatDate, parseISODate, relativeDay, startOfWeek, todayISO, weekDates } from '@/lib/dates';
import { GOAL_AREA_LABEL } from '@/lib/labels';
import { percentOf } from '@/lib/money';
import { integerBetween, isoDate, maxLength, nonNegativeNumber, positiveNumber, required } from '@/lib/validation';
import { goals, habitLogs, habits } from '@/services';
import type { Goal, GoalArea, Habit } from '@/types/database';

const toNumber = (text: string) => Number(text.replace(',', '.'));
const trimNumber = (value: number) => String(Number(value));

function GoalForm({ target, onClose, onSaved }: { target: EditorTarget<Goal>; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    {
      title: editing?.title ?? '',
      area: (editing?.area ?? 'personal') as GoalArea,
      unit: editing?.unit ?? '',
      target_value: editing ? trimNumber(editing.target_value) : '',
      current_value: editing ? trimNumber(editing.current_value) : '0',
      due_date: editing?.due_date ?? '',
    },
    { title: [required(), maxLength(160)], unit: [maxLength(30)], target_value: [positiveNumber()], current_value: [nonNegativeNumber()], due_date: [isoDate(true)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = {
      title: values.title.trim(),
      area: values.area,
      unit: values.unit.trim(),
      target_value: toNumber(values.target_value),
      current_value: toNumber(values.current_value),
      due_date: values.due_date || null,
    };
    const ok = await run(() => (editing ? goals.update(editing.id, payload) : goals.create(payload)), editing ? 'Objetivo actualizado.' : 'Objetivo creado.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar objetivo' : 'Nuevo objetivo'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Objetivo" placeholder="Ej. Completar 100 horas de programación" value={v.title} error={form.errors.title} onChange={(e) => form.set('title', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Área" value={v.area} options={optionsFrom(GOAL_AREA_LABEL)} onChange={(e) => form.set('area', e.target.value as GoalArea)} />
          <Input label="Unidad (opcional)" placeholder="horas, libros, %…" value={v.unit} error={form.errors.unit} onChange={(e) => form.set('unit', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Avance actual" inputMode="decimal" value={v.current_value} error={form.errors.current_value} onChange={(e) => form.set('current_value', e.target.value)} />
          <Input label="Meta" inputMode="decimal" value={v.target_value} error={form.errors.target_value} onChange={(e) => form.set('target_value', e.target.value)} />
        </div>
        <Input label="Fecha límite (opcional)" type="date" value={v.due_date} error={form.errors.due_date} onChange={(e) => form.set('due_date', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

function HabitForm({ target, onClose, onSaved }: { target: EditorTarget<Habit>; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    { name: editing?.name ?? '', target_per_week: String(editing?.target_per_week ?? 7), archived: editing?.archived ?? false },
    { name: [required(), maxLength(80)], target_per_week: [integerBetween(1, 7)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = { name: values.name.trim(), target_per_week: Number(values.target_per_week), archived: values.archived };
    const ok = await run(() => (editing ? habits.update(editing.id, payload) : habits.create(payload)), editing ? 'Hábito actualizado.' : 'Hábito creado.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar hábito' : 'Nuevo hábito'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Hábito" placeholder="Ej. Leer 20 minutos" value={v.name} error={form.errors.name} onChange={(e) => form.set('name', e.target.value)} />
        <Input label="Veces por semana (1–7)" type="number" inputMode="numeric" min={1} max={7} value={v.target_per_week} error={form.errors.target_per_week} onChange={(e) => form.set('target_per_week', e.target.value)} />
        {editing && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={v.archived} onChange={(e) => form.set('archived', e.target.checked)} />
            Archivar (deja de aparecer en el seguimiento, conserva su historial)
          </label>
        )}
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

export default function GoalsPage() {
  const today = todayISO();
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const goalEditor = useEditor<Goal>();
  const habitEditor = useEditor<Habit>();
  const { run, pending } = useAction();

  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const weekEnd = days[6] as string;

  const goalsQuery = useQuery(() => goals.list(), []);
  const habitsQuery = useQuery(() => habits.list(), []);
  const logsQuery = useQuery(() => habitLogs.between(weekStart, weekEnd), [weekStart, weekEnd]);

  const done = useMemo(() => new Set((logsQuery.data ?? []).map((l) => `${l.habit_id}|${l.log_date}`)), [logsQuery.data]);
  const habitList = habitsQuery.data ?? [];
  const active = habitList.filter((h) => !h.archived);
  const archived = habitList.filter((h) => h.archived);

  const toggle = (habit: Habit, date: string) => {
    const isDone = done.has(`${habit.id}|${date}`);
    void run(() => habitLogs.set(habit.id, date, !isDone)).then((ok) => {
      if (ok) void logsQuery.reload();
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Goals & Habits"
        title="Objetivos y hábitos"
        description="Metas medibles y el seguimiento semanal de tus hábitos."
        actions={
          <>
            <Button icon={<Plus className="size-4" />} onClick={habitEditor.openNew}>
              Nuevo hábito
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={goalEditor.openNew}>
              Nuevo objetivo
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <Panel title="Objetivos" flush>
          <QueryView query={goalsQuery}>
            {(list) =>
              list.length === 0 ? (
                <EmptyState icon={Target} title="Sin objetivos" description="Define una meta con un valor numérico para medir tu avance." />
              ) : (
                <ul className="divide-y divide-line">
                  {list.map((goal) => {
                    const percent = percentOf(Number(goal.current_value), Number(goal.target_value));
                    const reached = Number(goal.current_value) >= Number(goal.target_value);
                    return (
                      <li key={goal.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{goal.title}</p>
                            <Badge>{GOAL_AREA_LABEL[goal.area]}</Badge>
                            {reached && <Badge tone="ok">Cumplido</Badge>}
                          </div>
                          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-ink-soft">
                            <span className="num">
                              <span className="text-ink">{trimNumber(goal.current_value)}</span> / {trimNumber(goal.target_value)} {goal.unit}
                            </span>
                            <span className="num">{percent}%</span>
                          </div>
                          <div className="mt-1.5">
                            <ProgressBar percent={percent} tone={reached ? 'ok' : 'accent'} label={`Avance de ${goal.title}`} />
                          </div>
                          {goal.due_date && (
                            <p className={cn('mt-2 text-sm', !reached && goal.due_date < today ? 'text-danger' : 'text-ink-mute')}>
                              Fecha límite: {formatDate(goal.due_date)} · {relativeDay(goal.due_date, today)}
                            </p>
                          )}
                        </div>
                        <RowActions name={goal.title} onEdit={() => goalEditor.openEdit(goal)} onDelete={() => goalEditor.askDelete(goal)} />
                      </li>
                    );
                  })}
                </ul>
              )
            }
          </QueryView>
        </Panel>

        <Panel
          title="Hábitos de la semana"
          flush
          actions={
            <>
              <IconButton label="Semana anterior" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="size-5" />
              </IconButton>
              <span className="num min-w-28 text-center text-sm text-ink-soft" aria-live="polite">
                {formatDate(weekStart, 'short')} – {formatDate(weekEnd, 'short')}
              </span>
              <IconButton label="Semana siguiente" disabled={weekStart >= startOfWeek(today)} onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight className="size-5" />
              </IconButton>
            </>
          }
        >
          <QueryView query={habitsQuery}>
            {() =>
              active.length === 0 ? (
                <EmptyState icon={Repeat2} title="Sin hábitos activos" description="Crea un hábito y márcalo cada día que lo cumplas." />
              ) : (
                <ul className="divide-y divide-line">
                  {active.map((habit) => {
                    const count = days.filter((d) => done.has(`${habit.id}|${d}`)).length;
                    return (
                      <li key={habit.id} className="flex flex-col gap-2.5 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{habit.name}</p>
                            <p className={cn('num text-sm', count >= habit.target_per_week ? 'text-ok' : 'text-ink-mute')}>
                              {count}/{habit.target_per_week} esta semana
                            </p>
                          </div>
                          <RowActions name={habit.name} onEdit={() => habitEditor.openEdit(habit)} onDelete={() => habitEditor.askDelete(habit)} />
                        </div>
                        <div className="grid grid-cols-7 gap-1.5 lg:w-[23rem]">
                          {days.map((date, i) => {
                            const isDone = done.has(`${habit.id}|${date}`);
                            const future = date > today;
                            return (
                              <button
                                key={date}
                                type="button"
                                role="checkbox"
                                aria-checked={isDone}
                                aria-label={`${habit.name}, ${formatDate(date, 'long')}`}
                                disabled={future || pending}
                                onClick={() => toggle(habit, date)}
                                className={cn(
                                  'flex h-12 flex-col items-center justify-center rounded-lg border text-xs transition-colors disabled:cursor-not-allowed',
                                  isDone ? 'border-ok/50 bg-ok/15 text-ok' : 'border-line-strong text-ink-mute hover:border-accent/60',
                                  future && 'opacity-35',
                                  date === today && !isDone && 'border-accent/60',
                                )}
                              >
                                <span>{WEEKDAY_LABELS[i]}</span>
                                {isDone ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : <span className="num">{parseISODate(date).getDate()}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            }
          </QueryView>
        </Panel>

        {archived.length > 0 && (
          <Panel title="Hábitos archivados" flush>
            <ul className="divide-y divide-line">
              {archived.map((habit) => (
                <li key={habit.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <p className="min-w-0 flex-1 truncate text-ink-soft">{habit.name}</p>
                  <RowActions name={habit.name} onEdit={() => habitEditor.openEdit(habit)} onDelete={() => habitEditor.askDelete(habit)} />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {goalEditor.target && <GoalForm target={goalEditor.target} onClose={goalEditor.close} onSaved={() => void goalsQuery.reload()} />}
      {habitEditor.target && <HabitForm target={habitEditor.target} onClose={habitEditor.close} onSaved={() => void habitsQuery.reload()} />}
      <DeleteDialog row={goalEditor.deleting} name={(g) => g.title} remove={(g) => goals.remove(g.id)} onDone={() => void goalsQuery.reload()} onClose={goalEditor.closeDelete} />
      <DeleteDialog
        row={habitEditor.deleting}
        name={(h) => h.name}
        remove={(h) => habits.remove(h.id)}
        onDone={() => {
          void habitsQuery.reload();
          void logsQuery.reload();
        }}
        onClose={habitEditor.closeDelete}
        consequence="También se eliminará todo su historial."
      />
    </>
  );
}
