-- =====================================================================
-- Miciolandia - richieste di cura a domicilio e trasporto
-- Il servizio che parte per primo, prima della struttura: non passa dal
-- calendario dei box, quindi ha una tabella sua. Si scrive solo dalla
-- route server con il service role, come lead ed eventi.
-- =====================================================================

create table if not exists richieste_servizio (
  id           bigserial primary key,
  servizio     text not null check (servizio in ('domicilio','trasporto')),
  cliente_id   uuid references clienti(id) on delete set null,
  nome         text not null,
  email        text not null,
  telefono     text not null,
  comune       text not null,
  dal          date not null,
  al           date,
  visite       int,
  note         text,
  stato        text not null default 'nuova'
               check (stato in ('nuova','confermata','rifiutata','svolta')),
  creata_il    timestamptz not null default now(),
  check (al is null or al >= dal)
);
create index if not exists richieste_servizio_creata_idx on richieste_servizio(creata_il desc);

alter table richieste_servizio enable row level security;

drop policy if exists "le mie richieste" on richieste_servizio;
create policy "le mie richieste" on richieste_servizio
  for select using (auth.uid() = cliente_id);
