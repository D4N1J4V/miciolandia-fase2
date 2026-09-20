import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Richiesta di cura a domicilio o trasporto. Si puo' mandare anche
 *  senza account: e' il primo servizio che parte, e chi lo chiede spesso
 *  non e' ancora cliente. Se c'e' una sessione la richiesta si lega al profilo. */
export async function POST(req: NextRequest) {
  let c: any;
  try { c = await req.json(); }
  catch { return NextResponse.json({ errore: 'Richiesta non leggibile: ricarica la pagina e riprova.' }, { status: 400 }); }

  const servizio = c.servizio === 'trasporto' ? 'trasporto' : 'domicilio';
  const nome = String(c.nome ?? '').trim();
  const email = String(c.email ?? '').trim().toLowerCase();
  const telefono = String(c.telefono ?? '').trim();
  const comune = String(c.comune ?? '').trim();
  const dal = String(c.dal ?? '');
  const al = servizio === 'domicilio' ? String(c.al ?? '') : '';
  const oggi = new Date().toISOString().slice(0, 10);

  if (!nome || !telefono || !comune) {
    return NextResponse.json({ errore: 'Mancano nome, telefono o comune: servono per organizzare la visita.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ errore: 'L’email non sembra valida: controllala e riprova.' }, { status: 400 });
  }
  if (!DATA.test(dal) || dal < oggi) {
    return NextResponse.json({ errore: 'Scegli una data da oggi in poi.' }, { status: 400 });
  }
  if (servizio === 'domicilio' && (!DATA.test(al) || al < dal)) {
    return NextResponse.json({ errore: 'L’ultimo giorno di visita deve essere uguale o successivo al primo.' }, { status: 400 });
  }

  const { data: { user } } = await supabaseServer().auth.getUser();
  const visite = servizio === 'domicilio'
    ? Math.round((new Date(al).getTime() - new Date(dal).getTime()) / 86400000) + 1
    : null;

  const db = supabaseAdmin();
  const { error } = await db.from('richieste_servizio').insert({
    servizio,
    cliente_id: user?.id ?? null,
    nome, email, telefono, comune, dal,
    al: al || null,
    visite,
    note: String(c.note ?? '').trim() || null,
  });
  if (error) {
    console.error('richieste_servizio', error);
    return NextResponse.json({ errore: 'La richiesta non è stata salvata. Riprova tra un momento o chiamaci.' }, { status: 500 });
  }

  await db.from('eventi').insert({
    nome: 'richiesta_servizio', percorso: servizio,
    sessione: c.sessione || null, pagina: '/servizi', dati: { visite },
  });

  return NextResponse.json({ ok: true, visite });
}
