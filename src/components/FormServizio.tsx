'use client';

import { useState } from 'react';

interface Props { nome: string; email: string; telefono: string }

export default function FormServizio(iniziali: Props) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [servizio, setServizio] = useState<'domicilio' | 'trasporto'>('domicilio');
  const [f, setF] = useState({ ...iniziali, comune: '', dal: '', al: '', note: '' });
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);

  const campo = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }),
  });

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    setInvio(true);
    setErrore(null);
    try {
      let sessione: string | null = null;
      try { sessione = sessionStorage.getItem('mcl:sessione'); } catch {}
      const r = await fetch('/api/servizi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, servizio, sessione }),
      });
      const j = await r.json();
      if (j.errore) { setErrore(j.errore); return; }
      setFatto(servizio === 'domicilio'
        ? `Richiesta ricevuta: ${j.visite} ${j.visite === 1 ? 'visita' : 'visite'} a ${f.comune}. Ti ricontattiamo per confermare.`
        : `Richiesta di trasporto ricevuta per il ${new Date(f.dal).toLocaleDateString('it-IT')}. Ti ricontattiamo per fissare l’orario.`);
    } catch {
      setErrore('La richiesta non è partita. Controlla la connessione e riprova.');
    } finally {
      setInvio(false);
    }
  }

  if (fatto) return <div className="avviso avviso-ok" style={{ maxWidth: 720 }}>{fatto}</div>;

  return (
    <form className="modulo" onSubmit={invia} style={{ marginTop: 22 }}>
      <div className="campo pieno">
        <label>Cosa ti serve</label>
        <div className="schede" role="radiogroup">
          <button type="button" role="radio" aria-checked={servizio === 'domicilio'}
                  className={servizio === 'domicilio' ? 'scheda attiva' : 'scheda'}
                  onClick={() => setServizio('domicilio')}>Cura a domicilio</button>
          <button type="button" role="radio" aria-checked={servizio === 'trasporto'}
                  className={servizio === 'trasporto' ? 'scheda attiva' : 'scheda'}
                  onClick={() => setServizio('trasporto')}>Trasporto</button>
        </div>
      </div>

      <div className="campo">
        <label htmlFor="s-nome">Nome</label>
        <input id="s-nome" required {...campo('nome')} autoComplete="name" />
      </div>
      <div className="campo">
        <label htmlFor="s-tel">Telefono</label>
        <input id="s-tel" required type="tel" {...campo('telefono')} autoComplete="tel" />
      </div>
      <div className="campo">
        <label htmlFor="s-email">Email</label>
        <input id="s-email" required type="email" {...campo('email')} autoComplete="email" />
      </div>
      <div className="campo">
        <label htmlFor="s-comune">Comune</label>
        <input id="s-comune" required {...campo('comune')} placeholder="Bergamo, Seriate, Dalmine…" />
      </div>

      {servizio === 'domicilio' ? (
        <>
          <div className="campo">
            <label htmlFor="s-dal">Prima visita</label>
            <input id="s-dal" required type="date" min={oggi} {...campo('dal')} />
          </div>
          <div className="campo">
            <label htmlFor="s-al">Ultima visita</label>
            <input id="s-al" required type="date" min={f.dal || oggi} {...campo('al')} />
          </div>
        </>
      ) : (
        <div className="campo">
          <label htmlFor="s-dal">Giorno del trasporto</label>
          <input id="s-dal" required type="date" min={oggi} {...campo('dal')} />
        </div>
      )}

      <div className="campo pieno">
        <label htmlFor="s-note">
          {servizio === 'domicilio' ? 'Cosa c’è da fare' : 'Da dove a dove'}
        </label>
        <textarea id="s-note" {...campo('note')}
          placeholder={servizio === 'domicilio'
            ? 'Quanti gatti, pasti, farmaci, dove teniamo le chiavi'
            : 'Per esempio: da casa alla pensione, oppure dal veterinario e ritorno'} />
      </div>

      {errore && <div className="avviso avviso-no" style={{ gridColumn: '1/-1', marginTop: 0 }}>{errore}</div>}

      <button className="btn btn-grande" type="submit" disabled={invio} style={{ gridColumn: '1/-1' }}>
        {invio ? 'Invio…' : 'Manda la richiesta'}
      </button>
      <p className="nota" style={{ gridColumn: '1/-1', margin: 0 }}>
        Non paghi niente adesso: la richiesta diventa un servizio solo dopo che ti abbiamo ricontattato.
      </p>
    </form>
  );
}
