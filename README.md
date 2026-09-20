# Miciolandia — Fase 4 (ipotesi)

Come sarebbe il prodotto il giorno in cui la struttura apre: calendario,
soggiorni, abbonamenti e area soci. È un prototipo funzionante, non una fase
pianificata con tempi e costi: serve a far vedere dove porta il modello
validato nelle prime tre fasi.

Progetto Next.js + Supabase + Stripe, deploy su Vercel.

**Demo online:** _incollare qui il link del deploy_

---

## Il percorso fino a qui

La roadmap è quella presentata: ogni fase testa un'ipotesi diversa ed esiste
solo se la precedente ha superato la sua soglia. Le prime tre sono nelle
slide, con tempi e costi. La quarta non è pianificata: è sviluppata qui come
ipotesi navigabile, e in presentazione è una slide con il link a questa demo.

| Fase | Cosa è attivo | Ipotesi da verificare | Periodo | Costo |
|---|---|---|---|---|
| 1 | Landing con due percorsi e raccolta contatti | Se la domanda esiste, e se tira più l'abbonamento o la singola notte | online ora | 0 – 20 € e 2 giorni di lavoro |
| 2 | Sito completo, campagna e **solo cura a domicilio** | Se qualcuno paga davvero, prima di costruire qualsiasi cosa | ~3 mesi | 1.162 – 2.935 € |
| 3 | Area cliente e **abbonamenti**, sempre solo a domicilio | Se il modello a notti-credito regge quando i soldi entrano ogni mese | 6 – 12 mesi | 2.840 – 3.720 € |
| **4** | **Struttura aperta: calendario, soggiorni, area soci** | **Se i soci convertono i crediti in notti e la struttura si riempie** | ipotesi, non pianificata | non stimato |

**Perché il domicilio per primo (fase 2).** Si parte subito, senza locale e
senza autorizzazione sanitaria. Misura il portafoglio, non il click. E
costruisce la fiducia prima: ogni cliente servito a domicilio è un cliente
che alla struttura arriva già conoscendoci.

**Perché l'abbonamento prima dei muri (fase 3).** Si testa l'abbonamento,
non il locale: retention, utilizzo reale e margine si misurano con 120 € di
costi fissi al mese invece di 1.390 €. I crediti si spendono in visite a
domicilio e valgono per le notti quando apre la struttura, quindi chi si
abbona in fase 3 arriva all'apertura con la tessera già piena.

**Cosa eredita la fase 4.** Quei crediti accumulati diventano notti di
soggiorno. È la ragione per cui il saldo è un registro di movimenti e non un
numero: i crediti attraversano le fasi, e ogni riga dice da dove vengono,
quando sono stati accreditati e quando scadono. Un socio della fase 3 apre
`/app` il giorno dell'apertura e trova la tessera piena, con lo storico delle
visite a domicilio che l'hanno riempita.

**Quanto vale una visita a domicilio: 0,9 notti-credito.** Il credito vale
sempre 20 € di listino, in ogni stagione — 20 € per una notte bassa, 30 € per
1,5 crediti nel weekend, 40 € per 2 crediti in alta — quindi una visita da
18 € vale 18 ÷ 20 = 0,9. Arrotondare a 1 renderebbe la visita più cara pagata
con la tessera che in contanti: il socio pagherebbe le visite e accumulerebbe
i crediti per le notti, falsando proprio l'utilizzo reale che la fase 3 deve
misurare, e lasciando alla fase 4 un debito di notti più grande del previsto.
A 0,9 il socio è indifferente e il dato è pulito.

La stagionalità non entra: la visita costa 18 € tutto l'anno. Per lo stesso
motivo il blocco dei crediti in alta stagione fino al tredicesimo mese e il
tetto annuo di notti di alta riguardano solo i soggiorni, non le visite.

## Le tre schermate da mostrare

1. **`/`** — home con i servizi: zona comune, cuccia riservata, domicilio,
   trasporto, abbonamento, scheda del gatto.
2. **`/prenota`** — calendario con la stagionalità a colori, prezzo su ogni
   giorno, giorni esauriti spenti, totale che si aggiorna mentre scegli. Se
   sei socio mostra quante notti-credito usi e quanto resta da pagare.
3. **`/app`** — l'area soci: saldo della tessera, registro dei movimenti,
   soggiorni, disdetta.

## Le idee che tengono in piedi il progetto

**Il saldo non esiste, esiste il registro.** Nessuna colonna
`crediti_residui`: ogni accredito, consumo, scadenza e rimborso è una riga
immutabile in `movimenti_credito`, e il saldo è la vista che le somma. È
quello che rende possibile portare i crediti da una fase all'altra senza
perdere di vista da dove arrivano.

**Le regole di prezzo stanno nel database.** `calcola_preventivo` è l'unica
fonte di verità: la chiamano il calendario, la prenotazione e il pannello.
Il colore che vedi sul calendario e il prezzo che paghi vengono dalla stessa
riga, quindi non possono divergere.

**I crediti nascono dal pagamento.** L'accredito mensile parte dal webhook
`invoice.paid` di Stripe, con l'id fattura come chiave di idempotenza. Al
ritorno dal Checkout l'area soci fa la stessa verifica, quindi i crediti
arrivano subito anche senza webhook, e senza raddoppiarsi.

**Le metriche hanno un denominatore vero.** La spesa pubblicitaria si
registra a mano una volta al mese in `spesa_ads`; contatti, iscritti e
prenotazioni arrivano dalle tabelle reali. Se la spesa non è registrata le
colonne restano vuote: meglio una cella vuota di un numero inventato.

## Struttura

I file SQL tengono la numerazione con cui sono stati eseguiti: `07_fase2.sql`
si chiama così perché è stato scritto quando questa era la fase 2, e gli
script già eseguiti non si riscrivono.

```
supabase/
  01_schema.sql      tariffe, periodi, piani, clienti, gatti, box, prenotazioni, registro crediti
  02_prezzi.sql      tipo_notte, righe_soggiorno, calcola_preventivo, box_liberi
  03_crediti.sql     accredito, scadenza FIFO, crea_prenotazione, annulla_prenotazione
  04_rls.sql         row level security
  05_seed.sql        listino, stagioni, tre piani, 16 spazi
  06_test_modello.sql  gli scenari che verificano che l'abbonamento non sia aggirabile
  07_fase2.sql       lead, eventi, spesa_ads, metriche_mensili, imbuto_30gg
  08_utenti.sql      crea il cliente al primo accesso
  09_ruoli.sql       colonna ruolo su clienti: cliente o staff
  10_lead_indice.sql indice unico (email, percorso) per l'upsert dei contatti
  11_capienza.sql    assegnazione del box in base al numero di gatti
  12_servizi.sql     richieste di cura a domicilio e trasporto

src/app/
  page.tsx           home con i servizi
  prezzi/            listino completo e tre abbonamenti, con il pulsante di iscrizione
  prenota/           calendario stagionale e preventivo dal vivo
  servizi/           cura a domicilio e trasporto, con il modulo di richiesta
  gatto/             scheda del gatto
  faq/               domande frequenti
  metriche/          costo per iscritto e per prenotazione (staff)
  simulatore/        scenari del modello di abbonamento
  app/               area soci: saldo, registro, soggiorni, disdetta
  login/             accesso con link via email o password
  auth/              ritorno dal link di accesso e uscita
  gestore/           occupazione, arrivi e utilizzo dei crediti (staff)

src/app/api/
  preventivo/        chiama calcola_preventivo
  prenotazioni/      crea e annulla, in transazione
  stagioni/          mappa del mese per il calendario
  gatti/             lettura e salvataggio della scheda
  servizi/           richieste di domicilio e trasporto
  lead/              contatti dalla landing
  evento/            passaggi dell'imbuto
  spesa/             registrazione della spesa pubblicitaria (staff)
  abbonamento/       disdetta, nel rispetto del vincolo minimo
  stripe/            checkout e webhook
  cron/              scadenze crediti e rete di sicurezza accrediti
```

## Installazione

Serve Node 18 o superiore.

```bash
npm install
cp .env.example .env.local     # poi compila i valori
npm run dev
```

### Supabase

1. Nuovo progetto su supabase.com (piano gratuito).
2. SQL Editor → esegui **in ordine**: `01`, `02`, `03`, `04`, `05`, `07`, `08`, `09`, `10`, `11`, `12`.
3. Project Settings → API: copia URL, `anon key` e `service_role key`.
4. Authentication → Providers: lascia attivo Email. Si entra con link via email
   oppure con password; il ritorno dal link passa da `/auth/callback`.
5. Authentication → URL Configuration: Site URL uguale all'indirizzo del sito,
   e tra i Redirect URLs `http://localhost:3000/**` più quello di produzione.
6. Per vedere `/gestore` e `/metriche` serve un account staff:
   `update clienti set ruolo = 'staff' where email = 'tua@email.it';`

Verifica il motore con `06_test_modello.sql`: sono gli scenari di abuso e di
uso corretto, con il risultato atteso scritto nei commenti.

### Stripe in modalità test

Senza chiavi Stripe il sito funziona in **modalità dimostrativa**: il pulsante
"Abbonati" attiva subito il piano con un pagamento simulato e accredita le
notti del primo mese. Per il pagamento vero in test:

1. Account Stripe (non serve partita IVA), modalità test.
2. Copia in `.env.local` la chiave segreta `sk_test_...` e quella pubblica `pk_test_...`.
3. Riavvia `npm run dev`.

I `price_id` sono facoltativi: se mancano, il prezzo si prende dalla tabella
`piani`. Anche il webhook è facoltativo in locale: al ritorno dal Checkout
`/app` verifica il pagamento e accredita i crediti con lo stesso riferimento
del webhook (id fattura), quindi non ci sono doppioni. Per provarlo comunque:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Carta di test: `4242 4242 4242 4242`, scadenza futura, CVC qualsiasi.

### Email di promemoria (facoltativo)

Con `RESEND_API_KEY` il cron `/api/cron/scadenze` invia i promemoria a 30 e a
7 giorni dalla scadenza di crediti e vaccinazioni. Senza chiave restituisce
l'elenco. Con il mittente di prova `onboarding@resend.dev` Resend consegna
solo all'indirizzo del proprio account.

### Deploy su Vercel

Push su GitHub, import del progetto, incolla le variabili d'ambiente
(`NEXT_PUBLIC_SITE_URL` uguale all'URL di produzione). I due cron in
`vercel.json` partono da soli; aggiungi `CRON_SECRET` per impedire che
vengano chiamati dall'esterno. In Stripe aggiungi l'endpoint webhook di
produzione, e in Supabase l'URL di produzione tra i Redirect URLs.

## La landing della fase 1

Resta in `public/landing-fase1.html` e continua a funzionare da sola. La
costante `ENDPOINT` in cima al suo script punta a `/api/lead`: i contatti
finiscono nella tabella `lead`, da cui `/metriche` calcola il costo per
contatto.

Gli eventi dell'imbuto passano invece da `/api/evento`, che accetta solo i
nomi previsti: nessun cookie, solo un id di sessione casuale.

## Le due metriche, in chiaro

```
costo per iscritto     = spesa del mese / abbonamenti attivati nel mese
costo per prenotazione = spesa del mese / prenotazioni non annullate del mese
```

La soglia di lettura è scritta nella pagina: se un iscritto costa più di sei
mesi di quota Plus (234 €), la campagna non rientra entro il primo semestre e
va rivista l'offerta o il pubblico.

## Cosa resta da completare

- **Diario fotografico**, con upload su Supabase Storage. Era già previsto
  nel budget della fase 3 ("area cliente, abbonamenti, diario") e nel codice
  esiste solo la tabella `diario`: nessuna pagina lo mostra ancora.
- **Consumo dei crediti per le visite a domicilio**, che è come funzionava la
  fase 3: la conversione è 0,9 notti-credito a visita, ma nel codice i crediti
  si consumano solo sui soggiorni.
- **Pannello gestore completo**: assegnazione manuale degli spazi, stato dei box.
- **App installabile dal browser** (PWA), senza passare dagli store.
- **Logistica del trasporto**: giri, orari, chi guida.
