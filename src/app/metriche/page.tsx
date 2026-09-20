import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { verificaStaff } from '@/lib/ruoli';
import AccessoNegato from '@/components/AccessoNegato';
import { euro } from '@/lib/types';
import FormSpesa from '@/components/FormSpesa';

export const dynamic = 'force-dynamic';

const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
              'luglio','agosto','settembre','ottobre','novembre','dicembre'];

function nomeMese(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return `${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Le due metriche della fase 2.
 * Il numeratore e' la spesa pubblicitaria, che si inserisce a mano una
 * volta al mese; il denominatore arriva dalle tabelle reali. Senza la
 * spesa registrata le colonne restano vuote, ed e' giusto cosi': meglio
 * una cella vuota di un numero inventato.
 */
export default async function Metriche() {
  const accesso = await verificaStaff();
  if (accesso.stato === 'anonimo') redirect('/login?torna=/metriche');
  if (accesso.stato === 'negato') return <AccessoNegato email={accesso.email} />;

  const admin = supabaseAdmin();
  const [{ data: righe }, { data: imbuto }, { data: ultimiLead }] = await Promise.all([
    admin.from('metriche_mensili').select('*').limit(12),
    admin.from('imbuto_30gg').select('*'),
    admin.from('lead').select('creato_il, percorso, piano, comune, stato')
      .order('creato_il', { ascending: false }).limit(12),
  ]);

  const corrente = righe?.[0];

  return (
    <main className="wrap" style={{ paddingTop: 44, paddingBottom: 70 }}>
      <h1 style={{ fontSize: 'clamp(1.9rem,4.4vw,2.8rem)' }}>Metriche</h1>
      <p className="guida stretta" style={{ marginTop: 14 }}>
        Costo per iscritto e costo per prenotazione sono le due misure che decidono se la
        campagna regge. Si calcolano dividendo la spesa del mese per quanti iscritti e
        quante prenotazioni ha prodotto quel mese.
      </p>

      <div className="kpi-griglia">
        <div className="kpi">
          <div className="k">Spesa del mese</div>
          <div className="v">{corrente ? euro(Number(corrente.spesa_ads)) : '—'}</div>
        </div>
        <div className="kpi">
          <div className="k">Costo per iscritto</div>
          <div className="v">
            {corrente?.costo_per_iscritto ? euro(Number(corrente.costo_per_iscritto)) : '—'}
          </div>
          <div className="k">{corrente?.iscritti ?? 0} iscritti</div>
        </div>
        <div className="kpi">
          <div className="k">Costo per prenotazione</div>
          <div className="v">
            {corrente?.costo_per_prenotazione ? euro(Number(corrente.costo_per_prenotazione)) : '—'}
          </div>
          <div className="k">{corrente?.prenotazioni ?? 0} prenotazioni</div>
        </div>
        <div className="kpi">
          <div className="k">Costo per contatto</div>
          <div className="v">
            {corrente?.costo_per_contatto ? euro(Number(corrente.costo_per_contatto)) : '—'}
          </div>
          <div className="k">{corrente?.contatti ?? 0} contatti raccolti</div>
        </div>
      </div>

      {corrente && Number(corrente.spesa_ads) > 0 && corrente.costo_per_iscritto && (
        <div
          className={
            Number(corrente.costo_per_iscritto) > 39 * 6 ? 'avviso avviso-no' : 'avviso avviso-ok'
          }
          style={{ maxWidth: '70ch' }}
        >
          {Number(corrente.costo_per_iscritto) > 39 * 6
            ? `Un iscritto costa ${euro(Number(corrente.costo_per_iscritto))}, più di sei mesi di quota Plus: a questo ritmo la campagna non si ripaga prima di mezzo anno. Va rivista l’offerta o il pubblico.`
            : `Un iscritto costa ${euro(Number(corrente.costo_per_iscritto))}, meno di sei mesi di quota Plus: la campagna rientra entro il primo semestre.`}
        </div>
      )}

      <h2 style={{ marginTop: 50, fontSize: '1.5rem' }}>Mese per mese</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="dati" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>Mese</th>
              <th className="n">Spesa</th>
              <th className="n">Contatti</th>
              <th className="n">Iscritti</th>
              <th className="n">Prenotazioni</th>
              <th className="n">€ / iscritto</th>
              <th className="n">€ / prenotazione</th>
            </tr>
          </thead>
          <tbody>
            {(righe ?? []).map((r) => (
              <tr key={r.mese}>
                <td>{nomeMese(r.mese)}</td>
                <td className="n">{euro(Number(r.spesa_ads))}</td>
                <td className="n">{r.contatti}</td>
                <td className="n">{r.iscritti}</td>
                <td className="n">{r.prenotazioni}</td>
                <td className="n">{r.costo_per_iscritto ? euro(Number(r.costo_per_iscritto)) : '—'}</td>
                <td className="n">{r.costo_per_prenotazione ? euro(Number(r.costo_per_prenotazione)) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 50, fontSize: '1.5rem' }}>Registra la spesa</h2>
      <p className="guida stretta" style={{ marginTop: 12 }}>
        Da inserire una volta al mese, prendendo il totale dal gestore della campagna.
      </p>
      <FormSpesa />

      <h2 style={{ marginTop: 50, fontSize: '1.5rem' }}>Dove si perde la gente</h2>
      <p className="guida stretta" style={{ marginTop: 12 }}>
        Sessioni distinte per passaggio, ultimi trenta giorni.
      </p>
      <table className="dati" style={{ maxWidth: 560 }}>
        <thead><tr><th>Passaggio</th><th>Percorso</th><th className="n">Sessioni</th></tr></thead>
        <tbody>
          {(imbuto ?? []).map((r, i) => (
            <tr key={i}>
              <td>{r.nome}</td>
              <td>{r.percorso}</td>
              <td className="n">{r.sessioni}</td>
            </tr>
          ))}
          {!imbuto?.length && (
            <tr><td colSpan={3} className="nota">Ancora nessun evento registrato.</td></tr>
          )}
        </tbody>
      </table>

      <h2 style={{ marginTop: 50, fontSize: '1.5rem' }}>Ultimi contatti</h2>
      <table className="dati" style={{ maxWidth: 680 }}>
        <thead><tr><th>Quando</th><th>Percorso</th><th>Piano</th><th>Zona</th><th>Stato</th></tr></thead>
        <tbody>
          {(ultimiLead ?? []).map((l, i) => (
            <tr key={i}>
              <td>{new Date(l.creato_il).toLocaleDateString('it-IT')}</td>
              <td>{l.percorso}</td>
              <td>{l.piano ?? '—'}</td>
              <td>{l.comune ?? '—'}</td>
              <td>{l.stato}</td>
            </tr>
          ))}
          {!ultimiLead?.length && (
            <tr><td colSpan={5} className="nota">Nessun contatto ancora.</td></tr>
          )}
        </tbody>
      </table>


    </main>
  );
}
