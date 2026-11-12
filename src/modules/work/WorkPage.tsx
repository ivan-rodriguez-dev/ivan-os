import { CalendarDays, ChevronLeft, ChevronRight, Moon, Plus, Sun, Sunrise, TreePalm } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, DeleteDialog, EmptyState, IconButton, PageHeader, Panel, QueryView, Stat, Tabs, useEditor } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/cn';
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  endOfMonth,
  formatDate,
  formatMinutes,
  formatMonth,
  monthGrid,
  monthKeyOf,
  parseISODate,
  startOfMonth,
  todayISO,
  weekDates,
} from '@/lib/dates';
import { SHIFT_KIND_LABEL, isOvernight, shiftDurationMinutes, totalShiftMinutes, trimTime, type ShiftKind } from '@/lib/shifts';
import { shiftRotations, shiftTemplates, workShifts } from '@/services';
import type { WorkShift } from '@/types/database';
import { RotationsPanel } from './RotationsPanel';
import { ShiftForm } from './ShiftForm';
import { TemplatesPanel } from './TemplatesPanel';

type Tab = 'calendar' | 'templates' | 'rotations';
type View = 'month' | 'week';

const KIND_STYLE: Record<ShiftKind, { chip: string; icon: typeof Sun }> = {
  day: { chip: 'border-accent/40 bg-accent/10 text-accent', icon: Sun },
  night: { chip: 'border-violet/40 bg-violet/10 text-violet', icon: Moon },
  custom: { chip: 'border-warn/40 bg-warn/10 text-warn', icon: Sunrise },
  rest: { chip: 'border-line-strong bg-raised text-ink-soft', icon: TreePalm },
};

const shiftTimes = (shift: WorkShift) =>
  shift.kind === 'rest' || !shift.start_time || !shift.end_time ? 'Descanso' : `${trimTime(shift.start_time)}–${trimTime(shift.end_time)}`;

function describeShift(shift: WorkShift): string {
  const base = `${SHIFT_KIND_LABEL[shift.kind]}, ${formatDate(shift.shift_date, 'weekday')}`;
  return shift.kind === 'rest' ? base : `${base}, ${shiftTimes(shift)}`;
}

function ShiftChip({ shift, compact, onClick }: { shift: WorkShift; compact: boolean; onClick: () => void }) {
  const style = KIND_STYLE[shift.kind];
  const overnight = shift.start_time && shift.end_time ? isOvernight(shift.start_time, shift.end_time) : false;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={`Editar turno: ${describeShift(shift)}`}
      className={cn('flex w-full min-w-0 items-center gap-1.5 rounded-md border text-left transition-colors hover:brightness-125', style.chip, compact ? 'justify-center px-0.5 py-0.5 text-[0.62rem] tracking-tighter sm:justify-start sm:px-1.5 sm:text-xs sm:tracking-normal' : 'px-3 py-2 text-sm')}
    >
      <style.icon className={cn('shrink-0', compact ? 'hidden size-3 sm:block' : 'size-4')} aria-hidden />
      <span className="num truncate">
        {compact ? (shift.kind === 'rest' ? 'Libre' : trimTime(shift.start_time)) : shiftTimes(shift)}
        {overnight && <sup className={cn('ml-0.5', compact && 'hidden sm:inline')}>+1</sup>}
      </span>
      {!compact && shift.label && <span className="truncate text-ink-soft">· {shift.label}</span>}
      {!compact && shift.start_time && shift.end_time && (
        <span className="num ml-auto shrink-0 text-ink-soft">{formatMinutes(shiftDurationMinutes(shift.start_time, shift.end_time))}</span>
      )}
    </button>
  );
}

export default function WorkPage() {
  const today = todayISO();
  const [tab, setTab] = useState<Tab>('calendar');
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(today); // any date inside the visible period
  const [newDate, setNewDate] = useState(today);
  const editor = useEditor<WorkShift>();

  const month = monthKeyOf(cursor);
  const days = useMemo(() => (view === 'month' ? monthGrid(month) : weekDates(cursor)), [view, month, cursor]);
  const rangeStart = days[0] as string;
  const rangeEnd = days[days.length - 1] as string;
  const periodStart = view === 'month' ? startOfMonth(month) : rangeStart;
  const periodEnd = view === 'month' ? endOfMonth(month) : rangeEnd;

  const shiftsQuery = useQuery(() => workShifts.between(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const templatesQuery = useQuery(() => shiftTemplates.list(), []);
  const rotationsQuery = useQuery(() => shiftRotations.list(), []);
  const reloadShifts = () => void shiftsQuery.reload();

  const byDate = useMemo(() => {
    const map = new Map<string, WorkShift[]>();
    for (const shift of shiftsQuery.data ?? []) map.set(shift.shift_date, [...(map.get(shift.shift_date) ?? []), shift]);
    return map;
  }, [shiftsQuery.data]);

  const inPeriod = (shiftsQuery.data ?? []).filter((s) => s.shift_date >= periodStart && s.shift_date <= periodEnd);
  const worked = inPeriod.filter((s) => s.kind !== 'rest');

  const move = (direction: -1 | 1) => setCursor(view === 'month' ? startOfMonth(addMonths(month, direction)) : addDays(cursor, direction * 7));
  const openNew = (date: string) => {
    setNewDate(date);
    editor.openNew();
  };

  const periodLabel = view === 'month' ? formatMonth(month) : `${formatDate(rangeStart, 'short')} – ${formatDate(rangeEnd, 'medium')}`;

  return (
    <>
      <PageHeader
        eyebrow="Work & Schedule"
        title="Turnos y horarios"
        description="Registra turnos diurnos y nocturnos, días de descanso y rotaciones completas."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openNew(today)}>
            Nuevo turno
          </Button>
        }
      />
      <Tabs<Tab>
        label="Secciones de turnos"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'calendar', label: 'Calendario' },
          { value: 'templates', label: 'Horarios' },
          { value: 'rotations', label: 'Rotaciones' },
        ]}
      />

      {tab === 'calendar' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Turnos" value={worked.length} detail={view === 'month' ? 'este mes' : 'esta semana'} />
            <Stat label="Horas" value={formatMinutes(totalShiftMinutes(inPeriod, periodStart, periodEnd))} tone="accent" />
            <Stat label="Descansos" value={inPeriod.length - worked.length} />
          </div>

          <Panel flush>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2.5 sm:px-5">
              <div className="flex items-center gap-1">
                <IconButton label={view === 'month' ? 'Mes anterior' : 'Semana anterior'} onClick={() => move(-1)}>
                  <ChevronLeft className="size-5" />
                </IconButton>
                <h2 className="min-w-36 text-center font-semibold sm:min-w-44" aria-live="polite">
                  {periodLabel}
                </h2>
                <IconButton label={view === 'month' ? 'Mes siguiente' : 'Semana siguiente'} onClick={() => move(1)}>
                  <ChevronRight className="size-5" />
                </IconButton>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCursor(today)}>
                  Hoy
                </Button>
                <div className="flex rounded-lg border border-line-strong p-0.5" role="group" aria-label="Vista del calendario">
                  {(['month', 'week'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={view === option}
                      onClick={() => setView(option)}
                      className={cn('h-8 rounded-md px-3 text-sm font-medium transition-colors', view === option ? 'bg-accent text-void' : 'text-ink-soft hover:text-ink')}
                    >
                      {option === 'month' ? 'Mes' : 'Semana'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <QueryView query={shiftsQuery}>
              {() =>
                view === 'month' ? (
                  <div>
                    <div className="grid grid-cols-7 border-b border-line">
                      {WEEKDAY_LABELS.map((d) => (
                        <div key={d} className="label py-2 text-center">
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {days.map((date) => {
                        const outside = monthKeyOf(date) !== month;
                        const shifts = byDate.get(date) ?? [];
                        return (
                          <div
                            key={date}
                            className={cn('group relative min-h-[4.6rem] border-b border-r border-line p-1 [&:nth-child(7n)]:border-r-0 sm:min-h-24 sm:p-1.5', outside && 'bg-void/60')}
                          >
                            <button
                              type="button"
                              onClick={() => openNew(date)}
                              aria-label={`Agregar turno el ${formatDate(date, 'long')}`}
                              className="absolute inset-0 rounded-sm transition-colors hover:bg-accent/5 focus-visible:bg-accent/5"
                            />
                            <span
                              className={cn(
                                'num pointer-events-none relative inline-flex size-6 items-center justify-center rounded-full text-xs',
                                date === today ? 'bg-accent font-semibold text-void' : outside ? 'text-ink-mute/60' : 'text-ink-soft',
                              )}
                            >
                              {parseISODate(date).getDate()}
                            </span>
                            <div className="relative mt-0.5 flex flex-col gap-0.5">
                              {shifts.map((shift) => (
                                <ShiftChip key={shift.id} shift={shift} compact onClick={() => editor.openEdit(shift)} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {days.map((date) => {
                      const shifts = byDate.get(date) ?? [];
                      return (
                        <li key={date} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
                          <div className="flex items-center justify-between sm:w-40 sm:shrink-0 sm:pt-1.5">
                            <p className={cn('text-sm font-medium first-letter:uppercase', date === today ? 'text-accent' : 'text-ink')}>
                              {formatDate(date, 'weekday')}
                              {date === today && <span className="ml-2 text-xs font-normal text-accent">· hoy</span>}
                            </p>
                            <IconButton label={`Agregar turno el ${formatDate(date, 'long')}`} className="sm:hidden" onClick={() => openNew(date)}>
                              <Plus className="size-4" />
                            </IconButton>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            {shifts.length === 0 ? (
                              <p className="py-1.5 text-sm text-ink-mute">Sin turno registrado</p>
                            ) : (
                              shifts.map((shift) => <ShiftChip key={shift.id} shift={shift} compact={false} onClick={() => editor.openEdit(shift)} />)
                            )}
                          </div>
                          <IconButton label={`Agregar turno el ${formatDate(date, 'long')}`} className="hidden sm:inline-flex" onClick={() => openNew(date)}>
                            <Plus className="size-4" />
                          </IconButton>
                        </li>
                      );
                    })}
                  </ul>
                )
              }
            </QueryView>
            {shiftsQuery.data?.length === 0 && (
              <div className="border-t border-line">
                <EmptyState icon={CalendarDays} title="Sin turnos en este periodo" description="Toca un día para registrar un turno o aplica una rotación para llenar el calendario." />
              </div>
            )}
          </Panel>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            {(Object.keys(KIND_STYLE) as ShiftKind[]).map((kind) => {
              const Icon = KIND_STYLE[kind].icon;
              return (
                <span key={kind} className="flex items-center gap-1.5">
                  <Icon className={cn('size-4', KIND_STYLE[kind].chip.split(' ').at(-1))} aria-hidden />
                  {SHIFT_KIND_LABEL[kind]}
                </span>
              );
            })}
            <span className="num">+1 = termina el día siguiente</span>
          </div>
        </div>
      )}

      {tab === 'templates' && <TemplatesPanel query={templatesQuery} />}
      {tab === 'rotations' && (
        <RotationsPanel
          query={rotationsQuery}
          onApplied={() => {
            reloadShifts();
            setTab('calendar');
          }}
        />
      )}

      {editor.target && (
        <ShiftForm
          key={editor.target.mode === 'edit' ? editor.target.row.id : `new-${newDate}`}
          target={editor.target}
          defaultDate={newDate}
          templates={templatesQuery.data ?? []}
          onClose={editor.close}
          onSaved={reloadShifts}
          onDelete={(shift) => {
            editor.close();
            editor.askDelete(shift);
          }}
        />
      )}
      <DeleteDialog row={editor.deleting} name={describeShift} remove={(s) => workShifts.remove(s.id)} onDone={reloadShifts} onClose={editor.closeDelete} />
    </>
  );
}
