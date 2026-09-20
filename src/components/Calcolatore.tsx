'use client';

import { useEffect, useState } from 'react';
import { euro, crediti as fmtCrediti, dataBreve, ETICHETTE, type Preventivo } from '@/lib/types';

interface Props {
  /** true nella home: mostra anche i selettori di scenario (piano, anzianita'). */
  conScenario?: boolean;
}

export default function Calcolatore({ conScenario = true }: Props) {
  const [checkIn, setCheckIn] = useState('2026-08-12');
  const [checkOut, setCheckOut] = useState('2026-08-19');
  const [nGatti, setNGatti] = useState(1);
  const [piano, setPiano] = useState<string>('plus');
  const [mesi, setMesi] = useState(14);
  const [saldo, setSaldo] = useState(20);
  const [dati, setDati] = useState<(Preventivo & { box_liberi?: number }) | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(false);

  useEffect(() => {
    let annullato = false;
    const t = setTimeout(async () => {
      setCaricando(true);
      setErrore(null);
      try {
        const r = await fetch('/api/preventivo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            check_in: checkIn,
            check_out: checkOut,
            n_gatti: nGatti,
            piano: piano === 'nessuno' ? null : piano,
            mesi_iscrizione: mesi,
            crediti_disponibili: saldo,
            usa_profilo: !conScenario,
          }),
        });
        const j = await r.json();
        if (annullato) return;
        if (j.errore) { setErrore(j.errore); setDati(null); }
        else setDati(j);
      } catch {
        if (!annullato) setErrore('Non riesco a calcolare il preventivo. Riprova.');
      } finally {
        if (!annullato) setCaricando(false);
      }
    }, 250);
    return () => { annullato = true; clearTimeout(t); };
  }, [checkIn, checkOut, nGatti, piano, mesi, saldo, conScenario]);

  const verdetto = (): string => {
    if (!dati) return '';
    if (dati.piano && dati.notti_alta > 0 && !dati.alta_sbloccata) {
      return `Sei nel primo anno di abbonamento: le ${dati.notti_alta} notti di alta stagione si pagano a listino, come per un non socio. Quello che l’abbonamento ti dà adesso è il posto garantito e la prenotazione tre mesi prima degli altri. Dal tredicesimo mese i crediti valgono anche qui.`;
    }
    if (dati.contante_dovuto === 0 && dati.crediti_usati > 0) {
      return `Coperto interamente dalla tessera: ${fmtCrediti(dati.crediti_usati)} crediti, zero euro da aggiungere. A listino sarebbero stati ${euro(dati.totale_listino)}.`;
    }
    if (dati.crediti_usati > 0) {
      return `La tessera copre ${fmtCrediti(dati.crediti_usati)} crediti; restano ${euro(dati.contante_dovuto)} da pagare. A listino il soggiorno costerebbe ${euro(dati.totale_listino)}.`;
    }
    return `Senza abbonamento il soggiorno costa ${euro(dati.totale_listino)}. Servirebbero ${fmtCrediti(dati.crediti_necessari)} crediti per coprirlo con la tessera.`;
  };

  return (
    <div className="card">
      <div className="fields">
        <div className="field">
          <label htmlFor="ci">Arrivo</label>
          <input id="ci" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="co">Partenza</label>
          <input id="co" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ng">Gatti</label>
          <select id="ng" value={nGatti} onChange={(e) => setNGatti(Number(e.target.value))}>
            <option value={1}>1 gatto</option>
            <option value={2}>2 gatti (stessa famiglia)</option>
            <option value={3}>3 gatti (stessa famiglia)</option>
          </select>
        </div>

        {conScenario && (
          <>
            <div className="field">
              <label htmlFor="pi">Piano</label>
              <select id="pi" value={piano} onChange={(e) => setPiano(e.target.value)}>
                <option value="nessuno">Nessun abbonamento</option>
                <option value="base">Base</option>
                <option value="plus">Plus</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="me">Mesi da socio</label>
              <input id="me" type="number" min={0} max={60} value={mesi}
                     onChange={(e) => setMesi(Number(e.target.value))} style={{ width: 90 }} />
            </div>
            <div className="field">
              <label htmlFor="sa">Crediti in tessera</label>
              <input id="sa" type="number" min={0} max={200} step={0.5} value={saldo}
                     onChange={(e) => setSaldo(Number(e.target.value))} style={{ width: 90 }} />
            </div>
          </>
        )}
      </div>

      {errore && <div className="errore">{errore}</div>}

      {dati && (
        <>
          <div style={{ marginTop: 20, maxHeight: 230, overflow: 'auto' }}>
            {dati.righe.map((r) => (
              <div className="nrow" key={r.data}>
                <span>{dataBreve(r.data)}</span>
                <span className={`tag t-${r.tipo}`}>{ETICHETTE[r.tipo]}</span>
                <span>
                  {r.pagata_con === 'crediti'
                    ? `${fmtCrediti(r.crediti)} crediti`
                    : euro(r.contante)}
                </span>
              </div>
            ))}
          </div>

          <div className="totals">
            <div className="tot">
              <div className="k">Prezzo a listino</div>
              <div className="v">{euro(dati.totale_listino)}</div>
              <div className="k">
                {dati.notti} notti{typeof dati.box_liberi === 'number' ? ` · ${dati.box_liberi} box liberi` : ''}
              </div>
            </div>
            <div className="tot hi">
              <div className="k">Quanto paghi</div>
              <div className="v">
                {dati.crediti_usati > 0 ? `${fmtCrediti(dati.crediti_usati)} crediti` : euro(dati.contante_dovuto)}
                {dati.crediti_usati > 0 && dati.contante_dovuto > 0 ? ` + ${euro(dati.contante_dovuto)}` : ''}
              </div>
              <div className="k">
                {dati.crediti_usati > 0 ? `${fmtCrediti(dati.crediti_residui)} crediti restano in tessera` : 'nessun credito utilizzato'}
              </div>
            </div>
          </div>

          <div className="verdict">{verdetto()}</div>
          {caricando && <p className="note">Aggiorno il calcolo…</p>}
        </>
      )}
    </div>
  );
}
