-- =====================================================================
-- Miciolandia - Row Level Security
-- Ogni cliente vede solo i propri dati. Listini e piani sono pubblici
-- perche' servono al calcolatore della home, che gira senza login.
-- =====================================================================

alter table clienti            enable row level security;
alter table gatti              enable row level security;
alter table abbonamenti        enable row level security;
alter table prenotazioni       enable row level security;
alter table movimenti_credito  enable row level security;
alter table diario             enable row level security;

alter table tariffe         enable row level security;
alter table periodi         enable row level security;
alter table giorni_speciali enable row level security;
alter table piani           enable row level security;
alter table box             enable row level security;

-- Dati pubblici in lettura
create policy "listini pubblici"  on tariffe         for select using (true);
create policy "periodi pubblici"  on periodi         for select using (true);
create policy "giorni pubblici"   on giorni_speciali for select using (true);
create policy "piani pubblici"    on piani           for select using (true);
create policy "box pubblici"      on box             for select using (true);

-- Dati personali
create policy "il mio profilo" on clienti
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "i miei gatti" on gatti
  for all using (auth.uid() = cliente_id) with check (auth.uid() = cliente_id);

create policy "il mio abbonamento" on abbonamenti
  for select using (auth.uid() = cliente_id);

create policy "le mie prenotazioni" on prenotazioni
  for select using (auth.uid() = cliente_id);

-- Il registro e' in sola lettura per il cliente: si scrive solo tramite
-- le funzioni security definer (accredita_crediti, crea_prenotazione...).
create policy "il mio registro" on movimenti_credito
  for select using (auth.uid() = cliente_id);

create policy "il diario del mio gatto" on diario
  for select using (
    exists (select 1 from prenotazioni p
             where p.id = diario.prenotazione_id and p.cliente_id = auth.uid()));
