import { redirect } from 'next/navigation';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase';
import { stripe, stripeConfigurato } from '@/lib/stripe';
import { mesiDa, sincronizzaSubscription } from '@/lib/abbonamenti';
import { euro, crediti as fmtCrediti, type MovimentoCredito } from '@/lib/types';
import { AnnullaSoggiorno, DisdiciAbbonamento } from '@/components/AzioniSocio';

export const dynamic = 'force-dynamic';

const DESCRIZIONE: Record<string, string> = {
  accredito: 'Accredito mensile',
  consumo: 'Soggiorno',
  scadenza: 'Crediti scaduti',
  rimborso: 'Rimborso disdetta',
  rettifica: 'Rettifica',
};

const STATO_SOGGIORNO: Record<string, string> = {
  confermata: 'Confermato',
  annullata: 'Annullato',
  completata: 'Concluso',
};

function dataIt(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Al ritorno dal Checkout sincronizza subito, senza aspettare il webhook:
 *  il socio vede i crediti appena pagato, anche in locale senza `stripe listen`. */
async function confermaPagamento(sessioneId: string, clienteId: string) {
  if (!stripeConfigurato()) return 'errore';
  try {
    const s = await stripe().checkout.sessions.retrieve(sessioneId, { expand: ['subscription'] });
    if (s.metadata?.cliente_id !== clienteId) return 'errore';
    if (s.status !== 'complete' || !s.subscription || typeof s.subscription === 'string') return 'attesa';
    const esito = await sincronizzaSubscription(s.subscription, clienteId);
    return esito.ok ? 'ok' : 'errore';
  } catch (e) {
    console.error('conferma pagamento', e);
    return 'errore';
  }
}

export default async function AreaSoci({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login?torna=/app');

  const esitoPagamento = searchParams.sessione ? await confermaPagamento(searchParams.sessione, user.id) : null;

  const admin = supabaseAdmin();
  const oggi = new Date().toISOString().slice(0, 10);

  const [{ data: cliente }, { data: saldo }, { data: abb }, { data: movimenti }, { data: prenotazioni },
         { data: gatti }, { data: richieste }] = await Promise.all([
    admin.from('clienti').select('nome, ruolo').eq('id', user.id).maybeSingle(),
    admin.from('saldo_crediti').select('*').eq('cliente_id', user.id).maybeSingle(),
    admin.from('abbonamenti')
      .select('piano_codice, data_inizio, stato, stripe_subscription_id, piani(nome, quota_mensile, crediti_mensili, tetto_alta_annuo, mesi_sblocco_alta, vincolo_minimo_mesi)')
      .eq('cliente_id', user.id).eq('stato', 'attivo')
      .order('data_inizio', { ascending: false }).limit(1).maybeSingle(),
    admin.from('movimenti_credito')
      .select('id, tipo, crediti, data_movimento, data_scadenza, note')
      .eq('cliente_id', user.id)
      .order('data_movimento', { ascending: false }).limit(25),
    admin.from('prenotazioni')
      .select('id, check_in, check_out, stato, n_gatti, totale_listino, crediti_usati, contante_dovuto, gatti(nome)')
      .eq('cliente_id', user.id)
      .order('check_in', { ascending: false }).limit(20),
    admin.from('gatti').select('id, nome, vaccinazione_scadenza').eq('cliente_id', user.id).order('id'),
    admin.from('richieste_servizio').select('id, servizio, dal, al, stato')
      .eq('cliente_id', user.id).order('creata_il', { ascending: false }).limit(5),
  ]);

  const piano = abb ? (Array.isArray(abb.piani) ? abb.piani[0] : abb.piani) : null;
  const mesiSocio = abb ? mesiDa(abb.data_inizio) : 0;
  const altaSbloccata = piano ? mesiSocio >= piano.mesi_sblocco_alta : false;
  const nomeCorto = piano?.nome.split(/\s[-—]\s/)[0] ?? null;
  const staff = cliente?.ruolo === 'staff';

  return (
    <main className="wrap" style={{ paddingTop: 44, paddingBottom: 70 }}>
      <div className="riga" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 'clamp(2rem,4.6vw,2.8rem)' }}>Ciao {cliente?.nome ?? ''}</h1>
        <form action="/auth/esci" method="post">
          <button className="btn btn-vuoto btn-piccolo" type="submit">Esci</button>
        </form>
      </div>

      {esitoPagamento === 'ok' && (
        <div className="avviso avviso-ok">
          Pagamento ricevuto: l’abbonamento è attivo e le notti-credito del primo mese sono già in tessera.
        </div>
      )}
      {esitoPagamento === 'attesa' && (
        <div className="avviso avviso-ok">
          Il pagamento è in lavorazione. Ricarica la pagina tra qualche secondo per vedere i crediti.
        </div>
      )}
      {esitoPagamento === 'errore' && (
        <div className="avviso avviso-no">
          Non riesco a verificare il pagamento. Se l’addebito è andato a buon fine i crediti arrivano
          entro pochi minuti; altrimenti riprova dalla pagina Prezzi.
        </div>
      )}
      {searchParams.iscrizione === 'demo' && (
        <div className="avviso avviso-ok">
          Abbonamento attivato in modalità dimostrativa: il pagamento è simulato perché Stripe non è
          collegato, e le notti-credito del primo mese sono già in tessera.
        </div>
      )}
      {searchParams.disdetta === 'ok' && (
        <div className="avviso avviso-ok">
          Abbonamento disdetto. I crediti che hai in tessera restano validi per 60 giorni: usali per
          prenotare prima che scadano.
        </div>
      )}

      <div className="kpi-griglia">
        <div className="kpi">
          <div className="k">Notti-credito in tessera</div>
          <div className="v">{fmtCrediti(Number(saldo?.saldo ?? 0))}</div>
          <div className="k">
            {fmtCrediti(Number(saldo?.totale_accreditato ?? 0))} accreditate · {fmtCrediti(Number(saldo?.totale_consumato ?? 0))} usate
          </div>
        </div>
        <div className="kpi">
          <div className="k">Piano</div>
          <div className="v" style={{ fontSize: '1.4rem' }}>{nomeCorto ?? 'Nessun abbonamento'}</div>
          {abb && piano && (
            <div className="k">
              {euro(Number(piano.quota_mensile))} al mese · {mesiSocio + 1}° mese di iscrizione
            </div>
          )}
        </div>
        <div className="kpi">
          <div className="k">Alta stagione con i crediti</div>
          <div className="v" style={{ fontSize: '1.4rem' }}>
            {!piano ? '—' : altaSbloccata ? 'Sbloccata' : 'Dal 13° mese'}
          </div>
          {piano && (
            <div className="k">
              {altaSbloccata
                ? `fino a ${piano.tetto_alta_annuo} notti l’anno con i crediti`
                : `nel primo anno agosto e Natale si pagano a listino`}
            </div>
          )}
        </div>
      </div>

      <div className="riga" style={{ marginTop: 24 }}>
        <a className="btn" href="/prenota">Prenota un soggiorno</a>
        <a className="btn btn-vuoto" href="/gatto">{gatti?.length ? 'La scheda del gatto' : 'Compila la scheda del gatto'}</a>
        <a className="btn btn-vuoto" href="/servizi">Domicilio e trasporto</a>
        {!abb && <a className="btn btn-miele" href="/prezzi#piani">Scegli un abbonamento</a>}
      </div>

      {staff && (
        <div className="card" style={{ marginTop: 24 }}>
          <strong>Strumenti dello staff</strong>
          <div className="riga" style={{ marginTop: 10 }}>
            <a className="btn btn-vuoto btn-piccolo" href="/gestore">Pannello gestore</a>
            <a className="btn btn-vuoto btn-piccolo" href="/metriche">Metriche</a>
            <a className="btn btn-vuoto btn-piccolo" href="/simulatore">Simulatore</a>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 50, fontSize: '1.5rem' }}>I tuoi soggiorni</h2>
      {prenotazioni?.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="dati" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>Date</th><th>Gatto</th><th>Stato</th>
                <th className="n">Listino</th><th className="n">Crediti</th><th className="n">Da pagare</th><th />
              </tr>
            </thead>
            <tbody>
              {prenotazioni.map((p) => {
                const g = Array.isArray(p.gatti) ? p.gatti[0] : p.gatti;
                const annullabile = p.stato === 'confermata' && p.check_in >= oggi;
                const giorni = (new Date(p.check_in).getTime() - new Date(oggi).getTime()) / 86400000;
                return (
                  <tr key={p.id}>
                    <td>{dataIt(p.check_in)} → {dataIt(p.check_out)}</td>
                    <td>{g?.nome ?? '—'}{p.n_gatti > 1 ? ` +${p.n_gatti - 1}` : ''}</td>
                    <td>{STATO_SOGGIORNO[p.stato] ?? p.stato}</td>
                    <td className="n">{euro(Number(p.totale_listino))}</td>
                    <td className="n">{fmtCrediti(Number(p.crediti_usati))}</td>
                    <td className="n">{euro(Number(p.contante_dovuto))}</td>
                    <td className="n">{annullabile && <AnnullaSoggiorno id={p.id} entro72ore={giorni < 3} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="guida">Nessun soggiorno ancora. Il primo si prenota dal calendario.</p>
      )}

      <h2 style={{ marginTop: 50, fontSize: '1.5rem' }}>Registro della tessera</h2>
      <p className="guida stretta" style={{ marginTop: 10 }}>
        Ogni riga è un movimento: accrediti, consumi, scadenze. Il saldo è la somma di
        queste righe, non un numero salvato da qualche parte.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="dati" style={{ minWidth: 560 }}>
          <thead>
            <tr><th>Quando</th><th>Movimento</th><th className="n">Crediti</th><th>Valido fino al</th></tr>
          </thead>
          <tbody>
            {((movimenti ?? []) as MovimentoCredito[]).map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.data_movimento).toLocaleDateString('it-IT')}</td>
                <td>{DESCRIZIONE[m.tipo]}{m.note ? ` — ${m.note}` : ''}</td>
                <td className="n">{Number(m.crediti) > 0 ? '+' : ''}{fmtCrediti(Number(m.crediti))}</td>
                <td>{m.data_scadenza ? dataIt(m.data_scadenza) : '—'}</td>
              </tr>
            ))}
            {!movimenti?.length && (
              <tr><td colSpan={4} className="nota">
                Ancora nessun movimento. Con un abbonamento, ogni quota pagata aggiunge qui le notti del mese.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!!richieste?.length && (
        <>
          <h2 style={{ marginTop: 50, fontSize: '1.5rem' }}>Richieste di domicilio e trasporto</h2>
          <table className="dati" style={{ maxWidth: 640 }}>
            <thead><tr><th>Servizio</th><th>Quando</th><th>Stato</th></tr></thead>
            <tbody>
              {richieste.map((r) => (
                <tr key={r.id}>
                  <td>{r.servizio === 'domicilio' ? 'Cura a domicilio' : 'Trasporto'}</td>
                  <td>{dataIt(r.dal)}{r.al && r.al !== r.dal ? ` → ${dataIt(r.al)}` : ''}</td>
                  <td>{r.stato === 'nuova' ? 'In attesa di conferma' : r.stato}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {abb && piano && (
        <>
          <h2 style={{ marginTop: 50, fontSize: '1.5rem' }}>Il tuo abbonamento</h2>
          <p className="guida stretta" style={{ marginTop: 10 }}>
            {nomeCorto}, {euro(Number(piano.quota_mensile))} al mese per {fmtCrediti(Number(piano.crediti_mensili))}{' '}
            notti-credito, attivo dal {dataIt(abb.data_inizio)}. Il vincolo minimo è di{' '}
            {piano.vincolo_minimo_mesi} mesi; dopo la disdetta i crediti restano validi 60 giorni.
            {!abb.stripe_subscription_id && ' Attivato in modalità dimostrativa, senza addebiti reali.'}
          </p>
          <DisdiciAbbonamento />
        </>
      )}
    </main>
  );
}
