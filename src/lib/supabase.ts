import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Client per Server Components e Route Handler: porta con se' la sessione. */
export function supabaseServer() {
  const store = cookies();
  return createServerClient(url, anon, {
    cookies: {
      get: (name: string) => store.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        try { store.set({ name, value, ...options }); } catch { /* Server Component */ }
      },
      remove: (name: string, options: CookieOptions) => {
        try { store.set({ name, value: '', ...options }); } catch { /* Server Component */ }
      },
    },
  });
}

/**
 * Client con service role: ignora le Row Level Security.
 * Da usare SOLO lato server (webhook Stripe, cron). Mai nel browser.
 */
export function supabaseAdmin() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
