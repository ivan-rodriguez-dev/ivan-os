import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, CHART, DeleteDialog, EmptyState, IconButton, PageHeader, Panel, ProgressBar, QueryView, RowActions, Stat, Tabs, axisProps, tooltipProps, useEditor } from '@/components/ui';
import { useCurrency } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/cn';
import { addMonths, endOfMonth, formatDate, formatMonth, monthKeyOf, startOfMonth, todayISO } from '@/lib/dates';
import { expensesByCategory, monthlyTotals, summarize } from '@/lib/finance';
import { formatMoney, toCents } from '@/lib/money';
import { debtBalances, savingsContributions, savingsProgress, transactions } from '@/services';
import type { FinancialTransaction } from '@/types/database';
import { DebtsTab } from './DebtsTab';
import { SavingsTab } from './SavingsTab';
import { TransactionForm } from './TransactionForm';

type Tab = 'movements' | 'debts' | 'savings';
type TypeFilter = 'all' | 'income' | 'expense';

const TREND_MONTHS = 6;

export default function FinancePage() {
  const currency = useCurrency();
  const currentMonth = monthKeyOf(todayISO());
  const [tab, setTab] = useState<Tab>('movements');
  const [month, setMonth] = useState(currentMonth);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const editor = useEditor<FinancialTransaction>();

  const trendMonths = useMemo(() => Array.from({ length: TREND_MONTHS }, (_, i) => addMonths(month, i - TREND_MONTHS + 1)), [month]);
  const rangeStart = startOfMonth(trendMonths[0] as string);
  const rangeEnd = endOfMonth(month);

  // One query feeds both the selected month and the 6-month trend.
  const txQuery = useQuery(
    () => transactions.list({ filter: (q) => q.gte('occurred_on', rangeStart).lte('occurred_on', rangeEnd).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }), orderBy: undefined }),
    [rangeStart, rangeEnd],
  );
  const debtsQuery = useQuery(() => debtBalances.list(), []);
  const paymentsQuery = useQuery(() => transactions.list({ filter: (q) => q.not('debt_id', 'is', null) }), []);
  const savingsQuery = useQuery(() => savingsProgress.list(), []);
  const contributionsQuery = useQuery(() => savingsContributions.list(), []);

  const reloadMoney = () => {
    void txQuery.reload();
    void debtsQuery.reload();
    void paymentsQuery.reload();
  };
  const reloadSavings = () => {
    void savingsQuery.reload();
    void contributionsQuery.reload();
  };

  const all = useMemo(() => txQuery.data ?? [], [txQuery.data]);
  const monthTx = useMemo(() => all.filter((t) => monthKeyOf(t.occurred_on) === month), [all, month]);
  const totals = useMemo(() => summarize(monthTx), [monthTx]);
  const categories = useMemo(() => expensesByCategory(monthTx), [monthTx]);
  const trend = useMemo(
    () => monthlyTotals(all, trendMonths).map((m) => ({ label: formatMonth(m.month, 'short'), Ingresos: m.incomeCents / 100, Gastos: m.expenseCents / 100 })),
    [all, trendMonths],
  );
  const visible = typeFilter === 'all' ? monthTx : monthTx.filter((t) => t.type === typeFilter);
  const money = (cents: number) => formatMoney(cents, currency);
  const defaultDate = month === currentMonth ? todayISO() : startOfMonth(month);

  return (
    <>
      <PageHeader
        eyebrow="Financial Control"
        title="Finanzas personales"
        description="Ingresos, gastos, deudas y ahorro. Solo registro: no se conecta a ningún banco."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={editor.openNew}>
            Nuevo movimiento
          </Button>
        }
      />
      <Tabs<Tab>
        label="Secciones financieras"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'movements', label: 'Movimientos' },
          { value: 'debts', label: 'Deudas' },
          { value: 'savings', label: 'Ahorro' },
        ]}
      />

      {tab === 'movements' && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-panel px-2 py-1.5">
            <IconButton label="Mes anterior" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <h2 className="font-semibold" aria-live="polite">
              {formatMonth(month)}
            </h2>
            <IconButton label="Mes siguiente" disabled={month >= currentMonth} onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight className="size-5" />
            </IconButton>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Ingresos" value={money(totals.incomeCents)} tone="ok" />
            <Stat label="Gastos" value={money(totals.expenseCents)} tone="danger" />
            <Stat label="Balance del mes" value={money(totals.balanceCents)} tone={totals.balanceCents < 0 ? 'danger' : 'accent'} detail="Ingresos − gastos" />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Gastos por categoría">
              <QueryView query={txQuery}>
                {() =>
                  categories.length === 0 ? (
                    <EmptyState icon={Receipt} title="Sin gastos este mes" />
                  ) : (
                    <ul className="flex flex-col gap-3.5">
                      {categories.map((c) => (
                        <li key={c.category}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate text-ink">{c.category}</span>
                            <span className="num shrink-0 text-ink-soft">
                              {money(c.cents)} · {c.percent}%
                            </span>
                          </div>
                          <ProgressBar percent={c.percent} tone="danger" label={`${c.category}: ${c.percent}% de los gastos`} />
                        </li>
                      ))}
                    </ul>
                  )
                }
              </QueryView>
            </Panel>
            <Panel title={`Ingresos y gastos · ${TREND_MONTHS} meses`}>
              <div className="h-60 w-full" role="img" aria-label="Ingresos y gastos de los últimos seis meses">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} width={64} tickFormatter={(value: number) => new Intl.NumberFormat('es-CO', { notation: 'compact' }).format(value)} />
                    <Tooltip {...tooltipProps} formatter={(value, name) => [money(Math.round(Number(value) * 100)), name]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
                    <Bar isAnimationActive={false} dataKey="Ingresos" fill={CHART.ok} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar isAnimationActive={false} dataKey="Gastos" fill={CHART.danger} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <Panel flush>
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5 sm:px-5">
              <h2 className="label text-ink-soft">Movimientos</h2>
              <div className="flex gap-1" role="group" aria-label="Filtrar movimientos">
                {(
                  [
                    ['all', 'Todos'],
                    ['income', 'Ingresos'],
                    ['expense', 'Gastos'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={typeFilter === value}
                    onClick={() => setTypeFilter(value)}
                    className={cn('h-8 rounded-lg border px-2.5 text-sm font-medium transition-colors', typeFilter === value ? 'border-accent/60 bg-accent/10 text-accent' : 'border-transparent text-ink-mute hover:text-ink')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <QueryView query={txQuery}>
              {() =>
                visible.length === 0 ? (
                  <EmptyState icon={Receipt} title="Sin movimientos" description="Registra un ingreso o un gasto para ver el balance del mes." />
                ) : (
                  <ul className="divide-y divide-line">
                    {visible.map((tx) => {
                      const income = tx.type === 'income';
                      return (
                        <li key={tx.id} className="flex items-center gap-3 px-3 py-3 sm:px-5">
                          <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-lg border', income ? 'border-ok/30 text-ok' : 'border-danger/30 text-danger')}>
                            {income ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownRight className="size-4" aria-hidden />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{tx.description || tx.category}</p>
                            <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-mute">
                              {formatDate(tx.occurred_on, 'short')} · {tx.category}
                              {tx.debt_id && <Badge>Deuda</Badge>}
                            </p>
                          </div>
                          <span className={cn('num shrink-0 font-medium', income ? 'text-ok' : 'text-ink')}>
                            {income ? '+' : '−'}
                            {money(toCents(tx.amount))}
                          </span>
                          <RowActions name={tx.description || tx.category} onEdit={() => editor.openEdit(tx)} onDelete={() => editor.askDelete(tx)} />
                        </li>
                      );
                    })}
                  </ul>
                )
              }
            </QueryView>
          </Panel>
        </div>
      )}

      {tab === 'debts' && <DebtsTab debtsQuery={debtsQuery} paymentsQuery={paymentsQuery} onChanged={reloadMoney} />}
      {tab === 'savings' && <SavingsTab goalsQuery={savingsQuery} contributionsQuery={contributionsQuery} onChanged={reloadSavings} />}

      {editor.target && <TransactionForm target={editor.target} defaultDate={defaultDate} onClose={editor.close} onSaved={reloadMoney} />}
      <DeleteDialog row={editor.deleting} name={(t) => t.description || t.category} remove={(t) => transactions.remove(t.id)} onDone={reloadMoney} onClose={editor.closeDelete} />
    </>
  );
}
