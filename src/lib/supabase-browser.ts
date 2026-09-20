import { createBrowserClient } from '@supabase/ssr';

/** Client per i componenti che girano nel browser. Sta in un file a parte
 *  perche' supabase.ts importa next/headers, che nel browser non esiste. */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
