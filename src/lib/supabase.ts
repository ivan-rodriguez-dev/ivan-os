import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const looksConfigured = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim() !== '' && !value.includes('YOUR-');

export const isSupabaseConfigured = looksConfigured(url) && looksConfigured(anonKey);

// Only the public anon key is ever used in the browser; access is enforced by RLS.
const client: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function getSupabase(): SupabaseClient {
  if (!client) throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return client;
}
