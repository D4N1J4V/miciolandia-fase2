import { NextRequest, NextResponse } from 'next/server';
import { stripe, stripeConfigurato, PRICE_ID } from '@/lib/stripe';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase';
import { abbonamentoAttivo, registraAbbonamento, accreditaQuota, oggiIso } from '@/lib/abbonamenti';

export const dynamic = 'force-dynamic';

/** Avvia la sottoscrizione di un piano. In modalita' test si paga
 *  con la carta 4242 4242 4242 4242, scadenza futura, CVC qualsiasi. */
export async function POST(req: NextRequest) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ errore: 'Non autenticato' }, { status: 401 });

  const { piano } = await req.json();
  const admin = supabaseAdmin();
  const { data: p } = await admin
    .from('piani').select('codice, nome, quota_mensile').eq('codice', piano).maybeSingle();
  if (!p) {
    return NextResponse.json({ errore: 'Piano non riconosciuto: ricarica la pagina e scegline uno dei tre.' }, { status: 400 });
  }

  if (await abbonamentoAttivo(user.id)) {
    return NextResponse.json({
      errore: 'Hai già un abbonamento attivo. Per cambiare piano disdici quello attuale dalla tua area.',
    }, { status: 409 });
  }

  // Senza chiavi Stripe il sito resta dimostrabile: l'abbonamento parte
  // subito e la prima quota si considera incassata. Il riferimento e'
  // lo stesso che usa il cron mensile, quindi il mese non si accredita due volte.
  if (!stripeConfigurato()) {
    await registraAbbonamento({
      clienteId: user.id, piano: p.codice, dataInizio: oggiIso(), stripeSubscriptionId: null,
    });
    await accreditaQuota(user.id, p.codice, `mensile:${user.id}:${oggiIso().slice(0, 7)}`);
    return NextResponse.json({ url: '/app?iscrizione=demo' });
  }

  const { data: cliente } = await admin
    .from('clienti').select('stripe_customer_id, email, nome')
    .eq('id', user.id).maybeSingle();

  try {
    let customerId = cliente?.stripe_customer_id;
    if (customerId) {
      // Un cliente creato con un altro account Stripe non esiste qui.
      const c = await stripe().customers.retrieve(customerId).catch(() => null);
      if (!c || c.deleted) customerId = null;
    }
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: cliente?.email ?? user.email!,
        name: cliente?.nome ?? undefined,
        metadata: { cliente_id: user.id },
      });
      customerId = customer.id;
      await admin.from('clienti').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const priceId = PRICE_ID[p.codice];

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // Se i price id non sono configurati il prezzo si prende dalla
      // tabella piani: la quota resta una sola, quella del database.
      line_items: [priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: Math.round(Number(p.quota_mensile) * 100),
              recurring: { interval: 'month' },
              product_data: { name: `Miciolandia — ${p.nome}` },
            },
          }],
      success_url: `${site}/app?sessione={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/prezzi?pagamento=annullato#piani`,
      locale: 'it',
      subscription_data: { metadata: { cliente_id: user.id, piano: p.codice } },
      metadata: { cliente_id: user.id, piano: p.codice },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('checkout', e);
    return NextResponse.json({
      errore: 'Il pagamento non si è aperto. Riprova tra un momento; se succede ancora, scrivici.',
    }, { status: 502 });
  }
}
