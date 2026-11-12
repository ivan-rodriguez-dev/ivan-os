import { LogOut } from 'lucide-react';
import { Button, Input, PageHeader, Panel, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { maxLength, minLength, required, type Rule } from '@/lib/validation';

const CURRENCIES = [
  { value: 'COP', label: 'COP · Peso colombiano' },
  { value: 'USD', label: 'USD · Dólar estadounidense' },
  { value: 'EUR', label: 'EUR · Euro' },
  { value: 'MXN', label: 'MXN · Peso mexicano' },
  { value: 'ARS', label: 'ARS · Peso argentino' },
  { value: 'CLP', label: 'CLP · Peso chileno' },
  { value: 'PEN', label: 'PEN · Sol peruano' },
] as const;

const matchesPassword: Rule<{ password: string }> = (value, values) => (value === values.password ? null : 'Las contraseñas no coinciden');

function ProfileForm() {
  const { profile, saveProfile } = useAuth();
  const { run, pending } = useAction();
  const form = useForm({ full_name: profile?.full_name ?? '', currency: profile?.currency ?? 'COP' }, { full_name: [required(), maxLength(120)] });

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={form.submit((v) => void run(() => saveProfile({ full_name: v.full_name.trim(), currency: v.currency }), 'Perfil actualizado.'))}>
      <Input label="Nombre" autoComplete="name" value={form.values.full_name} error={form.errors.full_name} onChange={(e) => form.set('full_name', e.target.value)} />
      <Select label="Moneda" hint="Se usa para mostrar todos los montos." value={form.values.currency} options={CURRENCIES} onChange={(e) => form.set('currency', e.target.value)} />
      <Button type="submit" variant="primary" loading={pending} className="self-start">
        Guardar perfil
      </Button>
    </form>
  );
}

function PasswordForm() {
  const { updatePassword } = useAuth();
  const { run, pending } = useAction();
  const form = useForm(
    { password: '', confirm: '' },
    { password: [required(), minLength(8, 'La contraseña debe tener al menos 8 caracteres'), maxLength(72)], confirm: [required(), matchesPassword] },
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.submit(async (v) => {
        if (await run(() => updatePassword(v.password), 'Contraseña actualizada.')) form.setValues({ password: '', confirm: '' });
      })}
    >
      <Input label="Nueva contraseña" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres." value={form.values.password} error={form.errors.password} onChange={(e) => form.set('password', e.target.value)} />
      <Input label="Confirmar contraseña" type="password" autoComplete="new-password" value={form.values.confirm} error={form.errors.confirm} onChange={(e) => form.set('confirm', e.target.value)} />
      <Button type="submit" loading={pending} className="self-start">
        Cambiar contraseña
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const { run, pending } = useAction();

  return (
    <>
      <PageHeader eyebrow="Sistema" title="Ajustes" description="Tu perfil, preferencias y seguridad de la cuenta." />
      <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
        {/* Remount once the profile arrives so the form starts with stored values. */}
        <Panel title="Perfil">
          <ProfileForm key={profile?.id ?? 'loading'} />
        </Panel>
        <Panel title="Seguridad">
          <PasswordForm />
        </Panel>
        <Panel title="Sesión" className="lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-ink-soft">
              Sesión iniciada como <span className="text-ink">{user?.email}</span>
            </p>
            <Button variant="danger" icon={<LogOut className="size-4" />} loading={pending} onClick={() => void run(signOut)}>
              Cerrar sesión
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
