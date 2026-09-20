-- =====================================================================
-- Miciolandia - assegnazione dello spazio in base alla capienza
-- Sostituisce crea_prenotazione di 03: la logica di prezzo e crediti
-- e' identica, cambia solo come si sceglie il box.
--  - il box deve contenere tutti i gatti della famiglia
--  - tra quelli adatti si prende il piu' piccolo, per lasciare liberi
--    i box grandi alle famiglie numerose
--  - il gatto indicato deve appartenere al cliente
--  - un lock di transazione evita che due prenotazioni simultanee
--    ricevano lo stesso box
-- =====================================================================

create or replace function box_liberi(p_check_in date, p_check_out date, p_n_gatti int)
returns int
language sql stable as $$
  select count(*)::int
  from box b
  where b.attivo
    and b.capienza >= greatest(p_n_gatti, 1)
    and not exists (
      select 1 from prenotazioni p
      where p.box_id = b.id
        and p.stato = 'confermata'
        and p.check_in < p_check_out
        and p.check_out > p_check_in);
$$;

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
begin
  if p_check_in < current_date then
    return jsonb_build_object('errore', 'La data di arrivo è già passata: scegline una da oggi in poi.');
  end if;

  if p_gatto is not null and not exists (
       select 1 from gatti where id = p_gatto and cliente_id = p_cliente) then
    return jsonb_build_object('errore', 'Il gatto indicato non risulta nella tua scheda: ricarica la pagina e riprova.');
  end if;

  perform pg_advisory_xact_lock(hashtext('miciolandia:assegnazione_box'));

  select b.id into v_box
  from box b
  where b.attivo
    and b.capienza >= greatest(p_n_gatti, 1)
    and not exists (
      select 1 from prenotazioni p
      where p.box_id = b.id
        and p.stato = 'confermata'
        and p.check_in < p_check_out
        and p.check_out > p_check_in)
  order by b.capienza, b.id
  limit 1;

  if v_box is null then
    return jsonb_build_object('errore',
      'In queste date non c’è uno spazio libero per ' || greatest(p_n_gatti, 1)
      || case when greatest(p_n_gatti, 1) = 1 then ' gatto' else ' gatti' end
      || '. Prova a spostare di qualche giorno arrivo o partenza.');
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
