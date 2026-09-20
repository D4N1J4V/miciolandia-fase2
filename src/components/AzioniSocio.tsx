'use client';

import { useState } from 'react';

/** Disdetta di un soggiorno: la regola delle 72 ore sta nella funzione SQL. */
export function AnnullaSoggiorno({ id, entro72ore }: { id: number; entro72ore: boolean }) {
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function annulla() {
    const avviso = entro72ore
      ? 'Mancano meno di 72 ore: ti torna solo metà dei crediti usati. Vuoi annullare comunque?'
      : 'Vuoi annullare questo soggiorno? I crediti usati tornano tutti in tessera.';
    if (!confirm(avviso)) return;
    setInvio(true);
    setErrore(null);
    try {
      const r = await fetch(`/api/prenotazioni?id=${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (j.errore) { setErrore(j.errore); return; }
      window.location.reload();
    } catch {
      setErrore('Non sono riuscito ad annullare. Riprova.');
    } finally {
      setInvio(false);
    }
  }

  return (
    <>
      <button className="btn btn-vuoto btn-piccolo" onClick={annulla} disabled={invio}>
        {invio ? 'Annullo…' : 'Annulla'}
      </button>
      {errore && <div className="errore">{errore}</div>}
    </>
  );
}

export function DisdiciAbbonamento() {
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function disdici() {
    if (!confirm('Vuoi disdire l’abbonamento? I crediti che hai in tessera restano validi per 60 giorni.')) return;
    setInvio(true);
    setErrore(null);
    try {
      const r = await fetch('/api/abbonamento/disdetta', { method: 'POST' });
      const j = await r.json();
      if (j.errore) { setErrore(j.errore); return; }
      window.location.href = '/app?disdetta=ok';
    } catch {
      setErrore('Non sono riuscito a completare la disdetta. Riprova.');
    } finally {
      setInvio(false);
    }
  }

  return (
    <div>
      <button className="btn btn-vuoto" onClick={disdici} disabled={invio}>
        {invio ? 'Disdico…' : 'Disdici l’abbonamento'}
      </button>
      {errore && <div className="avviso avviso-no">{errore}</div>}
    </div>
  );
}
