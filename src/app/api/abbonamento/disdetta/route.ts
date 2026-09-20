import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase';
import { stripe, stripeConfigurato } from '@/lib/stripe';
import { abbonamentoAttivo, applicaDisdetta, mesiDa } from '@/lib/abbonamenti';

export const dynamic = 'force-dynamic';

/** Disdetta dell'abbonamento, nel rispetto del vincolo minimo. */
export async function POST() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ errore: 'Non autenticato' }, { status: 401 });

  const abb = await abbonamentoAttivo(user.id);
  if (!abb) {
    return NextResponse.json({ errore: 'Non risulta nessun abbonamento attivo da disdire.' }, { status: 404 });
  }

  const { data: piano } = await supabaseAdmin()
    .from('piani').select('vincolo_minimo_mesi').eq('codice', abb.piano_codice).maybeSingle();
  const vincolo = piano?.vincolo_minimo_mesi ?? 3;

  if (mesiDa(abb.data_inizio) < vincolo) {
    const dal = new Date(abb.data_inizio);
    dal.setMonth(dal.getMonth() + vincolo);
    return NextResponse.json({
      errore: `L’abbonamento ha un vincolo minimo di ${vincolo} mesi: puoi disdirlo dal `
        + `${dal.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    }, { status: 409 });
  }

  if (abb.stripe_subscription_id) {
    if (!stripeConfigurato()) {
      return NextResponse.json({
        errore: 'Il collegamento con i pagamenti non è attivo in questo momento. Riprova più tardi o scrivici.',
      }, { status: 503 });
    }
    try {
      await stripe().subscriptions.cancel(abb.stripe_subscription_id);
    } catch (e) {
      console.error('disdetta', e);
      return NextResponse.json({ errore: 'La disdetta non è andata a buon fine. Riprova tra un momento.' }, { status: 502 });
    }
    await applicaDisdetta({ stripeSubscriptionId: abb.stripe_subscription_id });
  } else {
    await applicaDisdetta({ abbonamentoId: abb.id });
  }

  return NextResponse.json({ ok: true });
}
