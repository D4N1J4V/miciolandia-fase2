import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { verificaStaff } from '@/lib/ruoli';
import AccessoNegato from '@/components/AccessoNegato';
import { euro, crediti as fmtCrediti } from '@/lib/types';

export const dynamic = 'force-dynamic';

function uno<T>(x: T | T[] | null): T | null {
  return Array.isArray(x) ? x[0] ?? null : x;
}

/**
 * Pannello gestore. Il dato che conta davvero e' l'ultimo:
 * il tasso di utilizzo dei crediti. Se i soci usano molto piu' del 60%
 * di quanto accumulano, il punto di pareggio si sposta e le quote
 * vanno riviste.
 */
export default async function Gestore() {
  const accesso = await verificaStaff();
  if (accesso.stato === 'anonimo') redirect('/login?torna=/gestore');
  if (accesso.stato === 'negato') return <AccessoNegato email={accesso.email} />;

  const db = supabaseAdmin();
  const oggi = new Date().toISOString().slice(0, 10);
  const fraSette = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [{ count: boxTotali }, { data: inCorso }, { data: arrivi }, { data: partenze }] =
    await Promise.all([
      db.from('box').select('*', { count: 'exact', head: true }).eq('attivo', true),
      db.from('prenotazioni').select('id')
        .eq('stato', 'confermata').lte('check_in', oggi).gt('check_out', oggi),
      db.from('prenotazioni').select('id, check_in, check_out, n_gatti, clienti(nome)')
        .eq('stato', 'confermata').eq('check_in', oggi),
      db.from('prenotazioni').select('id, check_in, check_out, clienti(nome)')
        .eq('stato', 'confermata').eq('check_out', oggi),
    ]);

  const [{ data: abbonamenti }, { data: prossimi }, { data: richieste }] = await Promise.all([
    db.from('abbonamenti').select('piano_codice').eq('stato', 'attivo'),
    db.from('prenotazioni')
      .select('id, check_in, check_out, n_gatti, crediti_usati, contante_dovuto, clienti(nome), gatti(nome), box(nome)')
      .eq('stato', 'confermata').gt('check_in', oggi).lte('check_in', fraSette).order('check_in'),
    db.from('richieste_servizio')
      .select('id, servizio, nome, telefono, comune, dal, al, visite, stato')
      .in('stato', ['nuova', 'confermata']).order('dal').limit(20),
  ]);

  const { data: saldi } = await db.from('saldo_crediti').select('*');

  const accreditati = (saldi ?? []).reduce((s, r) => s + Number(r.totale_accreditato ?? 0), 0);
  const scaduti = (saldi ?? []).reduce((s, r) => s + Number(r.totale_scaduto ?? 0), 0);
  const inTessera = (saldi ?? []).reduce((s, r) => s + Number(r.saldo ?? 0), 0);
  // Usati davvero = accreditati meno quello che e' ancora in tessera o e' scaduto.
  // Il solo totale dei consumi conterebbe anche i soggiorni annullati e rimborsati.
  const consumati = Math.max(accreditati - inTessera - scaduti, 0);
  const utilizzo = accreditati > 0 ? (consumati / accreditati) * 100 : 0;

  const perPiano = (abbonamenti ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.piano_codice] = (acc[a.piano_codice] ?? 0) + 1;
    return acc;
  }, {});

  const { data: piani } = await db.from('piani').select('codice, quota_mensile');
  const quote: Record<string, number> = Object.fromEntries(
    (piani ?? []).map((p) => [p.codice, Number(p.quota_mensile)]));
  const ricorrente = Object.entries(perPiano)
    .reduce((s, [p, n]) => s + (quote[p] ?? 0) * n, 0);

  const occupati = inCorso?.length ?? 0;
  const totali = boxTotali ?? 0;

  return (
    <section style={{ borderTop: 0 }}>
      <div className="wrap">
        <h2>Pannello gestore</h2>

        <div className="griglia">
          <div className="kpi">
            <div className="k">Box occupati adesso</div>
            <div className="v">{occupati} / {totali}</div>
            <div className="k">{totali > 0 ? Math.round((occupati / totali) * 100) : 0}% di occupazione</div>
          </div>
          <div className="kpi">
            <div className="k">Ricavo ricorrente mensile</div>
            <div className="v">{euro(ricorrente)}</div>
            <div className="k">{abbonamenti?.length ?? 0} abbonamenti attivi</div>
          </div>
          <div className="kpi">
            <div className="k">Utilizzo dei crediti</div>
            <div className="v">{utilizzo.toFixed(0)}%</div>
            <div className="k">
              {fmtCrediti(consumati)} usati su {fmtCrediti(accreditati)} accreditati
            </div>
          </div>
          <div className="kpi">
            <div className="k">Crediti scaduti</div>
            <div className="v">{fmtCrediti(scaduti)}</div>
            <div className="k">margine aggiuntivo non utilizzato</div>
          </div>
        </div>

        <div className="verdict" style={{ marginTop: 24 }}>
          {utilizzo > 80
            ? 'Attenzione: i soci stanno usando più dell’80% dei crediti accumulati. Il punto di pareggio calcolato sul 60% non regge più: vanno riviste le quote o i tetti di alta stagione.'
            : utilizzo < 40
              ? 'Utilizzo basso: i soci accumulano senza prenotare. Prima che i crediti scadano conviene sollecitarli, altrimenti il rinnovo salta.'
              : 'Utilizzo nella fascia attesa. Il punto di pareggio calcolato sul 60% di utilizzo regge.'}
        </div>

        <h3 style={{ marginTop: 44 }}>Arrivi di oggi</h3>
        {arrivi?.length ? (
          <table>
            <thead><tr><th>Cliente</th><th>Fino al</th><th className="num">Gatti</th></tr></thead>
            <tbody>
              {arrivi.map((a) => {
                const c = Array.isArray(a.clienti) ? a.clienti[0] : a.clienti;
                return (
                  <tr key={a.id}>
                    <td>{c?.nome ?? '—'}</td>
                    <td>{a.check_out}</td>
                    <td className="num">{a.n_gatti}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="lede">Nessun arrivo previsto oggi.</p>}

        <h3 style={{ marginTop: 40 }}>Partenze di oggi</h3>
        {partenze?.length ? (
          <table>
            <thead><tr><th>Cliente</th><th>Arrivato il</th></tr></thead>
            <tbody>
              {partenze.map((p) => {
                const c = Array.isArray(p.clienti) ? p.clienti[0] : p.clienti;
                return (
                  <tr key={p.id}>
                    <td>{c?.nome ?? '—'}</td>
                    <td>{p.check_in}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="lede">Nessuna partenza prevista oggi.</p>}

        <h3 style={{ marginTop: 40 }}>Arrivi dei prossimi sette giorni</h3>
        {prossimi?.length ? (
          <table>
            <thead><tr><th>Arrivo</th><th>Partenza</th><th>Cliente</th><th>Gatto</th><th>Box</th><th className="num">Da incassare</th></tr></thead>
            <tbody>
              {prossimi.map((p) => {
                return (
                  <tr key={p.id}>
                    <td>{p.check_in}</td>
                    <td>{p.check_out}</td>
                    <td>{uno(p.clienti)?.nome ?? '—'}</td>
                    <td>{uno(p.gatti)?.nome ?? '—'}{p.n_gatti > 1 ? ` +${p.n_gatti - 1}` : ''}</td>
                    <td>{uno(p.box)?.nome ?? '—'}</td>
                    <td className="num">{euro(Number(p.contante_dovuto))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="lede">Nessun arrivo nei prossimi sette giorni.</p>}

        <h3 style={{ marginTop: 40 }}>Richieste di domicilio e trasporto</h3>
        {richieste?.length ? (
          <table>
            <thead><tr><th>Servizio</th><th>Quando</th><th>Cliente</th><th>Telefono</th><th>Comune</th><th>Stato</th></tr></thead>
            <tbody>
              {richieste.map((r) => (
                <tr key={r.id}>
                  <td>{r.servizio === 'domicilio' ? `Domicilio, ${r.visite} visite` : 'Trasporto'}</td>
                  <td>{r.dal}{r.al && r.al !== r.dal ? ` → ${r.al}` : ''}</td>
                  <td>{r.nome}</td>
                  <td>{r.telefono}</td>
                  <td>{r.comune}</td>
                  <td>{r.stato}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="lede">Nessuna richiesta in attesa.</p>}
      </div>
    </section>
  );
}
