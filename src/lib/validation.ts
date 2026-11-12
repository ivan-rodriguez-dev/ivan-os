import { isValidISODate } from './dates';
import { parseAmount } from './money';
import { isValidTime } from './shifts';

/** A rule returns an error message, or null when the value is acceptable. */
export type Rule<V> = (value: unknown, values: V) => string | null;
export type Rules<V> = { [K in keyof V]?: Rule<V>[] };
export type Errors<V> = { [K in keyof V]?: string };

export function validate<V extends object>(values: V, rules: Rules<V>): Errors<V> {
  const errors: Errors<V> = {};
  for (const key of Object.keys(rules) as (keyof V)[]) {
    for (const rule of rules[key] ?? []) {
      const message = rule(values[key], values);
      if (message) {
        errors[key] = message;
        break;
      }
    }
  }
  return errors;
}

export const hasErrors = (errors: object): boolean => Object.keys(errors).length > 0;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const required =
  (message = 'Este campo es obligatorio'): Rule<unknown> =>
  (v) =>
    text(v) === '' ? message : null;

export const maxLength =
  (max: number): Rule<unknown> =>
  (v) =>
    text(v).length > max ? `Máximo ${max} caracteres` : null;

export const minLength =
  (min: number, message?: string): Rule<unknown> =>
  (v) =>
    text(v).length < min ? (message ?? `Mínimo ${min} caracteres`) : null;

export const email = (): Rule<unknown> => (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(v)) ? null : 'Correo electrónico no válido');

export const isoDate =
  (optional = false): Rule<unknown> =>
  (v) => {
    if (text(v) === '') return optional ? null : 'Selecciona una fecha';
    return isValidISODate(text(v)) ? null : 'Fecha no válida';
  };

export const time = (): Rule<unknown> => (v) => (isValidTime(text(v)) ? null : 'Hora no válida');

export const amount = (): Rule<unknown> => (v) =>
  parseAmount(text(v)) === null ? 'Ingresa un monto mayor que 0 (máximo 2 decimales)' : null;

export const integerBetween =
  (min: number, max: number): Rule<unknown> =>
  (v) => {
    const n = Number(text(v));
    return text(v) !== '' && Number.isInteger(n) && n >= min && n <= max ? null : `Ingresa un número entero entre ${min} y ${max}`;
  };

export const positiveNumber = (): Rule<unknown> => (v) => {
  const n = Number(text(v).replace(',', '.'));
  return text(v) !== '' && Number.isFinite(n) && n > 0 ? null : 'Ingresa un número mayor que 0';
};

export const nonNegativeNumber = (): Rule<unknown> => (v) => {
  const n = Number(text(v).replace(',', '.'));
  return text(v) !== '' && Number.isFinite(n) && n >= 0 ? null : 'Ingresa un número igual o mayor que 0';
};

export const url =
  (optional = true): Rule<unknown> =>
  (v) => {
    if (text(v) === '') return optional ? null : 'Este campo es obligatorio';
    return /^https?:\/\/\S+$/i.test(text(v)) ? null : 'Debe comenzar con http:// o https://';
  };
