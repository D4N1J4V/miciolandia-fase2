import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Riceve i contatti dalla landing.
 * Scrive con il service role: dal browser la tabella `lead` non e'
 * scrivibile, cosi' nessuno puo' inquinare le metriche dall'esterno.
 */
export async function POST(req: NextRequest) {
  let corpo: any;
  try { corpo = await req.json(); }
  catch { return NextResponse.json({ errore: 'Richiesta non leggibile' }, { status: 400 }); }

  const nome = (corpo.nome ?? '').trim();
  const email = (corpo.email ?? '').trim().toLowerCase();
  const percorso = corpo.percorso === 'notte' ? 'notte' : 'abbonamento';

  if (!nome) return NextResponse.json({ errore: 'Manca il nome' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ errore: 'Email non valida' }, { status: 400 });
  }

  const db = supabaseAdmin();

  const riga = {
    percorso,
    piano: percorso === 'abbonamento' ? (corpo.piano ?? null) : null,
    notti_previste: percorso === 'abbonamento' ? (corpo.notti_previste ?? null) : null,
    nome,
    email,
    telefono: corpo.telefono || null,
    comune: corpo.comune || null,
    gatti: corpo.gatti || null,
    quando: percorso === 'notte' ? (corpo.quando || null) : null,
    dove: percorso === 'notte' ? (corpo.dove || null) : null,
    utm_source: corpo.utm_source || null,
    utm_medium: corpo.utm_medium || null,
    utm_campaign: corpo.utm_campaign || null,
    arrivo: corpo.arrivo || null,
  };

  // Stesso indirizzo sullo stesso percorso: aggiorniamo invece di duplicare,
  // altrimenti chi rimanda il modulo gonfia il conteggio dei contatti.
  // L'indice unico e' su (email, percorso) con email sempre minuscola (10_lead_indice.sql).
  const { error } = await db
    .from('lead')
    .upsert(riga, { onConflict: 'email,percorso', ignoreDuplicates: false });

  if (error) {
    console.error('lead', error);
    return NextResponse.json({ errore: 'Non sono riuscito a salvare il contatto. Riprova tra un momento.' }, { status: 500 });
  }

  await db.from('eventi').insert({
    nome: 'lead',
    percorso,
    piano: riga.piano,
    sessione: corpo.sessione || null,
    pagina: corpo.pagina || null,
    utm_source: riga.utm_source,
    utm_medium: riga.utm_medium,
    utm_campaign: riga.utm_campaign,
    dati: { notti_previste: riga.notti_previste, gatti: riga.gatti },
  });

  return NextResponse.json({ ok: true });
}
