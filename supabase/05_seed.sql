-- =====================================================================
-- Miciolandia - dati iniziali
-- =====================================================================

insert into tariffe (tipo, etichetta, prezzo_notte, moltiplicatore) values
  ('bassa', 'Bassa stagione',   20.00, 1.00),
  ('media', 'Weekend e ponti',  30.00, 1.50),
  ('alta',  'Alta stagione',    40.00, 2.00)
on conflict (tipo) do update
  set prezzo_notte = excluded.prezzo_notte,
      moltiplicatore = excluded.moltiplicatore;

-- Alta stagione: agosto, Natale, settimana di Pasqua.
-- Da rinnovare ogni anno: e' una riga, non un deploy.
insert into periodi (nome, tipo, data_inizio, data_fine) values
  ('Agosto 2026',        'alta', '2026-08-01', '2026-08-31'),
  ('Natale 2026-27',     'alta', '2026-12-20', '2027-01-06'),
  ('Pasqua 2026',        'alta', '2026-03-30', '2026-04-06'),
  ('Agosto 2027',        'alta', '2027-08-01', '2027-08-31'),
  ('Pasqua 2027',        'alta', '2027-03-22', '2027-03-29')
on conflict do nothing;

insert into giorni_speciali (data, tipo, nome) values
  ('2026-04-25', 'media', '25 aprile'),
  ('2026-05-01', 'media', 'Primo maggio'),
  ('2026-06-02', 'media', 'Festa della Repubblica'),
  ('2026-11-01', 'media', 'Ognissanti'),
  ('2026-12-08', 'media', 'Immacolata')
on conflict (data) do nothing;

-- I tre piani, con le regole che rendono il modello non aggirabile:
-- mesi_sblocco_alta = 12 e tetto_alta_annuo.
insert into piani (codice, nome, quota_mensile, crediti_mensili, sconto_extra,
                   tetto_alta_annuo, mesi_sblocco_alta, validita_crediti_mesi,
                   vincolo_minimo_mesi) values
  ('base',    'Base - Posto garantito', 19.00, 1.00, 0.10,  4, 12, 12, 3),
  ('plus',    'Plus - Gatto curato',    39.00, 3.00, 0.15,  8, 12, 12, 3),
  ('premium', 'Premium - Tutto incluso',69.00, 6.00, 0.15, 12, 12, 12, 3)
on conflict (codice) do update
  set quota_mensile    = excluded.quota_mensile,
      crediti_mensili  = excluded.crediti_mensili,
      sconto_extra     = excluded.sconto_extra,
      tetto_alta_annuo = excluded.tetto_alta_annuo;

-- Struttura da 16 box
insert into box (nome, capienza)
select 'Box ' || lpad(g::text, 2, '0'), 3
from generate_series(1, 16) g
on conflict do nothing;
