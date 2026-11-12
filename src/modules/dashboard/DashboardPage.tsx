import { ArrowRight, CalendarClock, ClipboardCheck, Moon, Sun, Sunrise, Target, TreePalm, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, CHART, EmptyState, PageHeader, Panel, ProgressBar, QueryView, Stat, axisProps, tooltipProps } from '@/components/ui';
import { useAuth, useCurrency } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/cn';
import { WEEKDAY_LABELS, addDays, endOfMonth, formatDate, formatMinutes, formatMonth, minutesToHours, monthKeyOf, relativeDay, startOfMonth, toISODate, weekDates } from '@/lib/dates';
import { summarize } from '@/lib/finance';
import { PRIORITY_LABEL, PRIORITY_RANK, PRIORITY_TONE } from '@/lib/labels';
import { formatMoney, percentOf } from '@/lib/money';
import { SHIFT_KIND_LABEL, findNextShift, shiftDurationMinutes, trimTime, type ShiftKind } from '@/lib/shifts';
import { academicTasks, goals, habitLogs, habits, languageSessions, practiceSessions, transactions, workShifts } from '@/services';

const SHIFT_ICON: Record<ShiftKind, LucideIcon> = { day: Sun, night: Moon, custom: Sunrise, rest: TreePalm };

/** Everything the dashboard shows, loaded in parallel from the database. */
async function loadDashboard(today: string) {
  const month = monthKeyOf(today);
  const week = weekDates(today);
  const weekStart = week[0] as string;
  const weekEnd = week[6] as string;
  const [shifts, tasks, goalList, monthTx, practice, language, habitList, logs] = await Promise.all([
    // Yesterday is included because an overnight shift may still be in progress.
    workShifts.between(addDays(today, -1), addDays(today, 30)),
    academicTasks.list({ filter: (q) => q.neq('status', 'completed') }),
    goals.list(),
    transactions.list({ filter: (q) => q.gte('occurred_on', startOfMonth(month)).lte('occurred_on', endOfMonth(month)) }),
    practiceSessions.list({ filter: (q) => q.gte('session_date', weekStart).lte('session_date', weekEnd) }),
    languageSessions.list({ filter: (q) => q.gte('session_date', weekStart).lte('session_date', weekEnd) }),
    habits.list({ filter: (q) => q.eq('archived', false) }),
    habitLogs.between(today, today),
  ]);
  return { shifts, tasks, goalList, monthTx, practice, language, habitList, logs, week, month };
}

function greeting(hour: number): string {
  if (hour < 12) return 'Buenos días';
  return hour < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-accent hover:bg-raised">
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const currency = useCurrency();
  const now = new Date();
  const today = toISODate(now);
  const query = useQuery(() => loadDashboard(today), [today]);
  const firstName = profile?.full_name.trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader eyebrow="Command Center" title={`${greeting(now.getHours())}${firstName ? `, ${firstName}` : ''}`} description={formatDate(today, 'long').replace(/^./, (c) => c.toUpperCase())} />

      <QueryView query={query}>
        {(data) => {
          const next = findNextShift(data.shifts, now);
          const todayShifts = data.shifts.filter((s) => s.shift_date === today);
          const restToday = todayShifts.some((s) => s.kind === 'rest');
          const openTasks = [...data.tasks].sort((a, b) => a.due_date.localeCompare(b.due_date) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
          const overdue = openTasks.filter((t) => t.due_date < today);
          const dueToday = openTasks.filter((t) => t.due_date === today);
          const upcoming = openTasks.filter((t) => t.due_date >= today && t.due_date <= addDays(today, 14));
          const totals = summarize(data.monthTx);
          const habitsDone = new Set(data.logs.map((l) => l.habit_id)).size;
          const activity = data.week.map((date, i) => ({
            label: WEEKDAY_LABELS[i] as string,
            Práctica: minutesToHours(data.practice.filter((s) => s.session_date === date).reduce((sum, s) => sum + s.duration_minutes, 0)),
            Idiomas: minutesToHours(data.language.filter((s) => s.session_date === date).reduce((sum, s) => sum + s.duration_minutes, 0)),
            Trabajo: minutesToHours(
              data.shifts.filter((s) => s.shift_date === date && s.start_time && s.end_time).reduce((sum, s) => sum + shiftDurationMinutes(s.start_time as string, s.end_time as string), 0),
            ),
          }));
          const hasActivity = activity.some((d) => d.Práctica + d.Idiomas + d.Trabajo > 0);
          const NextIcon = next ? SHIFT_ICON[next.shift.kind] : CalendarClock;

          return (
            <div className="flex flex-col gap-5">
              {/* Resumen del día */}
              <section aria-label="Resumen del día" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Stat
                  label="Turno de hoy"
                  value={restToday ? 'Descanso' : todayShifts.length > 0 ? todayShifts.map((s) => trimTime(s.start_time)).join(' · ') : '—'}
                  detail={restToday ? 'Día libre' : todayShifts.length > 0 ? todayShifts.map((s) => SHIFT_KIND_LABEL[s.kind]).join(' · ') : 'Sin turno registrado'}
                  tone={todayShifts.length > 0 && !restToday ? 'accent' : 'default'}
                />
                <Stat label="Entregas hoy" value={dueToday.length} detail={overdue.length > 0 ? `${overdue.length} atrasada${overdue.length === 1 ? '' : 's'}` : 'Nada atrasado'} tone={overdue.length > 0 ? 'danger' : 'default'} />
                <Stat label="Hábitos hoy" value={`${habitsDone}/${data.habitList.length}`} detail={data.habitList.length === 0 ? 'Sin hábitos activos' : 'completados'} tone={data.habitList.length > 0 && habitsDone === data.habitList.length ? 'ok' : 'default'} />
                <Stat label={`Balance · ${formatMonth(data.month, 'short')}`} value={formatMoney(totals.balanceCents, currency)} detail="Ingresos − gastos" tone={totals.balanceCents < 0 ? 'danger' : 'ok'} />
              </section>

              <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Próximo turno" actions={<MoreLink to="/work">Turnos</MoreLink>}>
                  {next ? (
                    <div className="flex items-start gap-4">
                      <span className={cn('inline-flex size-12 shrink-0 items-center justify-center rounded-xl border', next.shift.kind === 'night' ? 'border-violet/40 text-violet' : 'border-accent/40 text-accent')}>
                        <NextIcon className="size-6" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="num text-2xl font-semibold">
                          {trimTime(next.shift.start_time)} – {trimTime(next.shift.end_time)}
                        </p>
                        <p className="mt-0.5 text-ink-soft first-letter:uppercase">
                          {formatDate(next.shift.shift_date, 'weekday')} · <span>{SHIFT_KIND_LABEL[next.shift.kind]}</span>
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone={next.status === 'in_progress' ? 'ok' : 'accent'}>{next.status === 'in_progress' ? 'En curso' : relativeDay(next.shift.shift_date, today)}</Badge>
                          <span className="num text-sm text-ink-mute">{formatMinutes(shiftDurationMinutes(next.shift.start_time as string, next.shift.end_time as string))}</span>
                          {toISODate(next.end) !== next.shift.shift_date && <span className="text-sm text-violet">termina el día siguiente</span>}
                        </div>
                        {next.shift.label && <p className="mt-2 truncate text-sm text-ink-mute">{next.shift.label}</p>}
                      </div>
                    </div>
                  ) : (
                    <EmptyState icon={CalendarClock} title="Sin turnos próximos" description="No hay turnos registrados en los próximos 30 días." />
                  )}
                </Panel>

                <Panel title={`Finanzas · ${formatMonth(data.month)}`} actions={<MoreLink to="/finance">Finanzas</MoreLink>}>
                  <dl className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-ink-soft">Ingresos</dt>
                      <dd className="num font-medium text-ok">{formatMoney(totals.incomeCents, currency)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-ink-soft">Gastos</dt>
                      <dd className="num font-medium text-danger">{formatMoney(totals.expenseCents, currency)}</dd>
                    </div>
                    <ProgressBar percent={percentOf(totals.expenseCents, totals.incomeCents)} tone={totals.expenseCents > totals.incomeCents ? 'danger' : 'accent'} label="Gastos como porcentaje de los ingresos" />
                    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                      <dt className="font-medium">Balance</dt>
                      <dd className={cn('num text-lg font-semibold', totals.balanceCents < 0 ? 'text-danger' : 'text-ink')}>{formatMoney(totals.balanceCents, currency)}</dd>
                    </div>
                  </dl>
                </Panel>

                <Panel title="Progreso de objetivos" actions={<MoreLink to="/goals">Metas</MoreLink>}>
                  {data.goalList.length === 0 ? (
                    <EmptyState icon={Target} title="Sin objetivos" description="Crea un objetivo para seguir su avance aquí." />
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {data.goalList.slice(0, 4).map((goal) => {
                        const percent = percentOf(Number(goal.current_value), Number(goal.target_value));
                        return (
                          <li key={goal.id}>
                            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                              <span className="truncate text-ink">{goal.title}</span>
                              <span className="num shrink-0 text-ink-soft">{percent}%</span>
                            </div>
                            <ProgressBar percent={percent} tone={percent >= 100 ? 'ok' : 'accent'} label={`Avance de ${goal.title}`} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title={`Tareas pendientes (${openTasks.length})`} flush actions={<MoreLink to="/academic">Académico</MoreLink>}>
                  {openTasks.length === 0 ? (
                    <EmptyState icon={ClipboardCheck} title="Todo al día" description="No tienes actividades pendientes." />
                  ) : (
                    <ul className="divide-y divide-line">
                      {openTasks.slice(0, 5).map((task) => (
                        <li key={task.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{task.title}</p>
                            <p className={cn('num text-sm', task.due_date < today ? 'text-danger' : 'text-ink-mute')}>
                              {formatDate(task.due_date, 'short')} · {relativeDay(task.due_date, today)}
                            </p>
                          </div>
                          <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Próximas entregas · 14 días" flush actions={<MoreLink to="/academic">Ver todas</MoreLink>}>
                  {upcoming.length === 0 ? (
                    <EmptyState icon={CalendarClock} title="Sin entregas próximas" description="Nada vence en las próximas dos semanas." />
                  ) : (
                    <ul className="divide-y divide-line">
                      {upcoming.slice(0, 5).map((task) => (
                        <li key={task.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                          <span className="num w-16 shrink-0 text-sm text-accent">{formatDate(task.due_date, 'short')}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{task.title}</p>
                            {task.course && <p className="truncate text-sm text-ink-mute">{task.course}</p>}
                          </div>
                          <span className="shrink-0 text-sm text-ink-soft">{relativeDay(task.due_date, today)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <Panel title="Actividad semanal · horas por día">
                {hasActivity ? (
                  <div className="h-64 w-full" role="img" aria-label="Horas de trabajo, práctica e idiomas por día de esta semana">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activity} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke={CHART.grid} vertical={false} />
                        <XAxis dataKey="label" {...axisProps} />
                        <YAxis {...axisProps} allowDecimals={false} unit=" h" width={56} />
                        <Tooltip {...tooltipProps} formatter={(value, name) => [formatMinutes(Math.round(Number(value) * 60)), name]} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
                        <Bar isAnimationActive={false} dataKey="Trabajo" stackId="a" fill={CHART.series[5]} maxBarSize={40} />
                        <Bar isAnimationActive={false} dataKey="Práctica" stackId="a" fill={CHART.accent} maxBarSize={40} />
                        <Bar isAnimationActive={false} dataKey="Idiomas" stackId="a" fill={CHART.violet} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState icon={CalendarClock} title="Sin actividad esta semana" description="Los turnos y las sesiones de práctica e idiomas de la semana aparecerán aquí." />
                )}
              </Panel>
            </div>
          );
        }}
      </QueryView>
    </>
  );
}
