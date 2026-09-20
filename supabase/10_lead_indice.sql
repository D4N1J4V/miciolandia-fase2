-- =====================================================================
-- Miciolandia - indice unico dei contatti allineato all'upsert
-- L'indice di 07 e' su lower(email): PostgREST non sa usare un indice
-- su espressione come bersaglio di on_conflict. La route salva gia'
-- l'email in minuscolo, quindi un indice sulle colonne nude e' equivalente,
-- e il vincolo di controllo garantisce che resti cosi'.
-- =====================================================================

update lead set email = lower(email) where email <> lower(email);

create unique index if not exists lead_email_percorso_col_idx on lead(email, percorso);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lead_email_minuscola') then
    alter table lead add constraint lead_email_minuscola check (email = lower(email));
  end if;
end $$;
