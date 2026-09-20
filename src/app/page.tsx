import { supabaseAdmin } from '@/lib/supabase';

export const revalidate = 3600;

const SERVIZI: { titolo: string; testo: string; tariffa: string; href?: string }[] = [
  {
    titolo: 'Zona comune',
    testo: 'Interna ed esterna, per i gatti che stanno volentieri in compagnia. Prima di inserirne uno facciamo una prova di compatibilità: se non funziona, torna nel suo spazio.',
    tariffa: 'Inclusa nel soggiorno',
  },
  {
    titolo: 'Cuccia riservata',
    testo: 'Uno spazio solo suo per i gatti poco socievoli o per chi la preferisce. Nessun cane in struttura, quindi nessun rumore a cui abituarsi.',
    tariffa: 'Inclusa nel soggiorno',
  },
  {
    titolo: 'Cura a domicilio',
    testo: 'Una visita al giorno a casa tua: cibo, acqua, lettiera, farmaci se servono, e le stesse foto che riceveresti se fosse da noi.',
    tariffa: '18 € a visita',
    href: '/servizi',
  },
  {
    titolo: 'Trasporto',
    testo: 'Veniamo a prenderlo e te lo riportiamo. Puoi usarlo anche da solo, per esempio per accompagnarlo dal veterinario.',
    tariffa: '15 € andata e ritorno entro 20 km',
    href: '/servizi',
  },
  {
    titolo: 'Abbonamento',
    testo: 'Ogni mese accumuli notti sulla tessera e il posto è garantito entro 48 ore, anche nelle settimane in cui tutti cercano.',
    tariffa: 'Da 19 € al mese',
    href: '/prezzi#piani',
  },
  {
    titolo: 'Scheda del gatto',
    testo: 'Carattere, abitudini, terapie e libretto vaccinale si compilano una volta sola. Alla seconda prenotazione non ti chiediamo più niente.',
    tariffa: 'Gratuita',
    href: '/gatto',
  },
];

export default async function Home() {
  const db = supabaseAdmin();
  const { data: tariffe } = await db.from('tariffe').select('*').order('prezzo_notte');

  return (
    <main>
      <div className="wrap">
        <section className="hero">
          <div className="testata">
            <h1>Il tuo gatto<br />non va in gabbia.</h1>
            <p className="guida" style={{ margin: 0 }}>
              Pensione per soli gatti a Bergamo e provincia: zona comune interna ed esterna,
              cuccia riservata per chi la preferisce, e se il trasportino è un dramma veniamo
              noi da te. I prezzi sono pubblici e la disponibilità è in tempo reale.
            </p>
          </div>

          <div className="porte">
            <div className="porta porta-scura">
              <div className="tetto">Se parti spesso</div>
              <h2>Abbonati e blocca il posto</h2>
              <ul>
                <li>Posto garantito entro 48 ore, tutto l’anno</li>
                <li>Le notti si accumulano e valgono 12 mesi</li>
                <li>Foto e aggiornamenti ogni giorno, inclusi</li>
              </ul>
              <div className="fondo">
                <div className="prezzo">da 19 € <span>al mese</span></div>
                <p className="nota" style={{ margin: '4px 0 16px', opacity: .8 }}>
                  Tre piani, disdetta libera dopo tre mesi
                </p>
                <a className="btn" href="/prezzi#piani">Vedi i piani</a>
              </div>
            </div>

            <div className="porta porta-chiara">
              <div className="tetto">Se parti una volta ogni tanto</div>
              <h2>Prenota una notte</h2>
              <ul>
                <li>Disponibilità e prezzo in tempo reale sul calendario</li>
                <li>Disdetta gratuita fino a 72 ore prima</li>
                <li>Trasporto da casa tua su richiesta</li>
              </ul>
              <div className="fondo">
                <div className="prezzo">da 20 € <span>a notte</span></div>
                <p className="nota" style={{ margin: '4px 0 16px', opacity: .8 }}>
                  Secondo gatto della stessa famiglia −30%
                </p>
                <a className="btn" href="/prenota">Scegli le date</a>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="servizi">
        <div className="wrap">
          <h2>Cosa offriamo</h2>
          <p className="guida stretta" style={{ marginTop: 14 }}>
            Le singole cose esistono già in provincia, ma separate: chi ha la zona esterna
            non fa il trasporto, chi viene a casa non ha la struttura. Qui stanno insieme.
          </p>
          <div className="servizi">
            {SERVIZI.map((s) => (
              <article className="servizio" key={s.titolo}>
                <h3>{s.titolo}</h3>
                <p>{s.testo}</p>
                <span className="tariffa">{s.tariffa}</span>
                {s.href && <a className="nota" href={s.href} style={{ display: 'inline-block', marginTop: 8 }}>Scopri di più →</a>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>Quanto costa una notte</h2>
          <div className="listino">
            <table className="dati">
              <thead>
                <tr><th>Periodo</th><th>Quando</th><th className="n">A notte</th></tr>
              </thead>
              <tbody>
                {(tariffe ?? []).map((t) => (
                  <tr key={t.tipo}>
                    <td>{t.etichetta}</td>
                    <td>
                      {t.tipo === 'bassa' && 'Notti dal lunedì al giovedì'}
                      {t.tipo === 'media' && 'Venerdì, sabato, domenica e ponti'}
                      {t.tipo === 'alta' && 'Agosto, Natale, Pasqua'}
                    </td>
                    <td className="n">{Number(t.prezzo_notte).toFixed(0)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="riga" style={{ marginTop: 22 }}>
            <a className="btn" href="/prenota">Guarda il calendario</a>
            <a className="btn btn-vuoto" href="/prezzi">Listino completo e abbonamenti</a>
          </div>
        </div>
      </section>
    </main>
  );
}
