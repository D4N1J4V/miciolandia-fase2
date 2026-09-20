-- =====================================================================
-- Miciolandia - ruoli
-- /gestore, /metriche e /api/spesa sono riservate allo staff.
-- Eseguire dopo 08. Additivo: non tocca i dati esistenti.
--
-- Per rendere staff un account:
--   update clienti set ruolo = 'staff' where email = 'nome@esempio.it';
-- =====================================================================

alter table clienti add column if not exists ruolo text not null default 'cliente';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clienti_ruolo_check') then
    alter table clienti add constraint clienti_ruolo_check check (ruolo in ('cliente','staff'));
  end if;
end $$;
