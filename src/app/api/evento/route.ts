import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const AMMESSI = new Set([
  'apertura', 'click_cta', 'vista_piani', 'stima_notti', 'scelta_piano',
  'vista_dati', 'vista_prenota', 'preventivo', 'prenotazione', 'scheda_gatto',
]);

/** Traccia un passaggio dell'imbuto. Nessun cookie, nessun dato personale:
 *  solo un id di sessione casuale generato dal browser. */
export async function POST(req: NextRequest) {
  let c: any;
  try { c = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!AMMESSI.has(c.nome)) {
    return NextResponse.json({ errore: 'Evento non previsto' }, { status: 400 });
  }

  await supabaseAdmin().from('eventi').insert({
    nome: c.nome,
    percorso: c.percorso ?? null,
    piano: c.piano ?? null,
    sessione: (c.sessione ?? '').slice(0, 64) || null,
    pagina: (c.pagina ?? '').slice(0, 200) || null,
    utm_source: c.utm_source ?? null,
    utm_medium: c.utm_medium ?? null,
    utm_campaign: c.utm_campaign ?? null,
    dati: c.dati ?? null,
  });

  return NextResponse.json({ ok: true });
}
