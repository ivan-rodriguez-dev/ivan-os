import { describe, expect, it } from 'vitest';
import { addDays, addMonths, diffDays, endOfMonth, formatMinutes, isValidISODate, monthGrid, relativeDay, startOfWeek, weekDates } from './dates';
import { minutesBetween, monthlyBuckets, weeklyBuckets } from './sessions';

describe('date math', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-11-01', '2026-11-30')).toBe(29);
    expect(diffDays('2026-11-30', '2026-11-01')).toBe(-29);
  });
  it('finds week and month boundaries (weeks start on Monday)', () => {
    expect(startOfWeek('2026-11-11')).toBe('2026-11-09'); // Wednesday
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09'); // Sunday
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09');
    expect(weekDates('2026-11-11')).toHaveLength(7);
    expect(endOfMonth('2028-02')).toBe('2028-02-29');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', 3)).toBe('2027-02');
  });
  it('builds a full-week month grid', () => {
    const grid = monthGrid('2026-11');
    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toBe('2026-10-26');
    expect(grid.at(-1)).toBe('2026-12-06');
    expect(grid).toContain('2026-11-01');
  });
  it('validates and describes dates', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(relativeDay('2026-11-12', '2026-11-11')).toBe('Mañana');
    expect(relativeDay('2026-11-08', '2026-11-11')).toBe('Hace 3 días');
    expect(formatMinutes(150)).toBe('2 h 30 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
  });
});

describe('session buckets', () => {
  const entries = [
    { date: '2026-11-09', minutes: 60, group: 'listening' },
    { date: '2026-11-11', minutes: 30, group: 'speaking' },
    { date: '2026-11-08', minutes: 45, group: 'listening' },
    { date: '2026-09-30', minutes: 20, group: 'reading' },
    { date: '2025-01-01', minutes: 999, group: 'reading' },
  ];
  it('groups minutes per week, ending with the current week', () => {
    const weeks = weeklyBuckets(entries, 3, '2026-11-11');
    expect(weeks.map((w) => w.key)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
    expect(weeks.map((w) => w.minutes)).toEqual([0, 45, 90]);
    expect(weeks[2]?.groups).toEqual({ listening: 60, speaking: 30 });
  });
  it('groups minutes per month', () => {
    const months = monthlyBuckets(entries, 3, '2026-11-11');
    expect(months.map((m) => m.key)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(months.map((m) => m.minutes)).toEqual([20, 0, 135]);
  });
  it('sums an inclusive range', () => {
    expect(minutesBetween(entries, '2026-11-09', '2026-11-11')).toBe(90);
  });
});
