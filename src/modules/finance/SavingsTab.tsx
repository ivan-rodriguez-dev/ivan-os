import { PiggyBank, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, DeleteDialog, EmptyState, FormActions, Input, Modal, Panel, ProgressBar, QueryView, RowActions, Stat, Textarea, useEditor, type EditorTarget } from '@/components/ui';
import { useCurrency } from '@/context/AuthContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import type { QueryState } from '@/hooks/useQuery';
import { formatDate, todayISO } from '@/lib/dates';
import { centsToDecimal, formatMoney, parseAmount, percentOf, toCents } from '@/lib/money';
import { amount, isoDate, maxLength, required } from '@/lib/validation';
import { savingsContributions, savingsGoals } from '@/services';
import type { SavingsContribution, SavingsGoalProgress } from '@/types/database';

const asNumeric = (cents: number) => centsToDecimal(cents) as unknown as number;

function GoalForm({ target, onClose, onSaved }: { target: EditorTarget<SavingsGoalProgress>; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    {
      name: editing?.name ?? '',
      target_amount: editing ? centsToDecimal(toCents(editing.target_amount)) : '',
      target_date: editing?.target_date ?? '',
      notes: editing?.notes ?? '',
    },
    { name: [required(), maxLength(120)], target_amount: [amount()], target_date: [isoDate(true)], notes: [maxLength(2000)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = {
      name: values.name.trim(),
      target_amount: asNumeric(parseAmount(values.target_amount) as number),
      target_date: values.target_date || null,
      notes: values.notes.trim(),
    };
    const ok = await run(() => (editing ? savingsGoals.update(editing.id, payload) : savingsGoals.create(payload)), editing ? 'Objetivo actualizado.' : 'Objetivo de ahorro creado.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar objetivo de ahorro' : 'Nuevo objetivo de ahorro'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Nombre" placeholder="Ej. Fondo de emergencia" value={v.name} error={form.errors.name} onChange={(e) => form.set('name', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Monto objetivo" inputMode="decimal" placeholder="0.00" value={v.target_amount} error={form.errors.target_amount} onChange={(e) => form.set('target_amount', e.target.value)} />
          <Input label="Fecha objetivo (opcional)" type="date" value={v.target_date} error={form.errors.target_date} onChange={(e) => form.set('target_date', e.target.value)} />
        </div>
        <Textarea label="Notas (opcional)" value={v.notes} error={form.errors.notes} onChange={(e) => form.set('notes', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

function ContributionForm({ goal, onClose, onSaved }: { goal: SavingsGoalProgress; onClose: () => void; onSaved: () => void }) {
  const { run, pending } = useAction();
  const form = useForm({ amount: '', contributed_on: todayISO(), notes: '' }, { amount: [amount()], contributed_on: [isoDate()], notes: [maxLength(500)] });
  const v = form.values;

  const save = form.submit(async (values) => {
    const ok = await run(
      () => savingsContributions.create({ goal_id: goal.id, amount: asNumeric(parseAmount(values.amount) as number), contributed_on: values.contributed_on, notes: values.notes.trim() }),
      'Aporte registrado.',
    );
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={`Aportar · ${goal.name}`} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Monto del aporte" inputMode="decimal" placeholder="0.00" value={v.amount} error={form.errors.amount} onChange={(e) => form.set('amount', e.target.value)} />
          <Input label="Fecha" type="date" value={v.contributed_on} error={form.errors.contributed_on} onChange={(e) => form.set('contributed_on', e.target.value)} />
        </div>
        <Input label="Nota (opcional)" value={v.notes} error={form.errors.notes} onChange={(e) => form.set('notes', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} submitLabel="Registrar aporte" />
      </form>
    </Modal>
  );
}

interface Props {
  goalsQuery: QueryState<SavingsGoalProgress[]>;
  contributionsQuery: QueryState<SavingsContribution[]>;
  onChanged: () => void;
}

export function SavingsTab({ goalsQuery, contributionsQuery, onChanged }: Props) {
  const currency = useCurrency();
  const editor = useEditor<SavingsGoalProgress>();
  const contributionEditor = useEditor<SavingsContribution>();
  const [contributing, setContributing] = useState<SavingsGoalProgress | null>(null);

  const list = goalsQuery.data ?? [];
  const targetCents = list.reduce((sum, g) => sum + toCents(g.target_amount), 0);
  const savedCents = list.reduce((sum, g) => sum + toCents(g.saved), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total ahorrado" value={formatMoney(savedCents, currency)} tone="accent" />
        <Stat label="Meta total" value={formatMoney(targetCents, currency)} />
        <Stat label="Avance global" value={`${percentOf(savedCents, targetCents)}%`} />
      </div>

      <Panel
        title="Objetivos de ahorro"
        flush
        actions={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={editor.openNew}>
            Nuevo objetivo
          </Button>
        }
      >
        <QueryView query={goalsQuery}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState icon={PiggyBank} title="Sin objetivos de ahorro" description="Define una meta y registra tus aportes. Los aportes no se cuentan como gasto." />
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((goal) => {
                  const saved = toCents(goal.saved);
                  const target = toCents(goal.target_amount);
                  const reached = saved >= target;
                  const contributions = (contributionsQuery.data ?? []).filter((c) => c.goal_id === goal.id);
                  return (
                    <li key={goal.id} className="px-4 py-4 sm:px-5">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{goal.name}</p>
                            {reached && <Badge tone="ok">Meta alcanzada</Badge>}
                          </div>
                          {goal.target_date && <p className="mt-0.5 text-sm text-ink-mute">Fecha objetivo: {formatDate(goal.target_date)}</p>}
                        </div>
                        <RowActions name={goal.name} onEdit={() => editor.openEdit(goal)} onDelete={() => editor.askDelete(goal)} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-ink-soft">
                        <span>
                          <span className="num text-ink">{formatMoney(saved, currency)}</span> de <span className="num">{formatMoney(target, currency)}</span>
                        </span>
                        <span className="num">{percentOf(saved, target)}%</span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar percent={percentOf(saved, target)} tone={reached ? 'ok' : 'accent'} label={`Avance de ${goal.name}`} />
                      </div>
                      {contributions.length > 0 && (
                        <ul className="mt-3 flex flex-col gap-1 border-l border-line pl-3" aria-label={`Aportes a ${goal.name}`}>
                          {contributions.map((c) => (
                            <li key={c.id} className="flex items-center gap-2 text-sm">
                              <span className="num w-28 shrink-0 text-ink">{formatMoney(toCents(c.amount), currency)}</span>
                              <span className="min-w-0 flex-1 truncate text-ink-mute">
                                {formatDate(c.contributed_on)}
                                {c.notes && ` · ${c.notes}`}
                              </span>
                              <RowActions name={`aporte del ${formatDate(c.contributed_on)}`} onDelete={() => contributionEditor.askDelete(c)} />
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button size="sm" className="mt-3" icon={<Plus className="size-4" />} onClick={() => setContributing(goal)}>
                        Aportar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )
          }
        </QueryView>
      </Panel>

      {editor.target && <GoalForm target={editor.target} onClose={editor.close} onSaved={onChanged} />}
      {contributing && <ContributionForm goal={contributing} onClose={() => setContributing(null)} onSaved={onChanged} />}
      <DeleteDialog row={editor.deleting} name={(g) => g.name} remove={(g) => savingsGoals.remove(g.id)} onDone={onChanged} onClose={editor.closeDelete} consequence="También se eliminarán sus aportes." />
      <DeleteDialog row={contributionEditor.deleting} name={(c) => `aporte del ${formatDate(c.contributed_on)}`} remove={(c) => savingsContributions.remove(c.id)} onDone={onChanged} onClose={contributionEditor.closeDelete} />
    </div>
  );
}
