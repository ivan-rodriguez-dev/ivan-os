// Money is handled as integer cents on the client so sums are exact.
// Postgres stores numeric(14,2) and returns it as a number or numeric string.

const AMOUNT_RE = /^\d{1,12}([.,]\d{1,2})?$/;

/** Parses user input ("1250", "1250.5", "1250,50") into cents; null if invalid or <= 0. */
export function parseAmount(input: string): number | null {
  const text = input.trim().replace(/\s/g, '');
  if (!AMOUNT_RE.test(text)) return null;
  const [whole = '0', frac = ''] = text.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

/** Converts a numeric(14,2) value coming from the API into cents without float drift. */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const text = typeof value === 'number' ? value.toFixed(2) : value;
  const negative = text.startsWith('-');
  const [whole = '0', frac = ''] = text.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0').slice(0, 2));
  return negative ? -cents : cents;
}

/** Cents -> "1234.56", the exact decimal string sent to Postgres. */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function formatMoney(cents: number, currency = 'COP'): string {
  const hasFraction = cents % 100 !== 0;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })
      .format(cents / 100)
      .replace(/\u00a0/g, ' '); // plain space so long amounts may wrap after the symbol
  } catch {
    return `${currency} ${centsToDecimal(cents)}`;
  }
}

/** Share of `part` in `total` as a whole percent, clamped to 0..100. */
export function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
