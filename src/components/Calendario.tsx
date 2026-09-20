'use client';

import { useEffect, useMemo, useState } from 'react';

export interface Giorno {
  data: string;
  tipo: 'bassa' | 'media' | 'alta';
  prezzo: number;
  crediti: number;
  liberi: number;
}

interface Props {
  checkIn: string | null;
  checkOut: string | null;
  onCambia: (checkIn: string | null, checkOut: string | null) => void;
}

const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
              'luglio','agosto','settembre','ottobre','novembre','dicembre'];

function chiaveMese(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calendario con la stagionalita' a colori.
 * I dati arrivano da /api/stagioni, che a sua volta usa la stessa funzione
 * SQL del preventivo: il colore che vedi e il prezzo che paghi non possono
 * divergere, perche' vengono dalla stessa riga di database.
 */
export default function Calendario({ checkIn, checkOut, onCambia }: Props) {
  const oggi = useMemo(() => new Date(new Date().toDateString()), []);
  const [mese, setMese] = useState(() => new Date(oggi.getFullYear(), oggi.getMonth(), 1));
  const [giorni, setGiorni] = useState<Record<string, Giorno>>({});
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    setCaricando(true);
    setErrore(null);
    fetch(`/api/stagioni?mese=${chiaveMese(mese)}`)
      .then((r) => r.json())
      .then((j) => {
        if (annullato) return;
        if (j.errore) { setErrore('Non riesco a caricare le disponibilità.'); return; }
        const mappa: Record<string, Giorno> = {};
        for (const g of j.giorni as Giorno[]) mappa[g.data] = g;
        setGiorni((p) => ({ ...p, ...mappa }));
      })
      .catch(() => { if (!annullato) setErrore('Non riesco a caricare le disponibilità.'); })
      .finally(() => { if (!annullato) setCaricando(false); });
    return () => { annullato = true; };
  }, [mese]);

  const primo = new Date(mese.getFullYear(), mese.getMonth(), 1);
  const ultimo = new Date(mese.getFullYear(), mese.getMonth() + 1, 0);
  const scarto = (primo.getDay() + 6) % 7; // settimana che inizia di lunedì

  function scegli(iso: string) {
    if (!checkIn || (checkIn && checkOut)) { onCambia(iso, null); return; }
    if (iso <= checkIn) { onCambia(iso, null); return; }
    onCambia(checkIn, iso);
  }

  const celle: JSX.Element[] = [];
  for (let i = 0; i < scarto; i++) {
    celle.push(<div className="giorno vuoto" key={`v${i}`} aria-hidden="true" />);
  }
  for (let n = 1; n <= ultimo.getDate(); n++) {
    const d = new Date(mese.getFullYear(), mese.getMonth(), n);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
    const g = giorni[iso];
    const passato = d < oggi;
    const pieno = g ? g.liberi <= 0 : false;
    const spento = passato || pieno;
    const scelto = iso === checkIn || iso === checkOut;
    const dentro = !!(checkIn && checkOut && iso > checkIn && iso < checkOut);

    celle.push(
      <button
        type="button"
        key={iso}
        className={[
          'giorno',
          g?.tipo === 'media' ? 'media' : '',
          g?.tipo === 'alta' ? 'alta' : '',
          spento ? 'spento' : '',
          scelto ? 'scelto' : '',
          dentro ? 'dentro' : '',
        ].filter(Boolean).join(' ')}
        disabled={spento}
        aria-pressed={scelto}
        aria-label={`${n} ${MESI[mese.getMonth()]}${g ? `, ${g.prezzo} euro` : ''}${pieno ? ', nessun box libero' : ''}`}
        onClick={() => scegli(iso)}
      >
        {n}
        {g && !passato && <em>{g.prezzo} €</em>}
      </button>
    );
  }

  const indietroPossibile =
    mese.getFullYear() > oggi.getFullYear() ||
    (mese.getFullYear() === oggi.getFullYear() && mese.getMonth() > oggi.getMonth());

  return (
    <div className="calendario">
      <div className="cal-testa">
        <button className="cal-nav" onClick={() => setMese(new Date(mese.getFullYear(), mese.getMonth() - 1, 1))}
                disabled={!indietroPossibile} aria-label="Mese precedente">‹</button>
        <strong>{MESI[mese.getMonth()]} {mese.getFullYear()}</strong>
        <button className="cal-nav" onClick={() => setMese(new Date(mese.getFullYear(), mese.getMonth() + 1, 1))}
                aria-label="Mese successivo">›</button>
      </div>

      <div className="griglia7">
        {['L','M','M','G','V','S','D'].map((d, i) => (
          <div className="dow" key={i}>{d}</div>
        ))}
        {celle}
      </div>

      <div className="legenda">
        <span><i className="pastiglia" style={{ background: 'color-mix(in srgb, var(--bosco) 13%, transparent)' }} /> Bassa stagione</span>
        <span><i className="pastiglia" style={{ background: 'color-mix(in srgb, var(--miele) 42%, transparent)' }} /> Weekend e ponti</span>
        <span><i className="pastiglia" style={{ background: 'color-mix(in srgb, var(--ruggine) 22%, transparent)' }} /> Alta stagione</span>
      </div>

      {caricando && <p className="nota" style={{ marginTop: 10 }}>Carico le disponibilità…</p>}
      {errore && <p className="avviso avviso-no">{errore}</p>}
      {!checkIn && !caricando && !errore && (
        <p className="nota" style={{ marginTop: 10 }}>Tocca il giorno di arrivo, poi quello di partenza.</p>
      )}
    </div>
  );
}
