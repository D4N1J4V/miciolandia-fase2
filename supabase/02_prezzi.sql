-- =====================================================================
-- Miciolandia - motore di prezzo
-- Unica fonte di verita': il calcolatore pubblico, il motore di
-- prenotazione e il pannello gestore chiamano tutti queste funzioni.
-- =====================================================================

-- Che tipo di notte e' una certa data.
-- Precedenza: periodo esplicito > giorno speciale > weekend > bassa.
create or replace function tipo_notte(p_data date)
returns text
language sql stable as $$
  select coalesce(
    (select p.tipo from periodi p
      where p_data between p.data_inizio and p.data_fine
      order by case p.tipo when 'alta' then 1 when 'media' then 2 else 3 end
      limit 1),
    (select g.tipo from giorni_speciali g where g.data = p_data),
    case when extract(dow from p_data) in (0, 5, 6) then 'media' else 'bassa' end
  );
$$;

-- Dettaglio notte per notte di un soggiorno.
-- Il check_out non si paga: si contano le notti dormite.
create or replace function righe_soggiorno(p_check_in date, p_check_out date)
returns table (data date, tipo text, prezzo_listino numeric, crediti numeric)
language sql stable as $$
  select
    d::date                as data,
    t.tipo                 as tipo,
    t.prezzo_notte         as prezzo_listino,
    t.moltiplicatore       as crediti
  from generate_series(p_check_in, p_check_out - 1, interval '1 day') d
  join tariffe t on t.tipo = tipo_notte(d::date)
  order by d;
$$;

-- Quante notti di alta stagione il cliente ha gia' pagato con i crediti
-- nell'anno solare indicato (serve per il tetto annuo).
create or replace function notti_alta_a_credito_usate(p_cliente uuid, p_anno int)
returns int
language sql stable as $$
  select coalesce(sum(p.notti_alta_a_credito), 0)::int
  from prenotazioni p
  where p.cliente_id = p_cliente
    and p.stato <> 'annullata'
    and extract(year from p.check_in) = p_anno;
$$;

-- ---------------------------------------------------------------------
-- IL PREVENTIVO
-- Applica, nell'ordine, tutte le regole del modello:
--   1. prezzo e crediti per notte secondo la stagione
--   2. moltiplicatore per gatti aggiuntivi della stessa famiglia (+70%)
--   3. sconto soggiorno lungo (-15% dalla decima notte, solo sul listino)
--   4. i crediti valgono in alta stagione solo dal 13esimo mese
--   5. tetto annuo di notti di alta pagabili con crediti
--   6. le notti non coperte dai crediti si pagano a tariffa socio,
--      tranne in alta stagione dove si paga sempre il listino pieno
-- ---------------------------------------------------------------------
create or replace function calcola_preventivo(
  p_check_in          date,
  p_check_out         date,
  p_n_gatti           int  default 1,
  p_piano             text default null,
  p_mesi_iscrizione   int  default 0,
  p_crediti_disponibili numeric default 0,
  p_alta_gia_usate    int  default 0
)
returns jsonb
language plpgsql stable as $$
declare
  v_piano            piani%rowtype;
  v_molt_gatti       numeric;
  v_sconto_lungo     numeric := 1.0;
  v_notti            int := 0;
  v_notti_alta       int := 0;
  v_listino          numeric := 0;
  v_crediti_totali   numeric := 0;
  v_alta_sbloccata   boolean := false;
  v_alta_residue     int := 0;
  v_crediti_res      numeric;
  v_crediti_usati    numeric := 0;
  v_contante         numeric := 0;
  v_alta_a_credito   int := 0;
  v_righe            jsonb := '[]'::jsonb;
  r                  record;
  v_prezzo           numeric;
  v_crediti_notte    numeric;
  v_coperta          boolean;
  v_prezzo_socio     numeric;
begin
  if p_check_out <= p_check_in then
    raise exception 'La partenza deve essere successiva all''arrivo';
  end if;

  v_molt_gatti := 1 + 0.7 * (greatest(p_n_gatti, 1) - 1);

  select count(*) into v_notti
  from generate_series(p_check_in, p_check_out - 1, interval '1 day');

  if v_notti >= 10 then
    v_sconto_lungo := 0.85;
  end if;

  if p_piano is not null then
    select * into v_piano from piani where codice = p_piano;
    if found then
      v_alta_sbloccata := p_mesi_iscrizione >= v_piano.mesi_sblocco_alta;
      v_alta_residue   := greatest(v_piano.tetto_alta_annuo - p_alta_gia_usate, 0);
    end if;
  end if;

  v_crediti_res := coalesce(p_crediti_disponibili, 0);

  for r in select * from righe_soggiorno(p_check_in, p_check_out) loop
    v_prezzo        := round(r.prezzo_listino * v_molt_gatti * v_sconto_lungo, 2);
    v_crediti_notte := round(r.crediti * v_molt_gatti, 2);
    v_listino       := v_listino + v_prezzo;
    v_crediti_totali:= v_crediti_totali + v_crediti_notte;
    if r.tipo = 'alta' then
      v_notti_alta := v_notti_alta + 1;
    end if;

    v_coperta := false;

    if v_piano.codice is not null then
      if r.tipo = 'alta' then
        -- Regola 4 e 5: alta stagione solo dal 13esimo mese ed entro il tetto annuo
        if v_alta_sbloccata and v_alta_residue > 0 and v_crediti_res >= v_crediti_notte then
          v_coperta        := true;
          v_alta_residue   := v_alta_residue - 1;
          v_alta_a_credito := v_alta_a_credito + 1;
        end if;
      else
        if v_crediti_res >= v_crediti_notte then
          v_coperta := true;
        end if;
      end if;
    end if;

    if v_coperta then
      v_crediti_res   := v_crediti_res - v_crediti_notte;
      v_crediti_usati := v_crediti_usati + v_crediti_notte;
      v_prezzo_socio  := 0;
    else
      -- Regola 6: sconto socio solo fuori alta stagione
      if v_piano.codice is not null and r.tipo <> 'alta' then
        v_prezzo_socio := round(v_prezzo * (1 - v_piano.sconto_extra), 2);
      else
        v_prezzo_socio := v_prezzo;
      end if;
      v_contante := v_contante + v_prezzo_socio;
    end if;

    v_righe := v_righe || jsonb_build_object(
      'data',            r.data,
      'tipo',            r.tipo,
      'prezzo_listino',  v_prezzo,
      'crediti',         v_crediti_notte,
      'pagata_con',      case when v_coperta then 'crediti' else 'contante' end,
      'contante',        v_prezzo_socio
    );
  end loop;

  return jsonb_build_object(
    'notti',                v_notti,
    'notti_alta',           v_notti_alta,
    'righe',                v_righe,
    'totale_listino',       round(v_listino, 2),
    'crediti_necessari',    round(v_crediti_totali, 2),
    'crediti_usati',        round(v_crediti_usati, 2),
    'crediti_residui',      round(v_crediti_res, 2),
    'contante_dovuto',      round(v_contante, 2),
    'notti_alta_a_credito', v_alta_a_credito,
    'piano',                p_piano,
    'alta_sbloccata',       v_alta_sbloccata,
    'risparmio',            round(v_listino - v_contante, 2)
  );
end $$;

-- Disponibilita' box in un intervallo
create or replace function box_liberi(p_check_in date, p_check_out date)
returns int
language sql stable as $$
  select (select count(*) from box where attivo)
       - (select count(*) from prenotazioni p
           where p.stato = 'confermata'
             and p.check_in < p_check_out
             and p.check_out > p_check_in);
$$;
