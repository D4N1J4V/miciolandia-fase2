import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const revalidate = 3600;

/**
 * Mappa di un mese: per ogni giorno il tipo di stagione, il prezzo e
 * quanti crediti costa. Alimenta il calendario della pagina prenotazione.
 * Usa la stessa funzione SQL del preventivo, quindi non puo' divergere.
 */
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const mese = p.get('mese'); // formato YYYY-MM

  if (!mese || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mese)) {
    return NextResponse.json({ errore: 'Parametro mese non valido' }, { status: 400 });
  }

  const inizio = `${mese}-01`;
  const d = new Date(`${inizio}T12:00:00`);
  const dopo = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const fine = dopo.toISOString().slice(0, 10);

  const db = supabaseAdmin();
  const { data, error } = await db.rpc('righe_soggiorno', {
    p_check_in: inizio,
    p_check_out: fine,
  });
  if (error) return NextResponse.json({ errore: error.message }, { status: 500 });

  // Disponibilita' giorno per giorno, per spegnere le date piene
  const { data: pren } = await db
    .from('prenotazioni')
    .select('check_in, check_out')
    .eq('stato', 'confermata')
    .lt('check_in', fine)
    .gt('check_out', inizio);

  const { count: boxTotali } = await db
    .from('box').select('*', { count: 'exact', head: true }).eq('attivo', true);

  const occupati: Record<string, number> = {};
  for (const p of pren ?? []) {
    const a = new Date(p.check_in + 'T12:00:00');
    const b = new Date(p.check_out + 'T12:00:00');
    for (let g = new Date(a); g < b; g.setDate(g.getDate() + 1)) {
      const k = g.toISOString().slice(0, 10);
      occupati[k] = (occupati[k] ?? 0) + 1;
    }
  }

  const giorni = (data ?? []).map((r: any) => ({
    data: r.data,
    tipo: r.tipo,
    prezzo: Number(r.prezzo_listino),
    crediti: Number(r.crediti),
    liberi: Math.max((boxTotali ?? 0) - (occupati[r.data] ?? 0), 0),
  }));

  return NextResponse.json({ mese, box_totali: boxTotali ?? 0, giorni });
}
