import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** La scheda del gatto si compila una volta sola: qui si legge e si aggiorna. */
export async function GET() {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ errore: 'Non autenticato' }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from('gatti').select('*').eq('cliente_id', user.id).order('id');

  return NextResponse.json({ gatti: data ?? [] });
}

export async function POST(req: NextRequest) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ errore: 'Non autenticato' }, { status: 401 });

  const c = await req.json();
  if (!c.nome?.trim()) return NextResponse.json({ errore: 'Il nome serve' }, { status: 400 });

  const riga = {
    cliente_id: user.id,
    nome: c.nome.trim(),
    anno_nascita: c.anno_nascita ? Number(c.anno_nascita) : null,
    peso_kg: c.peso_kg ? Number(c.peso_kg) : null,
    carattere: c.carattere || null,
    convive_con_altri: typeof c.convive_con_altri === 'boolean' ? c.convive_con_altri : null,
    sterilizzato: typeof c.sterilizzato === 'boolean' ? c.sterilizzato : null,
    microchip: c.microchip || null,
    note_alimentari: c.note_alimentari || null,
    note_mediche: c.note_mediche || null,
    vaccinazione_scadenza: c.vaccinazione_scadenza || null,
    antiparassitario_il: c.antiparassitario_il || null,
    veterinario: c.veterinario || null,
  };

  const admin = supabaseAdmin();
  let risultato;

  if (c.id) {
    risultato = await admin.from('gatti').update(riga)
      .eq('id', c.id).eq('cliente_id', user.id).select().single();
  } else {
    risultato = await admin.from('gatti').insert(riga).select().single();
    await admin.from('eventi').insert({ nome: 'scheda_gatto', dati: { primo: true } });
  }

  if (risultato.error) {
    return NextResponse.json({ errore: risultato.error.message }, { status: 500 });
  }
  return NextResponse.json({ gatto: risultato.data });
}
