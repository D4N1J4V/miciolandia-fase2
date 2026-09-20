-- =====================================================================
-- Miciolandia - test del modello di business
-- Questi non sono test tecnici: verificano che l'abbonamento NON sia
-- sfruttabile e che convenga davvero a chi lo usa come previsto.
-- Si eseguono nel SQL Editor e si leggono a occhio.
-- =====================================================================

-- TEST 1 - Il furbo: 7 notti ad agosto, iscritto da 3 mesi (minimo).
-- Atteso: i crediti NON coprono nulla (alta bloccata nel primo anno),
-- paga il listino pieno e in piu' ha versato 3 quote.
select 'TEST 1 - furbo Premium, primo anno' as caso,
       calcola_preventivo('2026-08-12','2026-08-19', 1, 'premium', 3, 18, 0) as risultato;
-- Verifica: contante_dovuto = 280, crediti_usati = 0
-- Costo reale = 280 + (3 x 69) = 487 contro i 280 del forfait.

-- TEST 2 - Lo stesso soggiorno senza abbonamento.
select 'TEST 2 - forfait puro' as caso,
       calcola_preventivo('2026-08-12','2026-08-19', 1, null, 0, 0, 0) as risultato;
-- Verifica: totale_listino = 280.

-- TEST 3 - Il socio fedele: stesso soggiorno, ma al 14esimo mese
-- con 20 crediti accumulati.
-- Atteso: 7 notti coperte (14 crediti), contante 0, entro il tetto di 8.
select 'TEST 3 - socio Plus, secondo anno' as caso,
       calcola_preventivo('2026-08-12','2026-08-19', 1, 'plus', 14, 20, 0) as risultato;

-- TEST 4 - Il tetto annuo morde: stesso socio, ma ha gia' usato
-- 6 notti di alta quest'anno (tetto Plus = 8).
-- Atteso: solo 2 notti coperte, le altre 5 a listino pieno.
select 'TEST 4 - tetto alta stagione' as caso,
       calcola_preventivo('2026-08-12','2026-08-19', 1, 'plus', 14, 20, 6) as risultato;

-- TEST 5 - Bassa stagione, socio primo anno: i crediti funzionano.
select 'TEST 5 - bassa stagione, primo anno' as caso,
       calcola_preventivo('2026-02-09','2026-02-13', 1, 'plus', 2, 6, 0) as risultato;
-- Verifica: 4 notti feriali, 4 crediti, contante 0.

-- TEST 6 - Due gatti della stessa famiglia (+70%).
select 'TEST 6 - due gatti' as caso,
       calcola_preventivo('2026-02-09','2026-02-13', 2, null, 0, 0, 0) as risultato;
-- Verifica: totale_listino = 4 x 20 x 1,7 = 136.

-- TEST 7 - Soggiorno lungo: sconto del 15% dalla decima notte.
select 'TEST 7 - dodici notti in bassa stagione' as caso,
       calcola_preventivo('2026-02-02','2026-02-14', 1, null, 0, 0, 0) as risultato;

-- TEST 8 - Scadenza FIFO: quanti movimenti di scadenza genera oggi.
select 'TEST 8 - scadenze' as caso, scadi_crediti() as righe_generate;
