import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe, stripeConfigurato } from '@/lib/stripe';
import { accreditaQuota, sincronizzaSubscription } from '@/lib/abbonamenti';

export const dynamic = 'force-dynamic';

/**
 * Rete di sicurezza per gli accrediti, una volta al mese.
 *  - abbonamenti Stripe: rilegge le fatture pagate e accredita quelle
 *    che un webhook perso non ha registrato. Il riferimento e' lo stesso
 *    del webhook (id fattura), quindi niente doppioni.
 *  - abbonamenti senza Stripe (modalita' dimostrativa): accredita la
 *    quota del mese, con un riferimento mensile idempotente.
 * Un abbonamento Stripe non riceve mai l'accredito "mensile": i crediti
 * nascono solo da una fattura incassata.
 */
export async function GET(req: NextRequest) {
  const atteso = process.env.CRON_SECRET;
  const ricevuto = req.headers.get('authorization');
  const locale = process.env.NODE_ENV !== 'production';
  if (atteso && !locale && ricevuto !== `Bearer ${atteso}`) {
    return NextResponse.json({ errore: 'Non autorizzato' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const mese = new Date().toISOString().slice(0, 7);

  const { data: attivi, error } = await db
    .from('abbonamenti')
    .select('cliente_id, piano_codice, stripe_subscription_id')
    .eq('stato', 'attivo');
  if (error) return NextResponse.json({ errore: error.message }, { status: 500 });

  let accreditati = 0;
  const errori: string[] = [];
  for (const a of attivi ?? []) {
    try {
      if (a.stripe_subscription_id) {
        if (!stripeConfigurato()) continue;
        const sub = await stripe().subscriptions.retrieve(a.stripe_subscription_id);
        const esito = await sincronizzaSubscription(sub);
        if (esito.ok) accreditati += esito.accreditate;
      } else if (await accreditaQuota(a.cliente_id, a.piano_codice, `mensile:${a.cliente_id}:${mese}`)) {
        accreditati++;
      }
    } catch (e) {
      errori.push(`${a.cliente_id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ mese, abbonamenti_attivi: attivi?.length ?? 0, accreditati, errori });
}
