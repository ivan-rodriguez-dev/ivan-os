import { describe, expect, it } from 'vitest';
import { centsToDecimal, formatMoney, parseAmount, percentOf, toCents } from './money';

describe('parseAmount', () => {
  it('parses whole and decimal amounts into cents', () => {
    expect(parseAmount('1250')).toBe(125000);
    expect(parseAmount('1250.5')).toBe(125050);
    expect(parseAmount('1250,50')).toBe(125050);
    expect(parseAmount(' 0.01 ')).toBe(1);
    expect(parseAmount('999999999999.99')).toBe(99999999999999);
  });
  it('rejects zero, negatives, extra decimals and garbage', () => {
    for (const bad of ['', '0', '0.00', '-5', '1.234', 'abc', '1e3', '1.2.3', '.5', '1,000.00']) expect(parseAmount(bad)).toBeNull();
  });
});

describe('toCents', () => {
  it('converts API numerics without float drift', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents('1234.50')).toBe(123450);
    expect(toCents('1234.5')).toBe(123450);
    expect(toCents(1.005)).toBe(100); // toFixed(2) of the binary float; DB never stores 3 decimals
    expect(toCents('-45.10')).toBe(-4510);
    expect(toCents(null)).toBe(0);
  });
  it('sums a long list exactly', () => {
    const cents = Array.from({ length: 1000 }, () => toCents(0.1)).reduce((a, b) => a + b, 0);
    expect(cents).toBe(10000);
  });
});

describe('centsToDecimal', () => {
  it('round-trips with parseAmount', () => {
    for (const text of ['0.01', '10.00', '1234.56', '999999999999.99']) expect(centsToDecimal(parseAmount(text) as number)).toBe(text);
    expect(centsToDecimal(-4510)).toBe('-45.10');
    expect(centsToDecimal(5)).toBe('0.05');
  });
});

describe('percentOf / formatMoney', () => {
  it('clamps and handles zero totals', () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(300, 200)).toBe(100);
    expect(percentOf(10, 0)).toBe(0);
    expect(percentOf(-5, 100)).toBe(0);
  });
  it('formats currency', () => {
    expect(formatMoney(150000000, 'COP')).toMatch(/1\.500\.000/);
    expect(formatMoney(1999, 'USD')).toMatch(/19,99/);
    expect(formatMoney(100, 'XXXX')).toBe('XXXX 1.00');
  });
});
