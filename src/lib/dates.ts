// All calendar dates travel as local 'YYYY-MM-DD' strings (the same shape as a
// Postgres `date`), so nothing here is affected by time zones.

export type ISODate = string;
export type MonthKey = string; // 'YYYY-MM'

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseISODate(value)) === value;
}

export const todayISO = (): ISODate => toISODate(new Date());

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = Date.UTC(...ymd(b)) - Date.UTC(...ymd(a));
  return Math.round(ms / 86_400_000);
}

function ymd(iso: ISODate): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y ?? 1970, (m ?? 1) - 1, d ?? 1];
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: ISODate): ISODate {
  const dow = (parseISODate(iso).getDay() + 6) % 7; // Mon = 0
  return addDays(iso, -dow);
}

export function weekDates(iso: ISODate): ISODate[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const monthKeyOf = (iso: ISODate): MonthKey => iso.slice(0, 7);
export const startOfMonth = (month: MonthKey): ISODate => `${month}-01`;

export function endOfMonth(month: MonthKey): ISODate {
  const [y, m] = month.split('-').map(Number);
  return toISODate(new Date(y ?? 1970, m ?? 1, 0));
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y ?? 1970, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Full weeks (Mon–Sun) covering the month: the cells of a calendar grid. */
export function monthGrid(month: MonthKey): ISODate[] {
  const first = startOfWeek(startOfMonth(month));
  const last = addDays(startOfWeek(endOfMonth(month)), 6);
  return Array.from({ length: diffDays(first, last) + 1 }, (_, i) => addDays(first, i));
}

const LOCALE = 'es-CO';

export function formatDate(iso: ISODate, style: 'short' | 'medium' | 'long' | 'weekday' = 'medium'): string {
  const d = parseISODate(iso);
  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    short: { day: 'numeric', month: 'short' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    weekday: { weekday: 'short', day: 'numeric', month: 'short' },
  };
  return new Intl.DateTimeFormat(LOCALE, options[style]).format(d);
}

export function formatMonth(month: MonthKey, style: 'long' | 'short' = 'long'): string {
  const text = new Intl.DateTimeFormat(LOCALE, { month: style, year: style === 'long' ? 'numeric' : '2-digit' }).format(
    parseISODate(startOfMonth(month)),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

/** 150 -> "2 h 30 min" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Minutes as decimal hours with one decimal: 150 -> 2.5 */
export const minutesToHours = (minutes: number): number => Math.round((minutes / 60) * 10) / 10;

/** "Hoy", "Mañana", "En 3 días", "Hace 2 días" relative to today. */
export function relativeDay(iso: ISODate, today: ISODate = todayISO()): string {
  const n = diffDays(today, iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  return n > 0 ? `En ${n} días` : `Hace ${-n} días`;
}
