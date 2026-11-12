import { describe, expect, it } from 'vitest';
import { toAppError } from './errors';
import { amount, email, hasErrors, integerBetween, isoDate, maxLength, required, url, validate } from './validation';

describe('validate', () => {
  const rules = { name: [required(), maxLength(5)], mail: [required(), email()], when: [isoDate()], total: [amount()], level: [integerBetween(0, 10)], link: [url()] };
  it('passes valid values', () => {
    const errors = validate({ name: 'Ivan', mail: 'a@b.co', when: '2026-11-11', total: '10.50', level: '7', link: '' }, rules);
    expect(hasErrors(errors)).toBe(false);
  });
  it('reports the first failing rule per field', () => {
    const errors = validate({ name: '   ', mail: 'nope', when: '2026-02-30', total: '0', level: '11', link: 'ftp://x' }, rules);
    expect(Object.keys(errors).sort()).toEqual(['level', 'link', 'mail', 'name', 'total', 'when']);
    expect(errors.name).toBe('Este campo es obligatorio');
    expect(validate({ name: 'toolong', mail: 'a@b.co', when: '2026-11-11', total: '1', level: '1.5', link: 'https://x.dev' }, rules)).toEqual({
      name: 'Máximo 5 caracteres',
      level: 'Ingresa un número entero entre 0 y 10',
    });
  });
});

describe('toAppError', () => {
  it('maps known database and auth codes to friendly messages', () => {
    expect(toAppError({ code: '23505', message: 'duplicate key' }).message).toBe('Ya existe un registro con esos datos.');
    expect(toAppError({ code: 'invalid_credentials', message: 'Invalid login credentials' }).message).toBe('Correo o contraseña incorrectos.');
    expect(toAppError(new TypeError('Failed to fetch')).code).toBe('network');
    expect(toAppError({ message: 'Invalid login credentials', status: 400 }).message).toBe('Correo o contraseña incorrectos.');
    expect(toAppError({ message: 'User already registered' }).message).toBe('Ya existe una cuenta con ese correo.');
  });
  it('shows trigger messages for check violations but hides raw constraint text', () => {
    expect(toAppError({ code: '23514', message: 'El pago supera el saldo pendiente de la deuda (pendiente: 10.00)' }).message).toContain('El pago supera');
    expect(toAppError({ code: '23514', message: 'new row violates check constraint "x"' }).message).toBe('Uno de los valores no cumple las reglas de validación.');
  });
});
