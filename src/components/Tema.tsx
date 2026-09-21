'use client';

import { useEffect, useState } from 'react';

type Tema = 'chiaro' | 'scuro';

function temaDiSistema(): Tema {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'scuro' : 'chiaro';
}

/** Interruttore giorno/notte. La scelta resta nel browser di chi naviga;
 *  senza scelta il sito segue l'impostazione del sistema. */
export default function Tema() {
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    let salvato: string | null = null;
    try { salvato = localStorage.getItem('mcl:tema'); } catch { /* modalità privata */ }
    setTema(salvato === 'chiaro' || salvato === 'scuro' ? salvato : temaDiSistema());
  }, []);

  function cambia() {
    const nuovo: Tema = tema === 'scuro' ? 'chiaro' : 'scuro';
    setTema(nuovo);
    document.documentElement.setAttribute('data-theme', nuovo === 'scuro' ? 'dark' : 'light');
    try { localStorage.setItem('mcl:tema', nuovo); } catch { /* modalità privata */ }
  }

  // Prima di sapere quale tema è attivo il pulsante resta vuoto, così non
  // lampeggia con l'icona sbagliata al primo caricamento.
  const scuro = tema === 'scuro';

  return (
    <button type="button" className="tema" onClick={cambia}
            aria-label={scuro ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
            title={scuro ? 'Tema chiaro' : 'Tema scuro'}>
      {tema && (scuro ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
        </svg>
      ))}
    </button>
  );
}
