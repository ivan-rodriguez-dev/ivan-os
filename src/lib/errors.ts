// Central place where technical errors become messages a person can act on.

export class AppError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}

interface ErrorShape {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  same_password: 'La nueva contraseña debe ser diferente de la anterior.',
  over_email_send_rate_limit: 'Demasiados correos enviados. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  signup_disabled: 'El registro de nuevas cuentas está deshabilitado.',
  email_address_invalid: 'El correo electrónico no es válido.',
  otp_expired: 'El enlace expiró o ya fue usado. Solicita uno nuevo.',
  session_not_found: 'Tu sesión expiró. Inicia sesión de nuevo.',
};

// Fallback for when the auth error code is unavailable (e.g. a proxy hides the x-sb-error-code header).
const AUTH_MESSAGE_PATTERNS: [RegExp, string][] = [
  [/invalid login credentials/i, 'invalid_credentials'],
  [/already registered/i, 'user_already_exists'],
  [/email not confirmed/i, 'email_not_confirmed'],
  [/rate limit/i, 'over_request_rate_limit'],
  [/should be different from the old password/i, 'same_password'],
];

const PG_MESSAGES: Record<string, string> = {
  '23505': 'Ya existe un registro con esos datos.',
  '23503': 'El registro hace referencia a un elemento que no existe o no te pertenece.',
  '23502': 'Falta un dato obligatorio.',
  '22P02': 'Uno de los valores tiene un formato no válido.',
  '22001': 'Uno de los textos es demasiado largo.',
  '42501': 'No tienes permiso para realizar esta acción.',
  PGRST116: 'El registro no existe o no tienes acceso a él.',
  PGRST301: 'Tu sesión expiró. Inicia sesión de nuevo.',
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const shape = (typeof error === 'object' && error !== null ? error : {}) as ErrorShape;
  const raw = typeof shape.message === 'string' ? shape.message : '';
  const code = typeof shape.code === 'string' ? shape.code : AUTH_MESSAGE_PATTERNS.find(([pattern]) => pattern.test(raw))?.[1];
  const options = { cause: error };

  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return new AppError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.', 'network', options);
  }
  if (code && AUTH_MESSAGES[code]) return new AppError(AUTH_MESSAGES[code], code, options);
  // check_violation: triggers in this schema raise a ready-to-show Spanish message.
  if (code === '23514') {
    const custom = /^(El |La )/.test(raw);
    return new AppError(custom ? raw : 'Uno de los valores no cumple las reglas de validación.', code, options);
  }
  if (code && PG_MESSAGES[code]) return new AppError(PG_MESSAGES[code], code, options);
  if (shape.status === 401 || shape.status === 403) return new AppError('Tu sesión expiró. Inicia sesión de nuevo.', code, options);

  console.error('[IVAN OS] unexpected error', error);
  return new AppError('Ocurrió un error inesperado. Inténtalo de nuevo.', code, options);
}

export const errorMessage = (error: unknown): string => toAppError(error).message;
