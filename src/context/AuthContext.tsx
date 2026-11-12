import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { profiles } from '@/services';
import type { Profile } from '@/types/database';

interface AuthApi {
  /** True until the persisted session has been restored. */
  initializing: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True right after the user chose to sign out (so the login page does not send them back). */
  signedOut: boolean;
  /** True while the user arrived through a password-recovery link. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves to true when the account still needs e-mail confirmation. */
  signUp: (email: string, password: string, fullName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  saveProfile: (values: Pick<Profile, 'full_name' | 'currency'>) => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

/** Absolute URL of an app path, honouring the deploy base (e.g. /ivan-os/ on GitHub Pages). */
const appUrl = (path = ''): string => `${window.location.origin}${import.meta.env.BASE_URL}${path}`;

// Survives reloads within the tab, so a recovery session cannot skip the new-password step.
const RECOVERY_KEY = 'ivan-os:password-recovery';
const storedRecovery = (): boolean => {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1';
  } catch {
    return false;
  }
};
const storeRecovery = (active: boolean) => {
  try {
    if (active) sessionStorage.setItem(RECOVERY_KEY, '1');
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Storage unavailable (private mode): the in-memory flag still applies.
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recovering, setRecoveringState] = useState(storedRecovery);
  const [signedOut, setSignedOut] = useState(false);

  const setRecovering = useCallback((active: boolean) => {
    storeRecovery(active);
    setRecoveringState(active);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    // Fires INITIAL_SESSION once the stored session (if any) is restored.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      if (event === 'SIGNED_IN') setSignedOut(false);
      setInitializing(false);
    });
    return () => data.subscription.unsubscribe();
  }, [setRecovering]);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    profiles
      .get(userId)
      .then((row) => {
        if (!cancelled) setProfile(row);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw toAppError(error);
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: appUrl() },
    });
    if (error) throw toAppError(error);
    return data.session === null;
  }, []);

  const signOut = useCallback(async () => {
    setSignedOut(true);
    const { error } = await getSupabase().auth.signOut();
    if (error) throw toAppError(error);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: appUrl('reset-password'),
    });
    if (error) throw toAppError(error);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw toAppError(error);
    setRecovering(false);
  }, [setRecovering]);

  const saveProfile = useCallback(
    async (values: Pick<Profile, 'full_name' | 'currency'>) => {
      if (!userId) return;
      setProfile(await profiles.update(userId, values));
    },
    [userId],
  );

  const api = useMemo<AuthApi>(
    () => ({
      initializing,
      session,
      user: session?.user ?? null,
      profile,
      signedOut,
      recovering,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      saveProfile,
    }),
    [initializing, session, profile, signedOut, recovering, signIn, signUp, signOut, requestPasswordReset, updatePassword, saveProfile],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Currency chosen in the profile (COP until the profile loads). */
export const useCurrency = (): string => useAuth().profile?.currency ?? 'COP';
