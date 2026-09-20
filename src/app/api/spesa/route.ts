import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verificaStaff } from '@/lib/ruoli';

export const dynamic = 'force-dynamic';

/** Registra quanto e' stato speso in pubblicita' in un mese.
 *  E' il denominatore di costo per iscritto e costo per prenotazione:
 *  senza questo numero le due metriche non esistono. */
export async function POST(req: NextRequest) {
  const accesso = await verificaStaff();
  if (accesso.stato === 'anonimo') {
    return NextResponse.json({ errore: 'Accedi con un account dello staff e riprova.' }, { status: 401 });
  }
  if (accesso.stato === 'negato') {
    return NextResponse.json({ errore: 'Solo lo staff può registrare la spesa. Chiedi al gestore di abilitare il tuo account.' }, { status: 403 });
  }

  const { mese, importo, canale } = await req.json();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mese ?? '')) {
    return NextResponse.json({ errore: 'Mese non valido' }, { status: 400 });
  }
  const valore = Number(importo);
  if (!isFinite(valore) || valore < 0) {
    return NextResponse.json({ errore: 'Importo non valido' }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from('spesa_ads')
    .upsert({ mese: `${mese}-01`, importo: valore, canale: canale || 'meta' },
            { onConflict: 'mese' });

  if (error) {
    console.error('spesa_ads', error);
    return NextResponse.json({ errore: 'La spesa non è stata salvata. Riprova tra un momento.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
