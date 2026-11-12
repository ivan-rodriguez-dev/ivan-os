import { monthKeyOf, type MonthKey } from './dates';
import { percentOf, toCents } from './money';

export interface TransactionLike {
  type: 'income' | 'expense';
  amount: number | string;
  category: string;
  occurred_on: string;
}

export interface Totals {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

export function summarize(transactions: TransactionLike[]): Totals {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const t of transactions) {
    if (t.type === 'income') incomeCents += toCents(t.amount);
    else expenseCents += toCents(t.amount);
  }
  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents };
}

export interface CategoryTotal {
  category: string;
  cents: number;
  percent: number;
}

/** Expense totals per category, largest first. */
export function expensesByCategory(transactions: TransactionLike[]): CategoryTotal[] {
  const totals = new Map<string, number>();
  let all = 0;
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const cents = toCents(t.amount);
    totals.set(t.category, (totals.get(t.category) ?? 0) + cents);
    all += cents;
  }
  return [...totals.entries()]
    .map(([category, cents]) => ({ category, cents, percent: percentOf(cents, all) }))
    .sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category));
}

/** Income/expense/balance for each requested month (months without movements are zero). */
export function monthlyTotals(transactions: TransactionLike[], months: MonthKey[]): (Totals & { month: MonthKey })[] {
  return months.map((month) => ({
    month,
    ...summarize(transactions.filter((t) => monthKeyOf(t.occurred_on) === month)),
  }));
}

export const INCOME_CATEGORIES = ['Salario', 'Horas extra', 'Freelance', 'Apoyo SENA', 'Ventas', 'Otros ingresos'] as const;
export const EXPENSE_CATEGORIES = [
  'Vivienda',
  'Alimentación',
  'Transporte',
  'Servicios',
  'Educación',
  'Salud',
  'Ocio',
  'Tecnología',
  'Otros gastos',
] as const;
export const DEBT_PAYMENT_CATEGORY = 'Pago de deuda';
