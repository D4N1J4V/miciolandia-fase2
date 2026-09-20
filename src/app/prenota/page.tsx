'use client';

import { useEffect, useState } from 'react';
import Calendario from '@/components/Calendario';
import { traccia } from '@/lib/traccia';
import { euro, crediti as fmtCrediti, dataBreve, ETICHETTE, type Preventivo } from '@/lib/types';

type Risposta = Preventivo & { box_liberi?: number; socio?: boolean; saldo_attuale?: number };

export default function Prenota() {
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [nGatti, setNGatti] = useState(1);
  const [gatti, setGatti] = useState<{ id: number; nome: string }[] | null>(null);
  const [gattoId, setGattoId] = useState<number | null>(null);
  const [prev, setPrev] = useState<Risposta | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [fatta, setFatta] = useState<string | null>(null);
  const [versione, setVersione] = useState(0);

  useEffect(() => { traccia('vista_prenota'); }, []);

  // Se l'utente e' dentro, la prenotazione si lega alla scheda del gatto.
  useEffect(() => {
    fetch('/api/gatti')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setGatti(j.gatti ?? []);
        if (j.gatti?.[0]) setGattoId(j.gatti[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!checkIn || !checkOut) { setPrev(null); return; }
    let annullato = false;
    fetch('/api/preventivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ check_in: checkIn, check_out: checkOut, n_gatti: nGatti }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (annullato) return;
        if (j.errore) { setErrore(j.errore); setPrev(null); }
        else { setErrore(null); setPrev(j); traccia('preventivo', { notti: j.notti }); }
      })
      .catch(() => { if (!annullato) setErrore('Non riesco a calcolare il preventivo. Controlla la connessione e riprova.'); });
    return () => { annullato = true; };
  }, [checkIn, checkOut, nGatti, versione]);

  async function conferma() {
    if (!checkIn || !checkOut) return;
    setInvio(true);
    setErrore(null);
    try {
      const r = await fetch('/api/prenotazioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_in: checkIn, check_out: checkOut, n_gatti: nGatti, gatto_id: gattoId }),
      });
      if (r.status === 401) { window.location.href = '/login?torna=/prenota'; return; }
      const j = await r.json();
      if (j.errore) { setErrore(j.errore); return; }
      traccia('prenotazione', { notti: j.notti, crediti: j.crediti_usati });
      setFatta(
        `Prenotazione confermata dal ${dataBreve(checkIn)} al ${dataBreve(checkOut)}.`
        + (Number(j.crediti_usati) > 0 ? ` Hai usato ${fmtCrediti(j.crediti_usati)} notti-credito.` : '')
        + ` Da pagare all’arrivo: ${euro(Number(j.contante_dovuto))}.`);
      setCheckIn(null);
      setCheckOut(null);
      setVersione((v) => v + 1);
    } catch {
      setErrore('Non sono riuscito a confermare. Riprova fra un momento.');
    } finally {
      setInvio(false);
    }
  }

  const perCrediti = prev?.righe.filter((r) => r.pagata_con === 'crediti').length ?? 0;
  const altaBloccate = prev?.socio && !prev.alta_sbloccata && prev.notti_alta > 0;

  return (
    <main className="wrap" style={{ paddingTop: 44, paddingBottom: 70 }}>
      <h1 style={{ fontSize: 'clamp(2rem,4.6vw,3rem)' }}>Scegli le date</h1>
      <p className="guida stretta" style={{ marginTop: 14 }}>
        Il colore di ogni giorno dice quanto costa quella notte. I giorni barrati sono
        esauriti: la disponibilità è quella vera, aggiornata sulle prenotazioni già confermate.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,1fr) minmax(280px,380px)',
                    gap: 24, alignItems: 'start', marginTop: 28 }}
           className="prenota-griglia">
        <Calendario
          key={versione}
          checkIn={checkIn}
          checkOut={checkOut}
          onCambia={(a, b) => { setCheckIn(a); setCheckOut(b); setFatta(null); }}
        />

        <aside className="pannello">
          <div className="campo" style={{ marginBottom: 14 }}>
            <label htmlFor="ng">Quanti gatti</label>
            <select id="ng" value={nGatti} onChange={(e) => setNGatti(Number(e.target.value))}>
              <option value={1}>1 gatto</option>
              <option value={2}>2 gatti della stessa famiglia</option>
              <option value={3}>3 gatti della stessa famiglia</option>
            </select>
          </div>

          {gatti && gatti.length > 0 && (
            <div className="campo" style={{ marginBottom: 14 }}>
              <label htmlFor="gt">Chi viene</label>
              <select id="gt" value={gattoId ?? ''} onChange={(e) => setGattoId(Number(e.target.value))}>
                {gatti.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
          )}
          {gatti && gatti.length === 0 && (
            <p className="nota">
              Non hai ancora compilato la <a href="/gatto">scheda del gatto</a>: puoi prenotare lo
              stesso e compilarla prima dell’arrivo.
            </p>
          )}

          {!prev && !fatta && (
            <p className="nota" style={{ margin: 0 }}>
              Seleziona arrivo e partenza sul calendario per vedere il totale.
            </p>
          )}

          {prev && (
            <>
              <div className="nota">{prev.notti} notti · {prev.notti_alta} in alta stagione</div>

              {prev.socio ? (
                <>
                  <div className="cifra">{euro(prev.contante_dovuto)}</div>
                  <div className="nota">da pagare all’arrivo, invece di {euro(prev.totale_listino)} a listino</div>
                  <div className="tessera">
                    <div><span>Notti-credito usate</span><strong>{fmtCrediti(prev.crediti_usati)}</strong></div>
                    <div><span>Notti coperte dalla tessera</span><strong>{perCrediti} su {prev.notti}</strong></div>
                    <div><span>In tessera dopo il soggiorno</span><strong>{fmtCrediti(prev.crediti_residui)}</strong></div>
                  </div>
                  {altaBloccate && (
                    <p className="nota">
                      Le notti di alta stagione si pagano a listino fino al tredicesimo mese di
                      iscrizione: la tessera copre le altre.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="cifra">{euro(prev.totale_listino)}</div>
                  <div className="nota">
                    oppure {fmtCrediti(prev.crediti_necessari)} notti-credito con l’abbonamento
                  </div>
                </>
              )}

              <div className="notti">
                {prev.righe.map((r) => (
                  <div className="notte-riga" key={r.data}>
                    <span>{dataBreve(r.data)}</span>
                    <span className={`etich e-${r.tipo}`}>{ETICHETTE[r.tipo]}</span>
                    <span>
                      {prev.socio
                        ? r.pagata_con === 'crediti' ? `${fmtCrediti(r.crediti)} cr.` : euro(r.contante)
                        : euro(r.prezzo_listino)}
                    </span>
                  </div>
                ))}
              </div>

              {typeof prev.box_liberi === 'number' && (
                <p className="nota" style={{ marginTop: 0 }}>
                  {prev.box_liberi > 0
                    ? `${prev.box_liberi} spazi liberi in queste date`
                    : 'Nessuno spazio libero in queste date: prova a spostarle di qualche giorno.'}
                </p>
              )}

              <button className="btn btn-grande" style={{ width: '100%' }}
                      onClick={conferma} disabled={invio || prev.box_liberi === 0}>
                {invio ? 'Confermo…' : 'Conferma la prenotazione'}
              </button>
              <p className="nota" style={{ textAlign: 'center', marginTop: 10 }}>
                Disdetta gratuita fino a 72 ore prima
              </p>
            </>
          )}

          {errore && <div className="avviso avviso-no">{errore}</div>}
          {fatta && (
            <div className="avviso avviso-ok">
              {fatta} La trovi nella tua <a href="/app">area soci</a>.
            </div>
          )}
        </aside>
      </div>

      <p className="nota" style={{ marginTop: 26, maxWidth: '62ch' }}>
        Con un abbonamento attivo il preventivo usa in automatico le notti che hai in
        tessera e ti mostra solo la differenza da pagare.
      </p>

      <style>{`
        @media (max-width: 820px) {
          .prenota-griglia { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
