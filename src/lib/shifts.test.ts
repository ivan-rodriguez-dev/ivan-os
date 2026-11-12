import { describe, expect, it } from 'vitest';
import { findNextShift, generateRotation, isOvernight, isValidTime, shiftDurationMinutes, shiftEndDate, shiftInterval, totalShiftMinutes, type RotationStep, type ShiftLike } from './shifts';

const shift = (shift_date: string, start: string | null, end: string | null, kind: ShiftLike['kind'] = 'day'): ShiftLike => ({ shift_date, kind, start_time: start, end_time: end });

describe('overnight shifts', () => {
  it('detects shifts that end the next day', () => {
    expect(isOvernight('22:00', '06:00')).toBe(true);
    expect(isOvernight('06:00', '14:00')).toBe(false);
    expect(isOvernight('18:00:00', '00:00:00')).toBe(true);
  });
  it('computes durations across midnight', () => {
    expect(shiftDurationMinutes('06:00', '14:00')).toBe(480);
    expect(shiftDurationMinutes('22:00', '06:00')).toBe(480);
    expect(shiftDurationMinutes('18:00', '00:00')).toBe(360);
    expect(shiftDurationMinutes('23:30:00', '00:15:00')).toBe(45);
  });
  it('places the end on the following date, including month and year ends', () => {
    expect(shiftEndDate(shift('2026-11-30', '22:00', '06:00', 'night'))).toBe('2026-12-01');
    expect(shiftEndDate(shift('2026-12-31', '22:00', '06:00', 'night'))).toBe('2027-01-01');
    expect(shiftEndDate(shift('2026-11-30', '06:00', '14:00'))).toBe('2026-11-30');
    const interval = shiftInterval(shift('2026-12-31', '22:00', '06:00', 'night'));
    expect(interval?.start).toEqual(new Date(2026, 11, 31, 22, 0));
    expect(interval?.end).toEqual(new Date(2027, 0, 1, 6, 0));
  });
  it('has no interval for rest days', () => {
    expect(shiftInterval(shift('2026-11-10', null, null, 'rest'))).toBeNull();
  });
});

describe('findNextShift', () => {
  const shifts = [
    shift('2026-11-09', '22:00', '06:00', 'night'),
    shift('2026-11-10', null, null, 'rest'),
    shift('2026-11-11', '06:00', '14:00'),
    shift('2026-11-12', '06:00', '14:00'),
  ];
  it('returns an overnight shift still in progress after midnight', () => {
    const next = findNextShift(shifts, new Date(2026, 10, 10, 3, 0));
    expect(next?.shift.shift_date).toBe('2026-11-09');
    expect(next?.status).toBe('in_progress');
  });
  it('skips finished shifts and rest days', () => {
    const next = findNextShift(shifts, new Date(2026, 10, 10, 7, 0));
    expect(next?.shift.shift_date).toBe('2026-11-11');
    expect(next?.status).toBe('upcoming');
  });
  it('returns null when nothing is left', () => {
    expect(findNextShift(shifts, new Date(2026, 10, 12, 14, 0))).toBeNull();
    expect(findNextShift([], new Date())).toBeNull();
  });
});

describe('generateRotation', () => {
  const pattern: RotationStep[] = [
    { kind: 'day', start_time: '06:00', end_time: '14:00' },
    { kind: 'night', start_time: '22:00', end_time: '06:00' },
    { kind: 'rest', start_time: null, end_time: null },
  ];
  it('repeats the cycle over an inclusive date range', () => {
    const rows = generateRotation(pattern, '2026-11-29', '2026-12-05');
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.kind)).toEqual(['day', 'night', 'rest', 'day', 'night', 'rest', 'day']);
    expect(rows[2]).toEqual({ shift_date: '2026-12-01', kind: 'rest', start_time: null, end_time: null });
    expect(rows[6]?.shift_date).toBe('2026-12-05');
  });
  it('handles single days, empty patterns and inverted ranges', () => {
    expect(generateRotation(pattern, '2026-11-10', '2026-11-10')).toHaveLength(1);
    expect(generateRotation([], '2026-11-10', '2026-11-20')).toEqual([]);
    expect(generateRotation(pattern, '2026-11-10', '2026-11-09')).toEqual([]);
  });
});

describe('totals and validation', () => {
  it('sums worked minutes inside a range, ignoring rest days', () => {
    const shifts = [shift('2026-11-01', '06:00', '14:00'), shift('2026-11-02', '22:00', '06:00', 'night'), shift('2026-11-03', null, null, 'rest'), shift('2026-12-01', '06:00', '14:00')];
    expect(totalShiftMinutes(shifts, '2026-11-01', '2026-11-30')).toBe(960);
  });
  it('validates times', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:00')).toBe(false);
  });
});
