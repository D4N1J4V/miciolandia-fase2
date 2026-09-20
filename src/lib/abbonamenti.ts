import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe, pianoDaPriceId } from '@/lib/stripe';

/**
 * Le operazioni sugli abbonamenti, condivise da webhook, ritorno dal
 * Checkout, disdetta e cron. Stanno in un posto solo perche' devono
 * comportarsi allo stesso modo da qualunque parte arrivi l'evento:
 * un webhook e un ritorno dal Checkout sullo stesso pagamento devono
 * produrre un solo accredito.
 */

export function oggiIso() {
  return new Date().toISOString().slice(0, 10);
}

export function mesiDa(dataInizio: string, oggi = new Date()) {
  const inizio = new Date(dataInizio);
  let mesi = (oggi.getFullYear() - inizio.getFullYear()) * 12 + (oggi.getMonth() - inizio.getMonth());
  if (oggi.getDate() < inizio.getDate()) mesi -= 1;
  return Math.max(mesi, 0);
}

export async function abbonamentoAttivo(clienteId: string) {
  const { data } = await supabaseAdmin()
    .from('abbonamenti')
    .select('id, piano_codice, data_inizio, stato, stripe_subscription_id')
    .eq('cliente_id', clienteId).eq('stato', 'attivo')
    .order('data_inizio', { ascending: false }).limit(1).maybeSingle();
  return data;
}

/** Registra l'abbonamento. Con Stripe la chiave e' l'id della subscription,
 *  cosi' webhook e ritorno dal Checkout non creano due righe. */
export async function registraAbbonamento(p: {
  clienteId: string;
  piano: string;
  dataInizio: string;
  stripeSubscriptionId: string | null;
}) {
  const db = supabaseAdmin();
  const riga = {
    cliente_id: p.clienteId,
    piano_codice: p.piano,
    stato: 'attivo',
    data_inizio: p.dataInizio,
    stripe_subscription_id: p.stripeSubscriptionId,
  };
  if (p.stripeSubscriptionId) {
    const { error } = await db.from('abbonamenti').upsert(riga, { onConflict: 'stripe_subscription_id' });
    if (error) throw error;
  } else {
    const { error } = await db.from('abbonamenti').insert(riga);
    if (error) throw error;
  }
}

/** Accredita le notti-credito di una quota incassata. Idempotente sul riferimento. */
export async function accreditaQuota(clienteId: string, piano: string, riferimento: string) {
  const db = supabaseAdmin();
  const { data: p } = await db
    .from('piani').select('crediti_mensili, validita_crediti_mesi, nome')
    .eq('codice', piano).maybeSingle();
  if (!p) return null;

  const { data, error } = await db.rpc('accredita_crediti', {
    p_cliente: clienteId,
    p_crediti: p.crediti_mensili,
    p_riferimento: riferimento,
    p_validita_mesi: p.validita_crediti_mesi,
    p_note: `quota mensile ${p.nome}`,
  });
  if (error) throw error;
  return data as number | null;
}

/** Disdetta: i crediti residui restano validi 60 giorni.
 *  Regola anti-abuso: chi si iscrive, accumula e sparisce non puo'
 *  tenersi i crediti per un anno. */
export async function applicaDisdetta(filtro: { stripeSubscriptionId: string } | { abbonamentoId: number }) {
  const db = supabaseAdmin();
  const q = db.from('abbonamenti').select('id, cliente_id, stato');
  const { data: abb } = 'stripeSubscriptionId' in filtro
    ? await q.eq('stripe_subscription_id', filtro.stripeSubscriptionId).maybeSingle()
    : await q.eq('id', filtro.abbonamentoId).maybeSingle();
  if (!abb) return;

  await db.from('abbonamenti')
    .update({ stato: 'disdetto', data_disdetta: oggiIso() })
    .eq('id', abb.id);

  const scadenza = new Date();
  scadenza.setDate(scadenza.getDate() + 60);
  const limite = scadenza.toISOString().slice(0, 10);
  await db.from('movimenti_credito')
    .update({ data_scadenza: limite })
    .eq('cliente_id', abb.cliente_id)
    .in('tipo', ['accredito', 'rimborso'])
    .gt('data_scadenza', limite);
}

function idDi(x: string | { id: string } | null | undefined) {
  return typeof x === 'string' ? x : x?.id ?? null;
}

/** Porta nel database lo stato di una subscription Stripe e accredita
 *  le fatture pagate. E' il cuore sia del webhook sia del ritorno dal
 *  Checkout: in locale funziona anche senza `stripe listen`. */
export async function sincronizzaSubscription(sub: Stripe.Subscription, clienteIdAtteso?: string) {
  const clienteId = sub.metadata?.cliente_id;
  if (!clienteId) return { ok: false as const, motivo: 'subscription senza cliente' };
  if (clienteIdAtteso && clienteId !== clienteIdAtteso) {
    return { ok: false as const, motivo: 'subscription di un altro cliente' };
  }
  const piano = sub.metadata?.piano ?? pianoDaPriceId(sub.items.data[0]?.price.id ?? '');
  if (!piano) return { ok: false as const, motivo: 'piano non riconosciuto' };

  if (sub.status === 'active' || sub.status === 'trialing') {
    await registraAbbonamento({
      clienteId,
      piano,
      dataInizio: new Date(sub.start_date * 1000).toISOString().slice(0, 10),
      stripeSubscriptionId: sub.id,
    });
  }

  const fatture = await stripe().invoices.list({ subscription: sub.id, status: 'paid', limit: 12 });
  let accreditate = 0;
  for (const f of fatture.data) {
    if (idDi(f.subscription) !== sub.id) continue;
    if (await accreditaQuota(clienteId, piano, `stripe:${f.id}`)) accreditate++;
  }
  return { ok: true as const, piano, accreditate };
}
