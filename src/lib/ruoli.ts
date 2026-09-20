import { supabaseServer, supabaseAdmin } from '@/lib/supabase';

export type EsitoStaff =
  | { stato: 'anonimo' }
  | { stato: 'negato'; email: string }
  | { stato: 'staff'; id: string };

/** Il ruolo si legge dal database a ogni richiesta, non dal token:
 *  togliere lo staff a qualcuno ha effetto subito. */
export async function verificaStaff(): Promise<EsitoStaff> {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return { stato: 'anonimo' };

  const { data } = await supabaseAdmin()
    .from('clienti').select('ruolo').eq('id', user.id).maybeSingle();
  return data?.ruolo === 'staff'
    ? { stato: 'staff', id: user.id }
    : { stato: 'negato', email: user.email ?? '' };
}
