import { MailCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Button, Input, LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useForm } from '@/hooks/useForm';
import { errorMessage } from '@/lib/errors';
import { email, maxLength, minLength, required, type Rule } from '@/lib/validation';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md animate-rise">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="label">Your life. Your system. Your control.</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-6 sm:p-7">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-ink-soft">{footer}</div>}
      </div>
    </main>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {message}
    </p>
  );
}

const linkClass = 'font-medium text-accent hover:underline';

/** Runs an auth call, exposing its pending flag and inline error. */
function useAuthSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return { pending, error, run };
}

const passwordRules = [required(), minLength(8, 'La contraseña debe tener al menos 8 caracteres'), maxLength(72)];
const matches =
  (message: string): Rule<{ password: string }> =>
  (value, values) =>
    value === values.password ? null : message;

export function LoginPage() {
  const { signIn } = useAuth();
  const { pending, error, run } = useAuthSubmit();
  const form = useForm({ email: '', password: '' }, { email: [required(), email()], password: [required()] });

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Accede a tu centro de control."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className={linkClass}>
            Crear cuenta
          </Link>
        </>
      }
    >
      <form noValidate className="flex flex-col gap-4" onSubmit={form.submit((v) => run(() => signIn(v.email.trim(), v.password)))}>
        <FormError message={error} />
        <Input label="Correo electrónico" type="email" autoComplete="email" value={form.values.email} error={form.errors.email} onChange={(e) => form.set('email', e.target.value)} />
        <Input label="Contraseña" type="password" autoComplete="current-password" value={form.values.password} error={form.errors.password} onChange={(e) => form.set('password', e.target.value)} />
        <Button type="submit" variant="primary" loading={pending}>
          Entrar
        </Button>
        <Link to="/forgot-password" className={`${linkClass} text-center text-sm`}>
          Olvidé mi contraseña
        </Link>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { signUp } = useAuth();
  const { pending, error, run } = useAuthSubmit();
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const form = useForm(
    { fullName: '', email: '', password: '', confirm: '' },
    {
      fullName: [required(), maxLength(120)],
      email: [required(), email()],
      password: passwordRules,
      confirm: [required(), matches('Las contraseñas no coinciden')],
    },
  );

  if (needsConfirmation) {
    return (
      <AuthShell title="Revisa tu correo" subtitle={`Enviamos un enlace de confirmación a ${form.values.email.trim()}.`}>
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck className="size-9 text-accent" aria-hidden />
          <p className="text-sm text-ink-soft">Abre el enlace para activar tu cuenta y luego inicia sesión.</p>
          <Link to="/login" className={linkClass}>
            Ir a iniciar sesión
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Configura tu sistema personal."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className={linkClass}>
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.submit((v) =>
          run(async () => {
            const pendingConfirmation = await signUp(v.email.trim(), v.password, v.fullName.trim());
            setNeedsConfirmation(pendingConfirmation);
          }),
        )}
      >
        <FormError message={error} />
        <Input label="Nombre" autoComplete="name" value={form.values.fullName} error={form.errors.fullName} onChange={(e) => form.set('fullName', e.target.value)} />
        <Input label="Correo electrónico" type="email" autoComplete="email" value={form.values.email} error={form.errors.email} onChange={(e) => form.set('email', e.target.value)} />
        <Input label="Contraseña" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres." value={form.values.password} error={form.errors.password} onChange={(e) => form.set('password', e.target.value)} />
        <Input label="Confirmar contraseña" type="password" autoComplete="new-password" value={form.values.confirm} error={form.errors.confirm} onChange={(e) => form.set('confirm', e.target.value)} />
        <Button type="submit" variant="primary" loading={pending}>
          Crear cuenta
        </Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const { pending, error, run } = useAuthSubmit();
  const [sent, setSent] = useState(false);
  const form = useForm({ email: '' }, { email: [required(), email()] });

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace para crear una nueva contraseña."
      footer={
        <Link to="/login" className={linkClass}>
          Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <div role="status" className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="size-9 text-accent" aria-hidden />
          <p className="text-sm text-ink-soft">Si existe una cuenta con ese correo, recibirás un enlace de recuperación en unos minutos.</p>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.submit((v) =>
            run(async () => {
              await requestPasswordReset(v.email.trim());
              setSent(true);
            }),
          )}
        >
          <FormError message={error} />
          <Input label="Correo electrónico" type="email" autoComplete="email" value={form.values.email} error={form.errors.email} onChange={(e) => form.set('email', e.target.value)} />
          <Button type="submit" variant="primary" loading={pending}>
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { initializing, session, recovering, updatePassword } = useAuth();
  const { pending, error, run } = useAuthSubmit();
  const toast = useToast();
  const form = useForm({ password: '', confirm: '' }, { password: passwordRules, confirm: [required(), matches('Las contraseñas no coinciden')] });

  if (initializing) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <LoadingState />
      </div>
    );
  }
  // Only recovery sessions belong here; everyone else signed in goes to the app
  // (the password can be changed in Settings). Also the exit after a successful update.
  if (session && !recovering) return <Navigate to="/" replace />;

  if (!session) {
    return (
      <AuthShell title="Enlace no válido" subtitle="El enlace de recuperación expiró o ya fue usado.">
        <Link to="/forgot-password" className={linkClass}>
          Solicitar un nuevo enlace
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle="Elige una contraseña nueva para tu cuenta.">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.submit((v) =>
          run(async () => {
            await updatePassword(v.password);
            toast.success('Contraseña actualizada.');
          }),
        )}
      >
        <FormError message={error} />
        <Input label="Nueva contraseña" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres." value={form.values.password} error={form.errors.password} onChange={(e) => form.set('password', e.target.value)} />
        <Input label="Confirmar contraseña" type="password" autoComplete="new-password" value={form.values.confirm} error={form.errors.confirm} onChange={(e) => form.set('confirm', e.target.value)} />
        <Button type="submit" variant="primary" loading={pending}>
          Guardar contraseña
        </Button>
      </form>
    </AuthShell>
  );
}
