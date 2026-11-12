import { describe, expect, it } from 'vitest';
import { expensesByCategory, monthlyTotals, summarize, type TransactionLike } from './finance';

const tx = (type: 'income' | 'expense', amount: number | string, category: string, occurred_on: string): TransactionLike => ({ type, amount, category, occurred_on });

const DATA: TransactionLike[] = [
  tx('income', 2000000, 'Salario', '2026-11-01'),
  tx('income', '150000.50', 'Freelance', '2026-11-15'),
  tx('expense', 800000, 'Vivienda', '2026-11-02'),
  tx('expense', 0.1, 'Transporte', '2026-11-03'),
  tx('expense', 0.2, 'Transporte', '2026-11-04'),
  tx('expense', 199999.7, 'Alimentación', '2026-11-05'),
  tx('income', 500, 'Ventas', '2026-10-31'),
  tx('expense', 700, 'Ocio', '2026-10-01'),
];

describe('summarize', () => {
  it('adds income and expense exactly in cents', () => {
    const nov = DATA.filter((t) => t.occurred_on.startsWith('2026-11'));
    expect(summarize(nov)).toEqual({ incomeCents: 215000050, expenseCents: 100000000, balanceCents: 115000050 });
  });
  it('is zero for no transactions and negative when overspending', () => {
    expect(summarize([])).toEqual({ incomeCents: 0, expenseCents: 0, balanceCents: 0 });
    expect(summarize([tx('expense', 10, 'x', '2026-01-01')]).balanceCents).toBe(-1000);
  });
});

describe('expensesByCategory', () => {
  it('groups expenses, ignores income, sorts by amount', () => {
    const result = expensesByCategory(DATA.filter((t) => t.occurred_on.startsWith('2026-11')));
    expect(result).toEqual([
      { category: 'Vivienda', cents: 80000000, percent: 80 },
      { category: 'Alimentación', cents: 19999970, percent: 20 },
      { category: 'Transporte', cents: 30, percent: 0 },
    ]);
    expect(result.reduce((sum, c) => sum + c.cents, 0)).toBe(100000000);
  });
});

describe('monthlyTotals', () => {
  it('buckets by month and fills empty months with zeros', () => {
    const result = monthlyTotals(DATA, ['2026-09', '2026-10', '2026-11']);
    expect(result[0]).toEqual({ month: '2026-09', incomeCents: 0, expenseCents: 0, balanceCents: 0 });
    expect(result[1]).toEqual({ month: '2026-10', incomeCents: 50000, expenseCents: 70000, balanceCents: -20000 });
    expect(result[2]?.balanceCents).toBe(115000050);
  });
});
