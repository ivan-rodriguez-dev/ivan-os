import { HandCoins, Landmark, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, DeleteDialog, EmptyState, FormActions, Input, Modal, Panel, ProgressBar, QueryView, RowActions, Stat, Textarea, useEditor, type EditorTarget } from '@/components/ui';
import { useCurrency } from '@/context/AuthContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import type { QueryState } from '@/hooks/useQuery';
import { formatDate, todayISO } from '@/lib/dates';
import { DEBT_PAYMENT_CATEGORY } from '@/lib/finance';
import { centsToDecimal, formatMoney, parseAmount, percentOf, toCents } from '@/lib/money';
import { amount, isoDate, maxLength, required, type Rule } from '@/lib/validation';
import { debts, transactions } from '@/services';
import type { DebtBalance, FinancialTransaction } from '@/types/database';

const asNumeric = (cents: number) => centsToDecimal(cents) as unknown as number;

function DebtForm({ target, onClose, onSaved }: { target: EditorTarget<DebtBalance>; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const currency = useCurrency();
  const { run, pending } = useAction();
  const paidCents = toCents(editing?.paid);
  const notBelowPaid: Rule<unknown> = (value) => {
    const cents = parseAmount(String(value));
    return cents !== null && cents < paidCents ? `No puede ser menor que lo ya pagado (${formatMoney(paidCents, currency)})` : null;
  };
  const form = useForm(
    {
      name: editing?.name ?? '',
      creditor: editing?.creditor ?? '',
      principal: editing ? centsToDecimal(toCents(editing.principal)) : '',
      due_date: editing?.due_date ?? '',
      notes: editing?.notes ?? '',
    },
    { name: [required(), maxLength(120)], creditor: [maxLength(120)], principal: [amount(), notBelowPaid], due_date: [isoDate(true)], notes: [maxLength(2000)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = {
      name: values.name.trim(),
      creditor: values.creditor.trim(),
      principal: asNumeric(parseAmount(values.principal) as number),
      due_date: values.due_date || null,
      notes: values.notes.trim(),
    };
    const ok = await run(() => (editing ? debts.update(editing.id, payload) : debts.create(payload)), editing ? 'Deuda actualizada.' : 'Deuda registrada.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar deuda' : 'Nueva deuda'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Nombre" placeholder="Ej. Crédito del computador" value={v.name} error={form.errors.name} onChange={(e) => form.set('name', e.target.value)} />
        <Input label="Acreedor (opcional)" value={v.creditor} error={form.errors.creditor} onChange={(e) => form.set('creditor', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Monto total" inputMode="decimal" placeholder="0.00" value={v.principal} error={form.errors.principal} onChange={(e) => form.set('principal', e.target.value)} />
          <Input label="Fecha límite (opcional)" type="date" value={v.due_date} error={form.errors.due_date} onChange={(e) => form.set('due_date', e.target.value)} />
        </div>
        <Textarea label="Notas (opcional)" value={v.notes} error={form.errors.notes} onChange={(e) => form.set('notes', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

function PaymentForm({ debt, onClose, onSaved }: { debt: DebtBalance; onClose: () => void; onSaved: () => void }) {
  const currency = useCurrency();
  const { run, pending } = useAction();
  const remainingCents = toCents(debt.remaining);
  const notAboveRemaining: Rule<unknown> = (value) => {
    const cents = parseAmount(String(value));
    return cents !== null && cents > remainingCents ? `El pago supera el saldo pendiente (${formatMoney(remainingCents, currency)})` : null;
  };
  const form = useForm(
    { amount: '', occurred_on: todayISO(), description: '' },
    { amount: [amount(), notAboveRemaining], occurred_on: [isoDate()], description: [maxLength(500)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const ok = await run(
      () =>
        transactions.create({
          type: 'expense',
          amount: asNumeric(parseAmount(values.amount) as number),
          category: DEBT_PAYMENT_CATEGORY,
          occurred_on: values.occurred_on,
          description: values.description.trim() || `Pago: ${debt.name}`,
          debt_id: debt.id,
        }),
      'Pago registrado.',
    );
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={`Registrar pago · ${debt.name}`} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <p className="rounded-lg border border-line bg-void px-3 py-2 text-sm text-ink-soft">
          Saldo pendiente: <span className="num text-ink">{formatMoney(remainingCents, currency)}</span>. El pago se registra también como gasto del mes.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Monto del pago" inputMode="decimal" placeholder="0.00" value={v.amount} error={form.errors.amount} onChange={(e) => form.set('amount', e.target.value)} />
          <Input label="Fecha" type="date" value={v.occurred_on} error={form.errors.occurred_on} onChange={(e) => form.set('occurred_on', e.target.value)} />
        </div>
        <Input label="Descripción (opcional)" value={v.description} error={form.errors.description} onChange={(e) => form.set('description', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} submitLabel="Registrar pago" />
      </form>
    </Modal>
  );
}

interface Props {
  debtsQuery: QueryState<DebtBalance[]>;
  paymentsQuery: QueryState<FinancialTransaction[]>;
  onChanged: () => void;
}

export function DebtsTab({ debtsQuery, paymentsQuery, onChanged }: Props) {
  const currency = useCurrency();
  const editor = useEditor<DebtBalance>();
  const paymentEditor = useEditor<FinancialTransaction>();
  const [paying, setPaying] = useState<DebtBalance | null>(null);

  const list = debtsQuery.data ?? [];
  const totalCents = list.reduce((sum, d) => sum + toCents(d.principal), 0);
  const paidCents = list.reduce((sum, d) => sum + toCents(d.paid), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Deuda pendiente" value={formatMoney(totalCents - paidCents, currency)} tone={totalCents - paidCents > 0 ? 'danger' : 'ok'} />
        <Stat label="Total pagado" value={formatMoney(paidCents, currency)} tone="ok" />
        <Stat label="Deuda original" value={formatMoney(totalCents, currency)} />
      </div>

      <Panel
        title="Deudas"
        flush
        actions={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={editor.openNew}>
            Nueva deuda
          </Button>
        }
      >
        <QueryView query={debtsQuery}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState icon={Landmark} title="Sin deudas registradas" description="Registra una deuda y sus pagos para ver cuánto falta." />
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((debt) => {
                  const remaining = toCents(debt.remaining);
                  const settled = remaining === 0;
                  const payments = (paymentsQuery.data ?? []).filter((p) => p.debt_id === debt.id);
                  return (
                    <li key={debt.id} className="px-4 py-4 sm:px-5">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{debt.name}</p>
                            {settled ? <Badge tone="ok">Pagada</Badge> : debt.due_date && debt.due_date < todayISO() ? <Badge tone="danger">Vencida</Badge> : null}
                          </div>
                          <p className="mt-0.5 text-sm text-ink-mute">{[debt.creditor, debt.due_date && `vence ${formatDate(debt.due_date)}`].filter(Boolean).join(' · ') || 'Sin acreedor'}</p>
                        </div>
                        <RowActions name={debt.name} onEdit={() => editor.openEdit(debt)} onDelete={() => editor.askDelete(debt)} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                        <span className="text-ink-soft">
                          Pagado <span className="num text-ink">{formatMoney(toCents(debt.paid), currency)}</span> de <span className="num">{formatMoney(toCents(debt.principal), currency)}</span>
                        </span>
                        <span className="text-ink-soft">
                          Pendiente <span className={`num font-medium ${settled ? 'text-ok' : 'text-ink'}`}>{formatMoney(remaining, currency)}</span>
                        </span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar percent={percentOf(toCents(debt.paid), toCents(debt.principal))} tone="ok" label={`Pagado de ${debt.name}`} />
                      </div>
                      {payments.length > 0 && (
                        <ul className="mt-3 flex flex-col gap-1 border-l border-line pl-3" aria-label={`Pagos de ${debt.name}`}>
                          {payments.map((payment) => (
                            <li key={payment.id} className="flex items-center gap-2 text-sm">
                              <span className="num w-28 shrink-0 text-ink">{formatMoney(toCents(payment.amount), currency)}</span>
                              <span className="min-w-0 flex-1 truncate text-ink-mute">{formatDate(payment.occurred_on)}</span>
                              <RowActions name={`pago del ${formatDate(payment.occurred_on)}`} onDelete={() => paymentEditor.askDelete(payment)} />
                            </li>
                          ))}
                        </ul>
                      )}
                      {!settled && (
                        <Button size="sm" className="mt-3" icon={<HandCoins className="size-4" />} onClick={() => setPaying(debt)}>
                          Registrar pago
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          }
        </QueryView>
      </Panel>

      {editor.target && <DebtForm target={editor.target} onClose={editor.close} onSaved={onChanged} />}
      {paying && <PaymentForm debt={paying} onClose={() => setPaying(null)} onSaved={onChanged} />}
      <DeleteDialog row={editor.deleting} name={(d) => d.name} remove={(d) => debts.remove(d.id)} onDone={onChanged} onClose={editor.closeDelete} consequence="Sus pagos se conservan como gastos en el historial." />
      <DeleteDialog row={paymentEditor.deleting} name={(p) => `pago del ${formatDate(p.occurred_on)}`} remove={(p) => transactions.remove(p.id)} onDone={onChanged} onClose={paymentEditor.closeDelete} consequence="El saldo de la deuda y el balance del mes se recalcularán." />
    </div>
  );
}
