'use client';

import { useState } from 'react';
import { euro, crediti as fmtCrediti, type Preventivo } from '@/lib/types';

/**
 * Il simulatore serve a due cose:
 *  1. dire a un cliente se l'abbonamento gli conviene davvero
 *  2. dimostrare che il modello non e' aggirabile, eseguendo davanti
 *     a chi guarda gli scenari di abuso
 */

const QUOTE: Record<string, number> = { base: 19, plus: 39, premium: 69 };

interface Soggiorno { dal: string; al: string; etichetta: string }

interface Scenario {
  id: string;
  titolo: string;
  spiegazione: string;
  piano: string | null;
  mesi: number;
  mesiPagati: number;      // quante quote versa in un anno di riferimento
  creditiIniziali: number;
  soggiorni: Soggiorno[];
  attesa: string;
}

const SCENARI: Scenario[] = [
  {
    id: 'furbo-premium',
    titolo: 'L’opportunista: si iscrive a giugno, parte ad agosto, disdice a settembre',
    spiegazione:
      'Sottoscrive il Premium solo per sfruttare l’alta stagione e rispetta il vincolo minimo di tre mesi.',
    piano: 'premium', mesi: 3, mesiPagati: 3, creditiIniziali: 18,
    soggiorni: [{ dal: '2026-08-12', al: '2026-08-19', etichetta: 'Una settimana a Ferragosto' }],
    attesa: 'I crediti non valgono in alta stagione nel primo anno: paga il listino pieno più tre quote.',
  },
  {
    id: 'forfait',
    titolo: 'Lo stesso soggiorno, senza abbonamento',
    spiegazione: 'Il termine di paragone: nessuna iscrizione, nessun credito.',
    piano: null, mesi: 0, mesiPagati: 0, creditiIniziali: 0,
    soggiorni: [{ dal: '2026-08-12', al: '2026-08-19', etichetta: 'Una settimana a Ferragosto' }],
    attesa: 'Prezzo di listino puro. È il numero che l’opportunista deve battere, e non ci riesce.',
  },
  {
    id: 'socio-fedele',
    titolo: 'Il socio Plus al secondo anno',
    spiegazione:
      'Una settimana ad agosto, due weekend lunghi e qualche notte feriale: il profilo per cui il piano è pensato.',
    piano: 'plus', mesi: 14, mesiPagati: 12, creditiIniziali: 36,
    soggiorni: [
      { dal: '2026-08-12', al: '2026-08-19', etichetta: 'Una settimana a Ferragosto' },
      { dal: '2026-05-15', al: '2026-05-17', etichetta: 'Weekend di maggio' },
      { dal: '2026-10-16', al: '2026-10-18', etichetta: 'Weekend di ottobre' },
      { dal: '2026-02-09', al: '2026-02-15', etichetta: 'Sei notti feriali a febbraio' },
    ],
    attesa: 'I crediti coprono tutto: paga solo le dodici quote e risparmia rispetto al listino.',
  },
  {
    id: 'tetto',
    titolo: 'Il tetto di alta stagione che morde',
    spiegazione:
      'Socio Plus al secondo anno che ha già usato 6 delle 8 notti di alta stagione a credito.',
    piano: 'plus', mesi: 14, mesiPagati: 12, creditiIniziali: 36,
    soggiorni: [{ dal: '2026-08-12', al: '2026-08-19', etichetta: 'Una settimana a Ferragosto' }],
    attesa: 'Solo due notti coperte dai crediti, le altre cinque a listino pieno.',
  },
  {
    id: 'base-primo-anno',
    titolo: 'Il socio Base che va in bassa stagione',
    spiegazione: 'Nel primo anno i crediti funzionano su tutto tranne agosto, Natale e Pasqua.',
    piano: 'base', mesi: 5, mesiPagati: 12, creditiIniziali: 5,
    soggiorni: [{ dal: '2026-02-09', al: '2026-02-14', etichetta: 'Cinque notti feriali' }],
    attesa: 'Coperto interamente dalla tessera, nessun contante.',
  },
];

interface Esito {
  listino: number;
  contante: number;
  creditiUsati: number;
  righe: { etichetta: string; p: Preventivo }[];
}

export default function Simulatore() {
  const [esiti, setEsiti] = useState<Record<string, Esito>>({});
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function esegui(s: Scenario) {
    setInCorso(s.id);
    setErrore(null);
    try {
      let saldo = s.creditiIniziali;
      let altaUsate = s.id === 'tetto' ? 6 : 0;
      let listino = 0, contante = 0, usati = 0;
      const righe: { etichetta: string; p: Preventivo }[] = [];

      // I soggiorni si calcolano in sequenza: ognuno consuma dalla tessera
      // e incide sul tetto annuo di alta stagione, come nella realta'.
      for (const sog of s.soggiorni) {
        const r = await fetch('/api/preventivo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            check_in: sog.dal, check_out: sog.al, n_gatti: 1,
            piano: s.piano, mesi_iscrizione: s.mesi,
            crediti_disponibili: saldo, alta_gia_usate: altaUsate,
            usa_profilo: false,
          }),
        });
        const p: Preventivo = await r.json();
        if ((p as any).errore) throw new Error((p as any).errore);

        saldo = p.crediti_residui;
        altaUsate += p.notti_alta_a_credito;
        listino += p.totale_listino;
        contante += p.contante_dovuto;
        usati += p.crediti_usati;
        righe.push({ etichetta: sog.etichetta, p });
      }

      setEsiti((e) => ({ ...e, [s.id]: { listino, contante, creditiUsati: usati, righe } }));
    } catch (e) {
      setErrore('Il calcolo non è andato a buon fine. Controlla che il database sia raggiungibile.');
    } finally {
      setInCorso(null);
    }
  }

  async function eseguiTutti() {
    for (const s of SCENARI) await esegui(s);
  }

  return (
    <section style={{ borderTop: 0 }}>
      <div className="wrap">
        <h2>Simulatore di scenari</h2>
        <p className="lede narrow">
          Ogni scenario passa dalla stessa funzione di prezzo che emette le prenotazioni vere.
          I primi due servono a verificare che l’abbonamento non sia sfruttabile: se
          l’opportunista spendesse meno del forfait, il modello sarebbe rotto.
        </p>

        <div className="paths">
          <button className="btn" onClick={eseguiTutti} disabled={inCorso !== null}>
            {inCorso ? 'Calcolo in corso…' : 'Esegui tutti gli scenari'}
          </button>
        </div>

        {errore && <div className="errore">{errore}</div>}

        {SCENARI.map((s) => {
          const e = esiti[s.id];
          const costoQuote = s.piano ? QUOTE[s.piano] * s.mesiPagati : 0;
          const totale = e ? e.contante + costoQuote : 0;
          const differenza = e ? totale - e.listino : 0;

          return (
            <div className="card" key={s.id} style={{ marginTop: 26 }}>
              <h3>{s.titolo}</h3>
              <p className="lede" style={{ fontSize: '.97rem' }}>{s.spiegazione}</p>

              {!e && (
                <button className="btn ghost" onClick={() => esegui(s)} disabled={inCorso !== null}>
                  Calcola questo scenario
                </button>
              )}

              {e && (
                <>
                  <table>
                    <thead>
                      <tr>
                        <th>Soggiorno</th>
                        <th className="num">Listino</th>
                        <th className="num">Crediti usati</th>
                        <th className="num">Contante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.righe.map((r) => (
                        <tr key={r.etichetta}>
                          <td>{r.etichetta}</td>
                          <td className="num">{euro(r.p.totale_listino)}</td>
                          <td className="num">{fmtCrediti(r.p.crediti_usati)}</td>
                          <td className="num">{euro(r.p.contante_dovuto)}</td>
                        </tr>
                      ))}
                      {s.piano && (
                        <tr>
                          <td>Quote versate ({s.mesiPagati} × {euro(QUOTE[s.piano])})</td>
                          <td className="num">—</td>
                          <td className="num">—</td>
                          <td className="num">{euro(costoQuote)}</td>
                        </tr>
                      )}
                      <tr>
                        <td><strong>Totale</strong></td>
                        <td className="num"><strong>{euro(e.listino)}</strong></td>
                        <td className="num"><strong>{fmtCrediti(e.creditiUsati)}</strong></td>
                        <td className="num"><strong>{euro(totale)}</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="verdict">
                    <strong>
                      {differenza > 0
                        ? `Spende ${euro(differenza)} in più del prezzo di listino.`
                        : differenza < 0
                          ? `Risparmia ${euro(-differenza)} rispetto al listino.`
                          : 'Pareggia esattamente il prezzo di listino.'}
                    </strong>{' '}
                    {s.attesa}
                  </div>
                </>
              )}
            </div>
          );
        })}

        <p className="note">
          Nota di lettura: negli scenari con abbonamento il totale comprende le quote versate,
          non solo quanto si paga al check-out. È l’unico confronto onesto con il forfait.
        </p>
      </div>
    </section>
  );
}
