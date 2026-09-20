'use client';

import { useEffect, useState } from 'react';
import { traccia } from '@/lib/traccia';

interface Gatto {
  id?: number;
  nome: string;
  anno_nascita: string;
  peso_kg: string;
  carattere: string;
  convive_con_altri: string;
  sterilizzato: string;
  microchip: string;
  note_alimentari: string;
  note_mediche: string;
  vaccinazione_scadenza: string;
  antiparassitario_il: string;
  veterinario: string;
}

const VUOTO: Gatto = {
  nome: '', anno_nascita: '', peso_kg: '', carattere: '', convive_con_altri: '',
  sterilizzato: '', microchip: '', note_alimentari: '', note_mediche: '',
  vaccinazione_scadenza: '', antiparassitario_il: '', veterinario: '',
};

/** La scheda si compila una volta sola: al ritorno la pagina si apre
 *  già piena e si modifica solo quello che è cambiato. */
export default function SchedaGatto() {
  const [g, setG] = useState<Gatto>(VUOTO);
  const [caricando, setCaricando] = useState(true);
  const [salvato, setSalvato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    fetch('/api/gatti')
      .then((r) => { if (r.status === 401) { window.location.href = '/login?torna=/gatto'; throw new Error('login'); } return r.json(); })
      .then((j) => {
        const primo = j.gatti?.[0];
        if (primo) {
          setG({
            id: primo.id,
            nome: primo.nome ?? '',
            anno_nascita: primo.anno_nascita?.toString() ?? '',
            peso_kg: primo.peso_kg?.toString() ?? '',
            carattere: primo.carattere ?? '',
            convive_con_altri: primo.convive_con_altri === null || primo.convive_con_altri === undefined ? '' : String(primo.convive_con_altri),
            sterilizzato: primo.sterilizzato === null || primo.sterilizzato === undefined ? '' : String(primo.sterilizzato),
            microchip: primo.microchip ?? '',
            note_alimentari: primo.note_alimentari ?? '',
            note_mediche: primo.note_mediche ?? '',
            vaccinazione_scadenza: primo.vaccinazione_scadenza ?? '',
            antiparassitario_il: primo.antiparassitario_il ?? '',
            veterinario: primo.veterinario ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setCaricando(false));
  }, []);

  function campo(k: keyof Gatto) {
    return {
      value: g[k] as string,
      onChange: (e: any) => { setG({ ...g, [k]: e.target.value }); setSalvato(false); },
    };
  }

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    if (!g.nome.trim()) { setErrore('Il nome del gatto serve, il resto può aspettare.'); return; }
    setInvio(true);
    try {
      const r = await fetch('/api/gatti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...g,
          convive_con_altri: g.convive_con_altri === '' ? null : g.convive_con_altri === 'true',
          sterilizzato: g.sterilizzato === '' ? null : g.sterilizzato === 'true',
        }),
      });
      const j = await r.json();
      if (j.errore) { setErrore(j.errore); return; }
      setG((p) => ({ ...p, id: j.gatto.id }));
      setSalvato(true);
      traccia('scheda_gatto', { nuovo: !g.id });
    } catch {
      setErrore('Il salvataggio non è andato a buon fine. Riprova.');
    } finally {
      setInvio(false);
    }
  }

  if (caricando) {
    return <main className="wrap" style={{ paddingTop: 44 }}><p className="guida">Apro la scheda…</p></main>;
  }

  return (
    <main className="wrap" style={{ paddingTop: 44, paddingBottom: 70 }}>
      <h1 style={{ fontSize: 'clamp(2rem,4.6vw,3rem)' }}>La scheda di {g.nome || 'il tuo gatto'}</h1>
      <p className="guida stretta" style={{ marginTop: 14 }}>
        {g.id
          ? 'È già salvata: cambia solo quello che è cambiato. Alla prossima prenotazione non ti chiediamo niente.'
          : 'Si compila una volta sola. Alla seconda prenotazione non ti chiediamo più niente, e chi lo accudisce sa già tutto prima che arrivi.'}
      </p>

      <form className="modulo" onSubmit={salva} style={{ marginTop: 28 }}>
        <div className="campo">
          <label htmlFor="nome">Come si chiama</label>
          <input id="nome" required {...campo('nome')} placeholder="Luna" />
        </div>
        <div className="campo">
          <label htmlFor="anno">Anno di nascita</label>
          <input id="anno" type="number" min={1995} max={2030} {...campo('anno_nascita')} placeholder="2020" />
        </div>
        <div className="campo">
          <label htmlFor="peso">Peso indicativo (kg)</label>
          <input id="peso" type="number" step="0.1" min={0.5} max={15} {...campo('peso_kg')} placeholder="4,2" />
        </div>
        <div className="campo">
          <label htmlFor="car">Com’è di carattere</label>
          <select id="car" {...campo('carattere')}>
            <option value="">Scegli</option>
            <option value="socievole">Socievole, sta volentieri con altri</option>
            <option value="diffidente">Diffidente, gli serve tempo</option>
            <option value="solitario">Solitario, meglio da solo</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="conv">Convive già con altri gatti</label>
          <select id="conv" {...campo('convive_con_altri')}>
            <option value="">Non specificato</option>
            <option value="true">Sì</option>
            <option value="false">No</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ster">Sterilizzato</label>
          <select id="ster" {...campo('sterilizzato')}>
            <option value="">Non specificato</option>
            <option value="true">Sì</option>
            <option value="false">No</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="vacc">Scadenza della vaccinazione</label>
          <input id="vacc" type="date" {...campo('vaccinazione_scadenza')} />
        </div>
        <div className="campo">
          <label htmlFor="anti">Ultimo antiparassitario</label>
          <input id="anti" type="date" {...campo('antiparassitario_il')} />
        </div>
        <div className="campo">
          <label htmlFor="chip">Microchip</label>
          <input id="chip" {...campo('microchip')} placeholder="Le 15 cifre, se le hai sottomano" />
        </div>
        <div className="campo">
          <label htmlFor="vet">Veterinario di fiducia</label>
          <input id="vet" {...campo('veterinario')} placeholder="Nome e telefono" />
        </div>
        <div className="campo pieno">
          <label htmlFor="cibo">Cosa mangia e come</label>
          <textarea id="cibo" {...campo('note_alimentari')}
            placeholder="Marca, quantità, quante volte al giorno, cose che proprio non tollera" />
        </div>
        <div className="campo pieno">
          <label htmlFor="med">Terapie, allergie, cose da sapere</label>
          <textarea id="med" {...campo('note_mediche')}
            placeholder="Farmaci e orari, problemi noti, comportamenti che ti preoccupano" />
        </div>

        {errore && <div className="avviso avviso-no" style={{ gridColumn: '1/-1' }}>{errore}</div>}
        {salvato && <div className="avviso avviso-ok" style={{ gridColumn: '1/-1' }}>
          Scheda salvata. Da adesso la ritrovi già compilata.
        </div>}

        <button className="btn btn-grande" type="submit" disabled={invio} style={{ gridColumn: '1/-1' }}>
          {invio ? 'Salvo…' : g.id ? 'Aggiorna la scheda' : 'Salva la scheda'}
        </button>
      </form>
    </main>
  );
}
