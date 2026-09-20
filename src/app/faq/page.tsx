export const metadata = { title: 'Domande frequenti — Miciolandia' };

const DOMANDE = [
  ['Posso vedere dove dorme il mio gatto prima di lasciarlo?',
   'Sì, ed è la cosa che consigliamo a tutti. Le visite si prenotano in due minuti e non c’è nessun impegno: molti passano, guardano e decidono settimane dopo.'],
  ['Il mio gatto non sopporta gli altri gatti.',
   'Allora sta nella sua cuccia riservata e non incontra nessuno. La zona comune è per chi la gradisce, e prima di inserire un gatto facciamo una prova di compatibilità: se non funziona, si torna nello spazio individuale.'],
  ['Non voglio spostarlo di casa.',
   'Veniamo noi. Una visita al giorno a casa tua: cibo, acqua, lettiera, farmaci se servono, e le stesse foto che riceveresti se fosse da noi. Costa 18 € a visita.'],
  ['Come funzionano le notti-credito?',
   'Ogni mese l’abbonamento ne accredita un certo numero sulla tessera. Una notte feriale ne consuma 1, una di weekend 1,5, una di alta stagione 2. Si accumulano senza tetto e valgono dodici mesi dall’accredito.'],
  ['Perché in alta stagione i crediti valgono solo dal secondo anno?',
   'Perché ad agosto gli spazi sono pochi e vogliamo che vadano a chi resta con noi tutto l’anno, non a chi si iscrive a giugno e disdice a settembre. Nel primo anno il posto ad agosto è comunque garantito, e lo prenoti tre mesi prima degli altri.'],
  ['L’abbonamento conviene davvero?',
   'Conviene se prenoti almeno dieci notti l’anno; sotto quella soglia costa più di quanto fa risparmiare. Il vincolo è di tre mesi, poi disdici quando vuoi e le notti già accumulate restano tue per sessanta giorni.'],
  ['Prende delle medicine, ve ne occupate voi?',
   'Le pastiglie e le somministrazioni orali sono incluse nel prezzo. Per terapie iniettive o situazioni delicate ne parliamo prima, e se non siamo la struttura giusta te lo diciamo.'],
  ['Cosa serve portare il primo giorno?',
   'Il libretto vaccinale in regola e un antiparassitario recente. Il resto — carattere, abitudini, cosa mangia — lo carichi una volta sola nella scheda del gatto e resta salvato.'],
  ['Posso disdire una prenotazione?',
   'Gratis fino a 72 ore prima, 48 per gli abbonati. Dopo, metà delle notti-credito torna sulla tessera.'],
  ['Quanto siete lontani?',
   'Siamo in provincia di Bergamo e copriamo un raggio di venti chilometri con trasporto e visite a domicilio.'],
];

export default function Faq() {
  return (
    <main className="wrap stretta" style={{ paddingTop: 44, paddingBottom: 70 }}>
      <h1 style={{ fontSize: 'clamp(2rem,4.6vw,3rem)' }}>Domande frequenti</h1>
      <p className="guida" style={{ marginTop: 14 }}>
        Se non trovi la tua, scrivici: rispondiamo entro 24 ore.
      </p>
      <div style={{ marginTop: 24 }}>
        {DOMANDE.map(([d, r]) => (
          <details key={d}>
            <summary>{d}</summary>
            <p>{r}</p>
          </details>
        ))}
      </div>
      <div className="riga" style={{ marginTop: 34 }}>
        <a className="btn" href="/prenota">Guarda le disponibilità</a>
        <a className="btn btn-vuoto" href="/prezzi">Vedi i prezzi</a>
      </div>
    </main>
  );
}
