import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { crediti as fmtCrediti } from '@/lib/types';

export const dynamic = 'force-dynamic';

function dataIt(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
}

function resendConfigurato() {
  return /^re_[A-Za-z0-9_]{10,}$/.test(process.env.RESEND_API_KEY ?? '');
}

/** Invio tramite l'API HTTP di Resend: una fetch, nessuna libreria in piu'. */
async function invia(a: string, oggetto: string, testo: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_MITTENTE || 'Miciolandia <onboarding@resend.dev>',
      to: [a],
      subject: oggetto,
      text: testo,
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

/**
 * Gira ogni mattina alle 6 (vedi vercel.json).
 *  1. azzera i crediti scaduti con la funzione FIFO
 *  2. avvisa chi ha crediti in scadenza entro 30 giorni
 *  3. avvisa chi ha il libretto vaccinale in scadenza entro 30 giorni
 * Senza RESEND_API_KEY non invia nulla e restituisce l'elenco, cosi'
 * il cron resta verificabile aprendo la route.
 */
export async function GET(req: NextRequest) {
  const atteso = process.env.CRON_SECRET;
  const ricevuto = req.headers.get('authorization');
  const locale = process.env.NODE_ENV !== 'production';
  if (atteso && !locale && ricevuto !== `Bearer ${atteso}`) {
    return NextResponse.json({ errore: 'Non autorizzato' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const oggi = new Date().toISOString().slice(0, 10);

  const { data: scadute, error: e1 } = await db.rpc('scadi_crediti');
  if (e1) return NextResponse.json({ errore: e1.message }, { status: 500 });

  const { data: inScadenza } = await db.rpc('crediti_in_scadenza', { p_giorni: 30 });

  const fraTrenta = new Date();
  fraTrenta.setDate(fraTrenta.getDate() + 30);
  const { data: vaccini } = await db
    .from('gatti')
    .select('nome, vaccinazione_scadenza, clienti(email, nome)')
    .lte('vaccinazione_scadenza', fraTrenta.toISOString().slice(0, 10))
    .gte('vaccinazione_scadenza', oggi);

  // Un solo messaggio per cliente e per giorno di scadenza, anche se
  // i crediti in scadenza vengono da piu' accrediti.
  const perCliente = new Map<string, { email: string; crediti: number; data: string }>();
  for (const r of (inScadenza ?? []) as { cliente_id: string; email: string; crediti: number; data_scadenza: string }[]) {
    const k = `${r.cliente_id}:${r.data_scadenza}`;
    const v = perCliente.get(k);
    perCliente.set(k, { email: r.email, data: r.data_scadenza, crediti: (v?.crediti ?? 0) + Number(r.crediti) });
  }

  const messaggi: { a: string; oggetto: string; testo: string; tipo: string }[] = [];
  for (const c of perCliente.values()) {
    // Si avvisa a 30 e a 7 giorni, non tutti i giorni.
    const giorni = Math.round((new Date(c.data).getTime() - new Date(oggi).getTime()) / 86400000);
    if (giorni !== 30 && giorni !== 7) continue;
    messaggi.push({
      tipo: 'crediti',
      a: c.email,
      oggetto: `${fmtCrediti(c.crediti)} notti-credito scadono il ${dataIt(c.data)}`,
      testo:
        `Ciao,\n\nhai ${fmtCrediti(c.crediti)} notti-credito che scadono il ${dataIt(c.data)}. ` +
        `Dopo quella data non si possono più usare.\n\n` +
        `Per usarle prenota un soggiorno da qui: ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/prenota\n\n` +
        `Miciolandia`,
    });
  }

  for (const v of (vaccini ?? []) as any[]) {
    const cl = Array.isArray(v.clienti) ? v.clienti[0] : v.clienti;
    if (!cl?.email) continue;
    const giorni = Math.round((new Date(v.vaccinazione_scadenza).getTime() - new Date(oggi).getTime()) / 86400000);
    if (giorni !== 30 && giorni !== 7) continue;
    messaggi.push({
      tipo: 'vaccino',
      a: cl.email,
      oggetto: `La vaccinazione di ${v.nome} scade il ${dataIt(v.vaccinazione_scadenza)}`,
      testo:
        `Ciao ${cl.nome ?? ''},\n\nla vaccinazione di ${v.nome} scade il ${dataIt(v.vaccinazione_scadenza)}. ` +
        `\n\n` +
        `Quando l’hai rinnovata aggiorna la data nella scheda: ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/gatto\n\n` +
        `Miciolandia`,
    });
  }

  let inviate = 0;
  const errori: string[] = [];
  if (resendConfigurato()) {
    for (const m of messaggi) {
      try { await invia(m.a, m.oggetto, m.testo); inviate++; }
      catch (e) { errori.push((e as Error).message); }
    }
  }

  return NextResponse.json({
    eseguito_il: new Date().toISOString(),
    movimenti_di_scadenza_creati: scadute ?? 0,
    email_da_inviare: messaggi.length,
    email_inviate: inviate,
    invio_attivo: resendConfigurato(),
    errori,
    crediti_in_scadenza: inScadenza ?? [],
    vaccinazioni_in_scadenza: vaccini ?? [],
  });
}
