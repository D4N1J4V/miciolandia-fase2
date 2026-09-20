'use client';

import { useState } from 'react';
import { traccia } from '@/lib/traccia';

/** Avvia il Checkout di Stripe per un piano. Se l'utente non e'
 *  autenticato lo manda al login e poi torna qui. */
export default function BottoneIscrizione({ piano, etichetta }: { piano: string; etichetta: string }) {
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function iscrivi() {
    setInvio(true);
    setErrore(null);
    traccia('scelta_piano', { piano });
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piano }),
      });
      if (r.status === 401) { window.location.href = '/login?torna=' + encodeURIComponent('/prezzi#piani'); return; }
      const j = await r.json();
      if (j.url) { window.location.href = j.url; return; }
      setErrore(j.errore ?? 'Non riesco ad aprire il pagamento. Riprova tra un momento.');
    } catch {
      setErrore('Non riesco ad aprire il pagamento. Controlla la connessione e riprova.');
    }
    setInvio(false);
  }

  return (
    <>
      <button className="btn" onClick={iscrivi} disabled={invio} style={{ marginTop: 16, width: '100%' }}>
        {invio ? 'Apro il pagamento…' : etichetta}
      </button>
      {errore && <div className="avviso avviso-no">{errore}</div>}
    </>
  );
}
