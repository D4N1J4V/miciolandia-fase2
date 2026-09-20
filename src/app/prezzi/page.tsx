import { supabaseAdmin } from '@/lib/supabase';
import { euro } from '@/lib/types';
import { stripeConfigurato } from '@/lib/stripe';
import BottoneIscrizione from '@/components/BottoneIscrizione';

export const dynamic = 'force-dynamic';

const DETTAGLI: Record<string, { sotto: string; voci: string[] }> = {
  base: {
    sotto: 'Per chi parte poco ma non vuole più sentirsi dire “siamo pieni”.',
    voci: ['Posto garantito entro 48 ore', 'Notti extra a 18 € invece di 20 €',
           'Agosto e Natale prenotabili 90 giorni prima'],
  },
  plus: {
    sotto: 'Per chi viaggia tre o quattro volte l’anno e vuole vedere come sta il gatto.',
    voci: ['Foto giornaliere e spazzolatura a ogni soggiorno', 'Notti extra a 17 €',
           'Posto garantito e prenotazione prioritaria'],
  },
  premium: {
    sotto: 'Per chi viaggia per lavoro o ha più gatti in casa.',
    voci: ['Trasporto da e verso casa incluso', 'Toelettatura una volta al mese',
           'Notti extra a 17 €'],
  },
};

export default async function Prezzi({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const conStripe = stripeConfigurato();
  const db = supabaseAdmin();
  const [{ data: tariffe }, { data: piani }] = await Promise.all([
    db.from('tariffe').select('*').order('prezzo_notte'),
    db.from('piani').select('*').order('quota_mensile'),
  ]);

  return (
    <main className="wrap" style={{ paddingTop: 44, paddingBottom: 70 }}>
      <h1 style={{ fontSize: 'clamp(2rem,4.6vw,3rem)' }}>Prezzi</h1>
      <p className="guida stretta" style={{ marginTop: 14 }}>
        Sono tutti qui, senza preventivi da chiedere. Le notti costano di più quando tutti
        cercano posto e di meno quando gli spazi sono liberi: è lo stesso criterio per tutti.
      </p>

      <div className="listino">
        <table className="dati">
          <thead><tr><th>Periodo</th><th>Quando</th><th className="n">A notte</th></tr></thead>
          <tbody>
            {(tariffe ?? []).map((t) => (
              <tr key={t.tipo}>
                <td>{t.etichetta}</td>
                <td>
                  {t.tipo === 'bassa' && 'Notti dal lunedì al giovedì, fuori dai periodi di punta'}
                  {t.tipo === 'media' && 'Venerdì, sabato, domenica, ponti e vigilie'}
                  {t.tipo === 'alta' && 'Agosto, 20 dicembre – 6 gennaio, settimana di Pasqua'}
                </td>
                <td className="n">{euro(Number(t.prezzo_notte))}</td>
              </tr>
            ))}
            <tr><td>Secondo e terzo gatto</td><td>Stessa famiglia, stesso spazio</td><td className="n">−30%</td></tr>
            <tr><td>Soggiorno lungo</td><td>Dalla decima notte in poi</td><td className="n">−15%</td></tr>
            <tr><td>Cura a domicilio</td><td>Una visita al giorno a casa tua</td><td className="n">18 €</td></tr>
            <tr><td>Trasporto</td><td>Andata e ritorno entro 20 km</td><td className="n">15 €</td></tr>
          </tbody>
        </table>
        <p className="nota" style={{ marginTop: 14 }}>
          Sempre inclusi: cibo standard, lettiera, pulizia quotidiana e somministrazione di
          farmaci orali. Cibo particolare e terapie iniettive si concordano all’arrivo.
        </p>
      </div>

      <h2 id="piani" style={{ marginTop: 56 }}>I tre abbonamenti</h2>
      <p className="guida stretta" style={{ marginTop: 14 }}>
        Ogni mese ricevi delle notti-credito. Una notte feriale ne vale 1, un weekend 1,5,
        l’alta stagione 2. Si accumulano senza tetto e valgono dodici mesi.
      </p>

      <div className="servizi" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
        {(piani ?? []).map((p) => {
          const d = DETTAGLI[p.codice];
          return (
            <article className="servizio" key={p.codice} style={{ display: 'flex', flexDirection: 'column' }}>
              <h3>{p.nome.split('—')[0].split('-')[0].trim()}</h3>
              <div style={{ fontFamily: '"Bricolage Grotesque"', fontWeight: 800,
                            fontSize: '2.1rem', letterSpacing: '-.03em', margin: '8px 0 2px' }}>
                {euro(Number(p.quota_mensile))}
                <span style={{ fontFamily: '"Instrument Sans"', fontSize: '.82rem',
                               fontWeight: 500, color: 'var(--tenue)' }}> al mese</span>
              </div>
              <p className="nota" style={{ margin: '0 0 12px' }}>
                {Number(p.crediti_mensili)} notti-credito al mese ·
                {' '}{Number(p.crediti_mensili) * 12} all’anno
              </p>
              <p>{d?.sotto}</p>
              <ul style={{ paddingLeft: 18, margin: '10px 0 0', fontSize: '.93rem', color: 'var(--tenue)' }}>
                {d?.voci.map((v) => <li key={v} style={{ marginBottom: 5 }}>{v}</li>)}
                <li>Fino a {p.tetto_alta_annuo} notti di alta stagione all’anno con i crediti</li>
              </ul>
              <div style={{ marginTop: 'auto' }}>
                <BottoneIscrizione piano={p.codice}
                  etichetta={`Abbonati a ${p.nome.split(/\s[-—]\s/)[0]}`} />
              </div>
            </article>
          );
        })}
      </div>

      {searchParams.pagamento === 'annullato' && (
        <div className="avviso avviso-no" style={{ maxWidth: '68ch' }}>
          Il pagamento è stato interrotto e non ti è stato addebitato niente. Puoi riprovare quando vuoi.
        </div>
      )}

      <p className="nota" style={{ marginTop: 16, maxWidth: '68ch' }}>
        {conStripe
          ? 'Il pagamento passa da Stripe in modalità test: usa la carta 4242 4242 4242 4242, una scadenza futura e un CVC qualsiasi. Nessun addebito reale.'
          : 'Modalità dimostrativa: Stripe non è collegato, quindi l’abbonamento si attiva subito con un pagamento simulato.'}
        {' '}Vincolo minimo tre mesi, poi disdici quando vuoi dalla tua area. Sotto le dieci notti
        l’anno l’abbonamento non si ripaga: in quel caso conviene prenotare a listino.
      </p>

      <div className="avviso avviso-ok" style={{ maxWidth: '68ch' }}>
        In alta stagione le notti-credito si sbloccano dal tredicesimo mese di iscrizione.
        Nel primo anno agosto e Natale si pagano a listino, ma il posto è garantito e
        prenoti novanta giorni prima di tutti gli altri.
      </div>

      <div className="riga" style={{ marginTop: 28 }}>
        <a className="btn" href="/prenota">Guarda il calendario</a>
        <a className="btn btn-vuoto" href="/faq">Le domande più frequenti</a>
      </div>
    </main>
  );
}
