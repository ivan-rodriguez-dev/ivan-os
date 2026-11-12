import { addDays, diffDays, parseISODate, type ISODate } from './dates';

export type ShiftKind = 'day' | 'night' | 'custom' | 'rest';

export interface ShiftLike {
  shift_date: ISODate;
  kind: ShiftKind;
  start_time: string | null;
  end_time: string | null;
}

export interface RotationStep {
  kind: ShiftKind;
  start_time: string | null;
  end_time: string | null;
}

/** 'HH:MM' or 'HH:MM:SS' -> minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Postgres returns 'HH:MM:SS'; forms and labels use 'HH:MM'. */
export const trimTime = (time: string | null): string => (time ? time.slice(0, 5) : '');

export const isValidTime = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

/** A shift whose end is not after its start finishes on the following day. */
export function isOvernight(start: string, end: string): boolean {
  return timeToMinutes(end) <= timeToMinutes(start);
}

export function shiftDurationMinutes(start: string, end: string): number {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff : diff + 24 * 60;
}

export function shiftEndDate(shift: ShiftLike): ISODate {
  if (!shift.start_time || !shift.end_time) return shift.shift_date;
  return isOvernight(shift.start_time, shift.end_time) ? addDays(shift.shift_date, 1) : shift.shift_date;
}

/** Concrete local start/end instants of a working shift (null for rest days). */
export function shiftInterval(shift: ShiftLike): { start: Date; end: Date } | null {
  if (shift.kind === 'rest' || !shift.start_time || !shift.end_time) return null;
  const start = parseISODate(shift.shift_date);
  start.setMinutes(timeToMinutes(shift.start_time));
  const end = new Date(start.getTime() + shiftDurationMinutes(shift.start_time, shift.end_time) * 60_000);
  return { start, end };
}

export type ShiftStatus = 'in_progress' | 'upcoming';

/** The shift happening right now, otherwise the next one to start. */
export function findNextShift<T extends ShiftLike>(shifts: T[], now: Date = new Date()): { shift: T; status: ShiftStatus; start: Date; end: Date } | null {
  let best: { shift: T; status: ShiftStatus; start: Date; end: Date } | null = null;
  for (const shift of shifts) {
    const interval = shiftInterval(shift);
    if (!interval || interval.end <= now) continue;
    if (!best || interval.start < best.start) {
      best = { shift, status: interval.start <= now ? 'in_progress' : 'upcoming', ...interval };
    }
  }
  return best;
}

/** Total worked minutes of the shifts that start inside [from, to]. */
export function totalShiftMinutes(shifts: ShiftLike[], from: ISODate, to: ISODate): number {
  return shifts
    .filter((s) => s.kind !== 'rest' && s.start_time && s.end_time && s.shift_date >= from && s.shift_date <= to)
    .reduce((sum, s) => sum + shiftDurationMinutes(s.start_time as string, s.end_time as string), 0);
}

/** Repeats the rotation cycle day by day from `start` through `end` (inclusive). */
export function generateRotation(pattern: RotationStep[], start: ISODate, end: ISODate): ShiftLike[] {
  if (pattern.length === 0) return [];
  const days = diffDays(start, end) + 1;
  const rows: ShiftLike[] = [];
  for (let i = 0; i < days; i++) {
    const step = pattern[i % pattern.length] as RotationStep;
    rows.push({
      shift_date: addDays(start, i),
      kind: step.kind,
      start_time: step.kind === 'rest' ? null : step.start_time,
      end_time: step.kind === 'rest' ? null : step.end_time,
    });
  }
  return rows;
}

export const SHIFT_KIND_LABEL: Record<ShiftKind, string> = {
  day: 'Diurno',
  night: 'Nocturno',
  custom: 'Personalizado',
  rest: 'Descanso',
};
