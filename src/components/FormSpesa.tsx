'use client';

import { useState } from 'react';

export default function FormSpesa() {
  const oggi = new Date();
  const [mese, setMese] = useState(
    `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
  );
  const [importo, setImporto] = useState('');
  const [canale, setCanale] = useState('meta');
  const [esito, setEsito] = useState<'nulla' | 'ok' | 'no'>('nulla');
  const [invio, setInvio] = useState(false);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setInvio(true);
    setEsito('nulla');
    try {
      const r = await fetch('/api/spesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mese, importo: Number(importo), canale }),
      });
      const j = await r.json();
      setEsito(j.ok ? 'ok' : 'no');
      if (j.ok) setTimeout(() => location.reload(), 700);
    } catch {
      setEsito('no');
    } finally {
      setInvio(false);
    }
  }

  return (
    <form className="modulo" onSubmit={salva} style={{ marginTop: 18, maxWidth: 620 }}>
      <div className="campo">
        <label htmlFor="mese">Mese</label>
        <input id="mese" type="month" value={mese} onChange={(e) => setMese(e.target.value)} required />
      </div>
      <div className="campo">
        <label htmlFor="imp">Quanto è stato speso</label>
        <input id="imp" type="number" min={0} step="0.01" value={importo}
               onChange={(e) => setImporto(e.target.value)} placeholder="240" required />
      </div>
      <div className="campo">
        <label htmlFor="can">Canale</label>
        <select id="can" value={canale} onChange={(e) => setCanale(e.target.value)}>
          <option value="meta">Meta</option>
          <option value="google">Google</option>
          <option value="altro">Altro</option>
        </select>
      </div>
      <button className="btn" type="submit" disabled={invio} style={{ alignSelf: 'end' }}>
        {invio ? 'Salvo…' : 'Salva la spesa'}
      </button>
      {esito === 'ok' && <div className="avviso avviso-ok" style={{ gridColumn: '1/-1' }}>Spesa registrata.</div>}
      {esito === 'no' && <div className="avviso avviso-no" style={{ gridColumn: '1/-1' }}>Non sono riuscito a salvare. Controlla i valori e riprova.</div>}
    </form>
  );
}
