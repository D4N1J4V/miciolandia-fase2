-- =====================================================================
-- Miciolandia - gestione del registro crediti
-- Accredito, consumo, scadenza FIFO, rimborso da disdetta.
-- =====================================================================

-- Accredito mensile. Idempotente: se il riferimento esiste gia'
-- (stesso invoice Stripe) non fa nulla. Cosi' un webhook ripetuto
-- non raddoppia i crediti.
create or replace function accredita_crediti(
  p_cliente     uuid,
  p_crediti     numeric,
  p_riferimento text,
  p_validita_mesi int default 12,
  p_note        text default null
)
returns bigint
language plpgsql security definer as $$
declare v_id bigint;
begin
  if p_riferimento is not null and exists (
     select 1 from movimenti_credito where riferimento = p_riferimento) then
    return null;
  end if;

  insert into movimenti_credito (cliente_id, tipo, crediti, data_scadenza, riferimento, note)
  values (p_cliente, 'accredito', p_crediti,
          (current_date + (p_validita_mesi || ' months')::interval)::date,
          p_riferimento, p_note)
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- SCADENZA FIFO
-- I consumi si allocano sugli accrediti piu' vecchi. Quello che resta
-- non allocato su un accredito gia' scaduto viene azzerato con una
-- riga di tipo 'scadenza'. Nessun dato viene cancellato o modificato:
-- lo storico resta leggibile per intero.
-- ---------------------------------------------------------------------
create or replace function scadi_crediti(p_oggi date default current_date)
returns int
language plpgsql security definer as $$
declare
  v_cliente   record;
  v_acc       record;
  v_uscite    numeric;
  v_residuo   numeric;
  v_righe     int := 0;
begin
  for v_cliente in select distinct cliente_id from movimenti_credito loop

    -- Tutto cio' che e' gia' uscito (consumi e scadenze precedenti)
    select coalesce(-sum(crediti), 0) into v_uscite
    from movimenti_credito
    where cliente_id = v_cliente.cliente_id
      and (tipo in ('consumo', 'scadenza') or (tipo = 'rettifica' and crediti < 0));

    -- Allocazione FIFO sugli accrediti, dal piu' vecchio
    for v_acc in
      select id, crediti, data_scadenza
      from movimenti_credito
      where cliente_id = v_cliente.cliente_id
        and tipo in ('accredito', 'rimborso', 'rettifica')
        and crediti > 0
      order by data_movimento asc, id asc
    loop
      if v_uscite >= v_acc.crediti then
        v_uscite := v_uscite - v_acc.crediti;
      else
        v_residuo := v_acc.crediti - v_uscite;
        v_uscite  := 0;

        if v_acc.data_scadenza is not null and v_acc.data_scadenza < p_oggi then
          insert into movimenti_credito
            (cliente_id, tipo, crediti, riferimento, note)
          values
            (v_cliente.cliente_id, 'scadenza', -v_residuo,
             'scadenza:' || v_acc.id,
             'crediti non utilizzati, scaduti il ' || v_acc.data_scadenza);
          v_righe := v_righe + 1;
        end if;
      end if;
    end loop;
  end loop;

  return v_righe;
end $$;

-- Crediti che scadranno entro N giorni (per il promemoria automatico)
create or replace function crediti_in_scadenza(p_giorni int default 30)
returns table (cliente_id uuid, email text, crediti numeric, data_scadenza date)
language sql stable as $$
  with allocazione as (
    select
      m.cliente_id,
      m.id,
      m.crediti,
      m.data_scadenza,
      sum(m.crediti) over (partition by m.cliente_id order by m.data_movimento, m.id)
        as cumulato
    from movimenti_credito m
    where m.tipo in ('accredito','rimborso','rettifica') and m.crediti > 0
  ),
  uscite as (
    select cliente_id, coalesce(-sum(crediti), 0) as totale
    from movimenti_credito
    where tipo in ('consumo','scadenza')
    group by cliente_id
  )
  select
    a.cliente_id,
    c.email,
    least(a.crediti, greatest(a.cumulato - coalesce(u.totale, 0), 0)) as crediti,
    a.data_scadenza
  from allocazione a
  join clienti c on c.id = a.cliente_id
  left join uscite u on u.cliente_id = a.cliente_id
  where a.data_scadenza between current_date and current_date + p_giorni
    and greatest(a.cumulato - coalesce(u.totale, 0), 0) > 0;
$$;

-- ---------------------------------------------------------------------
-- PRENOTAZIONE ATOMICA
-- Calcola il preventivo, verifica la disponibilita' e scrive la riga di
-- consumo nel registro: o va a buon fine tutto, o non succede niente.
-- ---------------------------------------------------------------------
create or replace function crea_prenotazione(
  p_cliente   uuid,
  p_gatto     bigint,
  p_check_in  date,
  p_check_out date,
  p_n_gatti   int default 1
)
returns jsonb
language plpgsql security definer as $$
declare
  v_abb       abbonamenti%rowtype;
  v_piano     text := null;
  v_mesi      int := 0;
  v_saldo     numeric := 0;
  v_alta_uso  int := 0;
  v_prev      jsonb;
  v_box       bigint;
  v_id        bigint;
  v_validita  int := 12;
begin
  if box_liberi(p_check_in, p_check_out) <= 0 then
    return jsonb_build_object('errore', 'Nessun box libero in queste date');
  end if;

  select * into v_abb
  from abbonamenti
  where cliente_id = p_cliente and stato = 'attivo'
  order by data_inizio desc limit 1;

  if found then
    v_piano := v_abb.piano_codice;
    v_mesi  := greatest(
      (extract(year from age(current_date, v_abb.data_inizio)) * 12
       + extract(month from age(current_date, v_abb.data_inizio)))::int, 0);
    select coalesce(saldo, 0) into v_saldo from saldo_crediti where cliente_id = p_cliente;
    v_alta_uso := notti_alta_a_credito_usate(p_cliente, extract(year from p_check_in)::int);
  end if;

  v_prev := calcola_preventivo(
    p_check_in, p_check_out, p_n_gatti, v_piano, v_mesi, v_saldo, v_alta_uso);

  select id into v_box
  from box
  where attivo
    and id not in (
      select box_id from prenotazioni
      where stato = 'confermata'
        and check_in < p_check_out and check_out > p_check_in
        and box_id is not null)
  limit 1;

  insert into prenotazioni (
    cliente_id, gatto_id, box_id, n_gatti, check_in, check_out,
    totale_listino, crediti_usati, contante_dovuto,
    notti_totali, notti_alta, notti_alta_a_credito)
  values (
    p_cliente, p_gatto, v_box, p_n_gatti, p_check_in, p_check_out,
    (v_prev->>'totale_listino')::numeric,
    (v_prev->>'crediti_usati')::numeric,
    (v_prev->>'contante_dovuto')::numeric,
    (v_prev->>'notti')::int,
    (v_prev->>'notti_alta')::int,
    (v_prev->>'notti_alta_a_credito')::int)
  returning id into v_id;

  if (v_prev->>'crediti_usati')::numeric > 0 then
    insert into movimenti_credito (cliente_id, tipo, crediti, prenotazione_id, note)
    values (p_cliente, 'consumo', -(v_prev->>'crediti_usati')::numeric, v_id,
            'soggiorno ' || p_check_in || ' / ' || p_check_out);
  end if;

  return v_prev || jsonb_build_object('prenotazione_id', v_id, 'box_id', v_box);
end $$;

-- Disdetta: oltre le 72 ore torna tutto, sotto le 72 ore meta' dei crediti.
create or replace function annulla_prenotazione(p_prenotazione bigint)
returns jsonb
language plpgsql security definer as $$
declare
  v_p      prenotazioni%rowtype;
  v_quota  numeric;
begin
  select * into v_p from prenotazioni where id = p_prenotazione;
  if not found then
    return jsonb_build_object('errore', 'Prenotazione inesistente');
  end if;
  if v_p.stato = 'annullata' then
    return jsonb_build_object('errore', 'Gia'' annullata');
  end if;

  v_quota := case when v_p.check_in - current_date >= 3 then 1.0 else 0.5 end;

  update prenotazioni set stato = 'annullata' where id = p_prenotazione;

  if v_p.crediti_usati > 0 then
    insert into movimenti_credito
      (cliente_id, tipo, crediti, data_scadenza, prenotazione_id, note)
    values
      (v_p.cliente_id, 'rimborso', round(v_p.crediti_usati * v_quota, 2),
       (current_date + interval '12 months')::date, p_prenotazione,
       case when v_quota = 1.0 then 'disdetta oltre le 72 ore'
            else 'disdetta entro le 72 ore, meta'' crediti' end);
  end if;

  return jsonb_build_object(
    'annullata', true,
    'crediti_restituiti', round(v_p.crediti_usati * v_quota, 2));
end $$;
