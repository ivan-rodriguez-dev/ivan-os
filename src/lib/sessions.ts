import { addDays, addMonths, formatDate, formatMonth, monthKeyOf, startOfWeek, todayISO, type ISODate } from './dates';

export interface TimedEntry {
  date: ISODate;
  minutes: number;
  /** Optional series key (e.g. listening/speaking) for stacked charts. */
  group?: string;
}

export interface Bucket {
  key: string;
  label: string;
  minutes: number;
  /** Minutes per group key. */
  groups: Record<string, number>;
}

function fill(buckets: Bucket[], keyOf: (date: ISODate) => string, entries: TimedEntry[]): Bucket[] {
  const index = new Map(buckets.map((b) => [b.key, b]));
  for (const entry of entries) {
    const bucket = index.get(keyOf(entry.date));
    if (!bucket) continue;
    bucket.minutes += entry.minutes;
    if (entry.group) bucket.groups[entry.group] = (bucket.groups[entry.group] ?? 0) + entry.minutes;
  }
  return buckets;
}

/** Minutes per week (Mon–Sun) for the last `weeks` weeks, oldest first, ending with the current week. */
export function weeklyBuckets(entries: TimedEntry[], weeks: number, today: ISODate = todayISO()): Bucket[] {
  const current = startOfWeek(today);
  const buckets = Array.from({ length: weeks }, (_, i): Bucket => {
    const start = addDays(current, (i - weeks + 1) * 7);
    return { key: start, label: formatDate(start, 'short'), minutes: 0, groups: {} };
  });
  return fill(buckets, startOfWeek, entries);
}

/** Minutes per calendar month for the last `months` months, oldest first. */
export function monthlyBuckets(entries: TimedEntry[], months: number, today: ISODate = todayISO()): Bucket[] {
  const current = monthKeyOf(today);
  const buckets = Array.from({ length: months }, (_, i): Bucket => {
    const key = addMonths(current, i - months + 1);
    return { key, label: formatMonth(key, 'short'), minutes: 0, groups: {} };
  });
  return fill(buckets, monthKeyOf, entries);
}

export function minutesBetween(entries: TimedEntry[], from: ISODate, to: ISODate): number {
  return entries.filter((e) => e.date >= from && e.date <= to).reduce((sum, e) => sum + e.minutes, 0);
}

export const totalMinutes = (entries: TimedEntry[]): number => entries.reduce((sum, e) => sum + e.minutes, 0);
