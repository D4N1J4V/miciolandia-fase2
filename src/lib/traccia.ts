'use client';

/**
 * Tracciamento dell'imbuto. Due destinazioni in parallelo:
 *  - il database, che e' la fonte delle metriche che presentiamo
 *  - i pixel pubblicitari, se presenti nella pagina
 * Nessun cookie: l'id di sessione e' casuale e vive nel sessionStorage.
 */

function sessione(): string {
  try {
    let s = sessionStorage.getItem('mcl:sessione');
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('mcl:sessione', s);
    }
    return s;
  } catch { return 'anonima'; }
}

function utm() {
  try {
    const p = new URLSearchParams(location.search);
    const salva = (k: string) => {
      const v = p.get(k);
      if (v) sessionStorage.setItem('mcl:' + k, v);
      return v ?? sessionStorage.getItem('mcl:' + k);
    };
    return {
      utm_source: salva('utm_source'),
      utm_medium: salva('utm_medium'),
      utm_campaign: salva('utm_campaign'),
    };
  } catch { return {}; }
}

export function traccia(nome: string, dati: Record<string, any> = {}) {
  const corpo = {
    nome,
    sessione: sessione(),
    pagina: typeof location !== 'undefined' ? location.pathname : null,
    ...utm(),
    percorso: dati.percorso ?? null,
    piano: dati.piano ?? null,
    dati,
  };

  try {
    navigator.sendBeacon?.(
      '/api/evento',
      new Blob([JSON.stringify(corpo)], { type: 'application/json' })
    ) || fetch('/api/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      keepalive: true,
    }).catch(() => {});
  } catch { /* il tracciamento non deve mai rompere la pagina */ }

  try {
    const w = window as any;
    if (typeof w.gtag === 'function') w.gtag('event', nome, dati);
    if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: nome, ...dati });
    if (typeof w.fbq === 'function') w.fbq('trackCustom', nome, dati);
  } catch { /* idem */ }
}

export function datiArrivo() {
  return { ...utm(), arrivo: typeof document !== 'undefined' ? (document.referrer || 'diretto') : null,
           sessione: sessione() };
}
