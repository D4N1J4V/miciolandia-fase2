import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, stripeConfigurato, pianoDaPriceId } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { accreditaQuota, applicaDisdetta, sincronizzaSubscription } from '@/lib/abbonamenti';

export const dynamic = 'force-dynamic';

/**
 * Qui sta il pezzo importante del modello: i crediti NON vengono
 * accreditati da un cron a calendario, ma quando Stripe conferma che
 * la quota e' stata incassata. Niente pagamento, niente crediti,
 * e nessuna gestione manuale degli insoluti.
 *
 * In locale: stripe listen --forward-to localhost:3000/api/stripe/webhook
 * (facoltativo: il ritorno dal Checkout fa la stessa sincronizzazione)
 */
export async function POST(req: NextRequest) {
  const segreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigurato() || !segreto || !segreto.startsWith('whsec_') || segreto.includes('placeholder')) {
    return NextResponse.json({ errore: 'Webhook non configurato' }, { status: 503 });
  }

  const firma = req.headers.get('stripe-signature');
  const corpo = await req.text();

  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(corpo, firma ?? '', segreto);
  } catch {
    return NextResponse.json({ errore: 'Firma non valida' }, { status: 400 });
  }

  const db = supabaseAdmin();

  switch (evento.type) {
    case 'customer.subscription.created': {
      await sincronizzaSubscription(evento.data.object as Stripe.Subscription);
      break;
    }

    // Quota incassata -> accredito dei crediti del mese.
    // Il riferimento e' l'id della fattura: se Stripe reinvia
    // l'evento, la funzione SQL ignora il duplicato.
    case 'invoice.paid': {
      const fattura = evento.data.object as Stripe.Invoice;
      const subId = typeof fattura.subscription === 'string'
        ? fattura.subscription : fattura.subscription?.id;
      if (!subId) break;

      let { data: abb } = await db
        .from('abbonamenti').select('cliente_id, piano_codice')
        .eq('stripe_subscription_id', subId).maybeSingle();

      // invoice.paid puo' arrivare prima di subscription.created
      if (!abb) {
        await sincronizzaSubscription(await stripe().subscriptions.retrieve(subId));
        break;
      }
      await accreditaQuota(abb.cliente_id, abb.piano_codice, `stripe:${fattura.id}`);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = evento.data.object as Stripe.Subscription;
      const piano = sub.metadata?.piano ?? pianoDaPriceId(sub.items.data[0]?.price.id ?? '');
      if (!piano) break;
      await db.from('abbonamenti')
        .update({ piano_codice: piano, stato: sub.cancel_at_period_end ? 'disdetto' : 'attivo' })
        .eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = evento.data.object as Stripe.Subscription;
      await applicaDisdetta({ stripeSubscriptionId: sub.id });
      break;
    }
  }

  return NextResponse.json({ ricevuto: true });
}
