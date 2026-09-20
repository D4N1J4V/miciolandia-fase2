import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Crea una prenotazione. Prezzo, disponibilita' e consumo crediti
 *  sono decisi dalla funzione SQL crea_prenotazione, in transazione. */
export async function POST(req: NextRequest) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ errore: 'Non autenticato' }, { status: 401 });

  const { gatto_id, check_in, check_out, n_gatti = 1 } = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(check_out ?? '')
      || check_out <= check_in || ![1, 2, 3].includes(Number(n_gatti))) {
    return NextResponse.json({ errore: 'Date o numero di gatti non validi: sceglili di nuovo sul calendario.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin().rpc('crea_prenotazione', {
    p_cliente: user.id,
    p_gatto: gatto_id ?? null,
    p_check_in: check_in,
    p_check_out: check_out,
    p_n_gatti: Number(n_gatti),
  });

  if (error) {
    console.error('crea_prenotazione', error);
    return NextResponse.json({ errore: 'Non sono riuscito a registrare la prenotazione. Riprova tra un momento.' }, { status: 500 });
  }
  if (data?.errore) return NextResponse.json(data, { status: 409 });
  return NextResponse.json(data);
}

/** Disdetta. La regola delle 72 ore sta nella funzione SQL. */
export async function DELETE(req: NextRequest) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ errore: 'Non autenticato' }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get('id'));
  const admin = supabaseAdmin();

  const { data: pren } = await admin
    .from('prenotazioni').select('cliente_id').eq('id', id).maybeSingle();
  if (!pren || pren.cliente_id !== user.id) {
    return NextResponse.json({ errore: 'Prenotazione non trovata' }, { status: 404 });
  }

  const { data, error } = await admin.rpc('annulla_prenotazione', { p_prenotazione: id });
  if (error) {
    console.error('annulla_prenotazione', error);
    return NextResponse.json({ errore: 'Non sono riuscito ad annullare. Riprova tra un momento.' }, { status: 500 });
  }
  return NextResponse.json(data);
}
