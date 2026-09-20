-- =====================================================================
-- Miciolandia - creazione automatica del cliente al primo accesso
-- Senza questo, chi entra col magic link esiste in auth.users ma non in
-- `clienti`, e ogni scrittura collegata (gatti, prenotazioni) fallisce.
-- Eseguire dopo 07.
-- =====================================================================

create or replace function crea_cliente_da_utente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into clienti (id, nome, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      initcap(split_part(new.email, '@', 1))
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists su_nuovo_utente on auth.users;
create trigger su_nuovo_utente
  after insert on auth.users
  for each row execute function crea_cliente_da_utente();

-- Recupero per chi si fosse gia' registrato prima di questo script
insert into clienti (id, nome, email)
select u.id,
       initcap(split_part(u.email, '@', 1)),
       u.email
from auth.users u
left join clienti c on c.id = u.id
where c.id is null and u.email is not null;
