import { Logo } from './Logo';

/** Shown instead of the app when the Supabase environment variables are missing. */
export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-5 py-10">
      <Logo />
      <h1 className="text-2xl font-semibold">Falta configurar Supabase</h1>
      <p className="text-ink-soft">
        IVAN OS necesita un proyecto de Supabase para autenticar usuarios y guardar datos. Crea un archivo <code className="num text-accent">.env.local</code> en la
        raíz del proyecto con estas dos variables y reinicia el servidor:
      </p>
      <pre className="num overflow-x-auto rounded-lg border border-line bg-panel p-4 text-sm text-ink-soft">
        {'VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co\nVITE_SUPABASE_ANON_KEY=tu-clave-anon-publica'}
      </pre>
      <p className="text-sm text-ink-mute">
        Las encuentras en Supabase → Project Settings → API. Usa solo la clave <strong>anon</strong>; nunca la clave service_role. El README explica el proceso
        completo, incluidas las migraciones.
      </p>
    </main>
  );
}
