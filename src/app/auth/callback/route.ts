import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Arrivo dal link nell'email: scambia il codice con una sessione. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const codice = url.searchParams.get('code');
  const t = url.searchParams.get('torna');
  const torna = t && t.startsWith('/') && !t.startsWith('//') ? t : '/app';

  if (codice) {
    const { error } = await supabaseServer().auth.exchangeCodeForSession(codice);
    if (!error) return NextResponse.redirect(new URL(torna, url.origin));
  }
  return NextResponse.redirect(new URL('/login?errore=link', url.origin));
}
