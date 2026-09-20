-- =====================================================================
-- Miciolandia - FASE 2
-- Aggiunge al modello della fase 1: contatti raccolti dalla landing,
-- eventi dell'imbuto, spesa pubblicitaria e le due metriche nuove
-- (costo per iscritto, costo per prenotazione).
-- Eseguire dopo 01 -> 05.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CONTATTI DALLA LANDING
-- Restano separati da `clienti`: un contatto non e' ancora un cliente,
-- e la distinzione e' esattamente cio' che misura la conversione.
-- ---------------------------------------------------------------------
create table if not exists lead (
  id              bigserial primary key,
  percorso        text not null check (percorso in ('abbonamento','notte')),
  piano           text references piani(codice),
  notti_previste  text,
  nome            text not null,
  email           text not null,
  telefono        text,
  comune          text,
  gatti           text,
  quando          text,
  dove            text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  arrivo          text,
  stato           text not null default 'nuovo'
                  check (stato in ('nuovo','contattato','convertito','perso')),
  cliente_id      uuid references clienti(id) on delete set null,
  note_interne    text,
  creato_il       timestamptz not null default now()
);
create index if not exists lead_creato_idx on lead(creato_il desc);
create index if not exists lead_percorso_idx on lead(percorso, stato);
create unique index if not exists lead_email_percorso_idx on lead(lower(email), percorso);

-- ---------------------------------------------------------------------
-- EVENTI DELL'IMBUTO
-- Una riga per passaggio: apertura, click su una delle due porte,
-- scelta del piano, invio del modulo, prenotazione completata.
-- Serve per capire dove si perde la gente, non per profilare nessuno.
-- ---------------------------------------------------------------------
create table if not exists eventi (
  id            bigserial primary key,
  nome          text not null,
  percorso      text,
  piano         text,
  sessione      text,            -- id casuale generato dal browser, non un utente
  pagina        text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  dati          jsonb,
  creato_il     timestamptz not null default now()
);
create index if not exists eventi_nome_idx on eventi(nome, creato_il desc);
create index if not exists eventi_sessione_idx on eventi(sessione);

-- ---------------------------------------------------------------------
-- SPESA PUBBLICITARIA
-- Inserita a mano una volta al mese: e' il denominatore delle due
-- metriche nuove. Senza questa tabella "costo per iscritto" non esiste.
-- ---------------------------------------------------------------------
create table if not exists spesa_ads (
  mese      date primary key,          -- sempre il primo del mese
  importo   numeric(10,2) not null check (importo >= 0),
  canale    text not null default 'meta',
  note      text
);

-- ---------------------------------------------------------------------
-- SCHEDA DEL GATTO: campi in piu' rispetto alla fase 1
-- ---------------------------------------------------------------------
alter table gatti add column if not exists sterilizzato boolean;
alter table gatti add column if not exists microchip text;
alter table gatti add column if not exists antiparassitario_il date;
alter table gatti add column if not exists convive_con_altri boolean;
alter table gatti add column if not exists veterinario text;
alter table gatti add column if not exists aggiornato_il timestamptz default now();

create or replace function tocca_gatto()
returns trigger language plpgsql as $$
begin
  new.aggiornato_il := now();
  return new;
end $$;

drop trigger if exists gatti_aggiornato on gatti;
create trigger gatti_aggiornato before update on gatti
for each row execute function tocca_gatto();

-- ---------------------------------------------------------------------
-- LE DUE METRICHE DELLA FASE 2
-- ---------------------------------------------------------------------
create or replace view metriche_mensili as
with mesi as (
  select date_trunc('month', g)::date as mese
  from generate_series(
         date_trunc('month', current_date) - interval '11 months',
         date_trunc('month', current_date),
         interval '1 month') g
),
contatti as (
  select date_trunc('month', creato_il)::date m, count(*) n,
         count(*) filter (where percorso = 'abbonamento') n_abb,
         count(*) filter (where percorso = 'notte') n_notte
  from lead group by 1
),
iscritti as (
  select date_trunc('month', creato_il)::date m, count(*) n
  from abbonamenti group by 1
),
prenotazioni_m as (
  select date_trunc('month', creata_il)::date m, count(*) n,
         coalesce(sum(contante_dovuto), 0) incasso
  from prenotazioni where stato <> 'annullata' group by 1
),
spesa as (select mese m, sum(importo) tot from spesa_ads group by 1)
select
  mesi.mese,
  coalesce(spesa.tot, 0)                                   as spesa_ads,
  coalesce(contatti.n, 0)                                  as contatti,
  coalesce(contatti.n_abb, 0)                              as contatti_abbonamento,
  coalesce(contatti.n_notte, 0)                            as contatti_notte,
  coalesce(iscritti.n, 0)                                  as iscritti,
  coalesce(prenotazioni_m.n, 0)                            as prenotazioni,
  coalesce(prenotazioni_m.incasso, 0)                      as incasso_prenotazioni,
  case when coalesce(contatti.n, 0) > 0
       then round(coalesce(spesa.tot, 0) / contatti.n, 2) end   as costo_per_contatto,
  case when coalesce(iscritti.n, 0) > 0
       then round(coalesce(spesa.tot, 0) / iscritti.n, 2) end   as costo_per_iscritto,
  case when coalesce(prenotazioni_m.n, 0) > 0
       then round(coalesce(spesa.tot, 0) / prenotazioni_m.n, 2) end as costo_per_prenotazione,
  case when coalesce(contatti.n, 0) > 0
       then round(100.0 * coalesce(iscritti.n, 0) / contatti.n, 1) end as conversione_iscritti_pct
from mesi
left join contatti       on contatti.m = mesi.mese
left join iscritti       on iscritti.m = mesi.mese
left join prenotazioni_m on prenotazioni_m.m = mesi.mese
left join spesa          on spesa.m = mesi.mese
order by mesi.mese desc;

-- Imbuto degli ultimi 30 giorni, per percorso
create or replace view imbuto_30gg as
select
  nome,
  coalesce(percorso, 'tutti')       as percorso,
  count(*)                          as eventi,
  count(distinct sessione)          as sessioni
from eventi
where creato_il > now() - interval '30 days'
group by 1, 2
order by 1, 2;

-- ---------------------------------------------------------------------
-- RLS
-- lead ed eventi si scrivono solo dalle route server (service role):
-- nessuna policy di insert, cosi' dal browser non si puo' inquinare
-- il dato nemmeno conoscendo la chiave anonima.
-- ---------------------------------------------------------------------
alter table lead      enable row level security;
alter table eventi    enable row level security;
alter table spesa_ads enable row level security;

drop policy if exists "nessuna lettura pubblica lead" on lead;
create policy "nessuna lettura pubblica lead" on lead for select using (false);

drop policy if exists "nessuna lettura pubblica eventi" on eventi;
create policy "nessuna lettura pubblica eventi" on eventi for select using (false);

drop policy if exists "nessuna lettura pubblica spesa" on spesa_ads;
create policy "nessuna lettura pubblica spesa" on spesa_ads for select using (false);
