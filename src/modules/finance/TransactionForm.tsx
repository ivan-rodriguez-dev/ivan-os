import { FormActions, Input, Modal, Select, type EditorTarget } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { todayISO } from '@/lib/dates';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/finance';
import { centsToDecimal, parseAmount, toCents } from '@/lib/money';
import { amount, isoDate, maxLength, required } from '@/lib/validation';
import { transactions } from '@/services';
import type { FinancialTransaction } from '@/types/database';

type TxType = FinancialTransaction['type'];

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
] as const;

const categoriesFor = (type: TxType, current?: string): string[] => {
  const base: readonly string[] = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return current && !base.includes(current) ? [current, ...base] : [...base];
};

interface Props {
  target: EditorTarget<FinancialTransaction>;
  defaultType?: TxType;
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function TransactionForm({ target, defaultType = 'expense', defaultDate, onClose, onSaved }: Props) {
  const editing = target.mode === 'edit' ? target.row : null;
  const isDebtPayment = Boolean(editing?.debt_id);
  const { run, pending } = useAction();
  const initialType = editing?.type ?? defaultType;
  const form = useForm(
    {
      type: initialType as TxType,
      amount: editing ? centsToDecimal(toCents(editing.amount)) : '',
      category: editing?.category ?? (categoriesFor(initialType)[0] as string),
      occurred_on: editing?.occurred_on ?? defaultDate ?? todayISO(),
      description: editing?.description ?? '',
    },
    { amount: [amount()], category: [required()], occurred_on: [isoDate()], description: [maxLength(500)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = {
      type: values.type,
      // Sent as an exact decimal string; Postgres stores it as numeric(14,2).
      amount: centsToDecimal(parseAmount(values.amount) as number) as unknown as number,
      category: values.category,
      occurred_on: values.occurred_on,
      description: values.description.trim(),
    };
    const ok = await run(() => (editing ? transactions.update(editing.id, payload) : transactions.create(payload)), editing ? 'Movimiento actualizado.' : 'Movimiento registrado.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? (isDebtPayment ? 'Editar pago de deuda' : 'Editar movimiento') : 'Nuevo movimiento'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        {!isDebtPayment && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Tipo"
              value={v.type}
              options={TYPE_OPTIONS}
              onChange={(e) => {
                const type = e.target.value as TxType;
                form.setValues((prev) => ({ ...prev, type, category: categoriesFor(type)[0] as string }));
              }}
            />
            <Select label="Categoría" value={v.category} error={form.errors.category} options={categoriesFor(v.type, editing?.category).map((c) => ({ value: c, label: c }))} onChange={(e) => form.set('category', e.target.value)} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Monto" inputMode="decimal" placeholder="0.00" value={v.amount} error={form.errors.amount} onChange={(e) => form.set('amount', e.target.value)} />
          <Input label="Fecha" type="date" value={v.occurred_on} error={form.errors.occurred_on} onChange={(e) => form.set('occurred_on', e.target.value)} />
        </div>
        <Input label="Descripción (opcional)" value={v.description} error={form.errors.description} onChange={(e) => form.set('description', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}
