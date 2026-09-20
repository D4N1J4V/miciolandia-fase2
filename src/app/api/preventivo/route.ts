import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase';
import { mesiDa } from '@/lib/abbonamenti';

export const dynamic = 'force-dynamic';

/**
 * Preventivo pubblico.
 * Non duplica nessuna regola: chiama la funzione SQL calcola_preventivo,
 * che e' l'unica fonte di verita' sul prezzo. Se l'utente e' loggato,
 * legge dal suo profilo piano, anzianita' e saldo reali.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { check_in, check_out, n_gatti = 1 } = body;

  if (!check_in || !check_out) {
    return NextResponse.json({ errore: 'Date mancanti' }, { status: 400 });
  }
  if (new Date(check_out) <= new Date(check_in)) {
    return NextResponse.json(
      { errore: 'La partenza deve essere successiva all\u2019arrivo' }, { status: 400 });
  }

  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();

  // Valori di default: simulazione libera dalla home
  let piano: string | null = body.piano ?? null;
  let mesi: number = body.mesi_iscrizione ?? 0;
  let saldo: number = body.crediti_disponibili ?? 0;
  let altaUsate: number = body.alta_gia_usate ?? 0;

  // Se c'e' una sessione e il client non ha forzato uno scenario,
  // si usano i dati veri del cliente.
  if (user && body.usa_profilo !== false) {
    const admin = supabaseAdmin();

    const { data: abb } = await admin
      .from('abbonamenti')
      .select('piano_codice, data_inizio')
      .eq('cliente_id', user.id)
      .eq('stato', 'attivo')
      .order('data_inizio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (abb) {
      piano = abb.piano_codice;
      // Stesso conteggio di crea_prenotazione (mesi compiuti), altrimenti
      // il preventivo potrebbe sbloccare l'alta stagione un mese prima.
      mesi = mesiDa(abb.data_inizio);

      const { data: s } = await admin
        .from('saldo_crediti').select('saldo').eq('cliente_id', user.id).maybeSingle();
      saldo = Number(s?.saldo ?? 0);

      const { data: uso } = await admin.rpc('notti_alta_a_credito_usate', {
        p_cliente: user.id,
        p_anno: new Date(check_in).getFullYear(),
      });
      altaUsate = Number(uso ?? 0);
    }
  }

  const db2 = supabaseAdmin();
  const { data, error } = await db2.rpc('calcola_preventivo', {
    p_check_in: check_in,
    p_check_out: check_out,
    p_n_gatti: n_gatti,
    p_piano: piano,
    p_mesi_iscrizione: mesi,
    p_crediti_disponibili: saldo,
    p_alta_gia_usate: altaUsate,
  });

  if (error) {
    console.error('preventivo', error);
    return NextResponse.json({ errore: 'Non riesco a calcolare il preventivo. Controlla le date e riprova.' }, { status: 500 });
  }

  const { data: liberi } = await db2.rpc('box_liberi', {
    p_check_in: check_in, p_check_out: check_out, p_n_gatti: n_gatti,
  });

  return NextResponse.json({
    ...data,
    box_liberi: liberi ?? null,
    socio: !!(user && piano && body.usa_profilo !== false),
    saldo_attuale: saldo,
  });
}
