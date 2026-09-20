-- =====================================================================
-- Miciolandia - schema
-- Eseguire nel SQL Editor di Supabase, in ordine (01 -> 05).
-- =====================================================================

-- ---------------------------------------------------------------------
-- TARIFFE E STAGIONALITA'
-- Le regole di prezzo stanno QUI, non nel codice applicativo.
-- Cambiare le date dell'alta stagione = modificare una riga.
-- ---------------------------------------------------------------------

create table if not exists tariffe (
  tipo            text primary key check (tipo in ('bassa','media','alta')),
  etichetta       text not null,
  prezzo_notte    numeric(6,2) not null,
  moltiplicatore  numeric(4,2) not null   -- quanti crediti costa una notte
);

create table if not exists periodi (
  id            bigserial primary key,
  nome          text not null,
  tipo          text not null references tariffe(tipo),
  data_inizio   date not null,
  data_fine     date not null,
  check (data_fine >= data_inizio)
);
create index if not exists periodi_range_idx on periodi (data_inizio, data_fine);

-- Singole giornate fuori dai range (ponti, vigilie)
create table if not exists giorni_speciali (
  data  date primary key,
  tipo  text not null references tariffe(tipo),
  nome  text
);

-- ---------------------------------------------------------------------
-- PIANI DI ABBONAMENTO
-- ---------------------------------------------------------------------

create table if not exists piani (
  codice                 text primary key check (codice in ('base','plus','premium')),
  nome                   text not null,
  quota_mensile          numeric(6,2) not null,
  crediti_mensili        numeric(4,2) not null,
  sconto_extra           numeric(4,3) not null,  -- sconto socio su bassa e media
  tetto_alta_annuo       int not null,           -- notti di alta pagabili con crediti
  mesi_sblocco_alta      int not null default 12,
  validita_crediti_mesi  int not null default 12,
  vincolo_minimo_mesi    int not null default 3,
  stripe_price_id        text
);

-- ---------------------------------------------------------------------
-- CLIENTI, GATTI, ABBONAMENTI
-- ---------------------------------------------------------------------

create table if not exists clienti (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nome                text not null,
  email               text not null,
  telefono            text,
  stripe_customer_id  text unique,
  creato_il           timestamptz not null default now()
);

create table if not exists gatti (
  id                     bigserial primary key,
  cliente_id             uuid not null references clienti(id) on delete cascade,
  nome                   text not null,
  anno_nascita           int,
  peso_kg                numeric(4,2),
  carattere              text check (carattere in ('socievole','diffidente','solitario')),
  note_alimentari        text,
  note_mediche           text,
  vaccinazione_scadenza  date,
  creato_il              timestamptz not null default now()
);
create index if not exists gatti_cliente_idx on gatti(cliente_id);

create table if not exists abbonamenti (
  id                      bigserial primary key,
  cliente_id              uuid not null references clienti(id) on delete cascade,
  piano_codice            text not null references piani(codice),
  stato                   text not null default 'attivo'
                          check (stato in ('attivo','disdetto','sospeso')),
  data_inizio             date not null default current_date,
  data_disdetta           date,
  stripe_subscription_id  text unique,
  creato_il               timestamptz not null default now()
);
create index if not exists abbonamenti_cliente_idx on abbonamenti(cliente_id, stato);

-- ---------------------------------------------------------------------
-- BOX E PRENOTAZIONI
-- ---------------------------------------------------------------------

create table if not exists box (
  id        bigserial primary key,
  nome      text not null,
  capienza  int not null default 1,   -- gatti della stessa famiglia
  attivo    boolean not null default true
);

create table if not exists prenotazioni (
  id                    bigserial primary key,
  cliente_id            uuid not null references clienti(id) on delete cascade,
  gatto_id              bigint references gatti(id) on delete set null,
  box_id                bigint references box(id),
  n_gatti               int not null default 1,
  check_in              date not null,
  check_out             date not null,
  stato                 text not null default 'confermata'
                        check (stato in ('confermata','annullata','completata')),
  totale_listino        numeric(8,2) not null,
  crediti_usati         numeric(6,2) not null default 0,
  contante_dovuto       numeric(8,2) not null default 0,
  notti_totali          int not null,
  notti_alta            int not null default 0,
  notti_alta_a_credito  int not null default 0,
  creata_il             timestamptz not null default now(),
  check (check_out > check_in)
);
create index if not exists prenotazioni_date_idx on prenotazioni(check_in, check_out);
create index if not exists prenotazioni_cliente_idx on prenotazioni(cliente_id);

-- ---------------------------------------------------------------------
-- IL REGISTRO DEI CREDITI
-- Nessuna colonna "saldo" da nessuna parte: il saldo e' la somma delle
-- righe. Ogni movimento e' immutabile e tracciabile.
-- ---------------------------------------------------------------------

create table if not exists movimenti_credito (
  id              bigserial primary key,
  cliente_id      uuid not null references clienti(id) on delete cascade,
  tipo            text not null check (tipo in ('accredito','consumo','scadenza','rimborso','rettifica')),
  crediti         numeric(6,2) not null,   -- positivo = entrata, negativo = uscita
  data_movimento  timestamptz not null default now(),
  data_scadenza   date,                    -- valorizzata solo sugli accrediti
  prenotazione_id bigint references prenotazioni(id) on delete set null,
  riferimento     text,                    -- es. id fattura Stripe (idempotenza)
  note            text
);
create index if not exists movimenti_cliente_idx on movimenti_credito(cliente_id, data_movimento);
create unique index if not exists movimenti_riferimento_idx
  on movimenti_credito(riferimento) where riferimento is not null;

-- Il saldo e' una vista, non un dato.
create or replace view saldo_crediti as
select
  c.id                                                            as cliente_id,
  coalesce(sum(m.crediti), 0)                                     as saldo,
  coalesce(sum(m.crediti) filter (where m.tipo = 'accredito'), 0) as totale_accreditato,
  coalesce(-sum(m.crediti) filter (where m.tipo = 'consumo'), 0)  as totale_consumato,
  coalesce(-sum(m.crediti) filter (where m.tipo = 'scadenza'), 0) as totale_scaduto
from clienti c
left join movimenti_credito m on m.cliente_id = c.id
group by c.id;

-- Diario del soggiorno
create table if not exists diario (
  id              bigserial primary key,
  prenotazione_id bigint not null references prenotazioni(id) on delete cascade,
  momento         timestamptz not null default now(),
  testo           text not null,
  peso_kg         numeric(4,2),
  foto_url        text
);
create index if not exists diario_prenotazione_idx on diario(prenotazione_id, momento);
