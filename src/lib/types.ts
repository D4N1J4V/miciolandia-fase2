export type TipoNotte = 'bassa' | 'media' | 'alta';
export type CodicePiano = 'base' | 'plus' | 'premium';

export interface RigaNotte {
  data: string;
  tipo: TipoNotte;
  prezzo_listino: number;
  crediti: number;
  pagata_con: 'crediti' | 'contante';
  contante: number;
}

/** Ritorno della funzione SQL calcola_preventivo. */
export interface Preventivo {
  notti: number;
  notti_alta: number;
  righe: RigaNotte[];
  totale_listino: number;
  crediti_necessari: number;
  crediti_usati: number;
  crediti_residui: number;
  contante_dovuto: number;
  notti_alta_a_credito: number;
  piano: CodicePiano | null;
  alta_sbloccata: boolean;
  risparmio: number;
}

export interface Piano {
  codice: CodicePiano;
  nome: string;
  quota_mensile: number;
  crediti_mensili: number;
  sconto_extra: number;
  tetto_alta_annuo: number;
  mesi_sblocco_alta: number;
  validita_crediti_mesi: number;
  vincolo_minimo_mesi: number;
  stripe_price_id: string | null;
}

export interface MovimentoCredito {
  id: number;
  tipo: 'accredito' | 'consumo' | 'scadenza' | 'rimborso' | 'rettifica';
  crediti: number;
  data_movimento: string;
  data_scadenza: string | null;
  note: string | null;
}

export const ETICHETTE: Record<TipoNotte, string> = {
  bassa: 'Bassa stagione',
  media: 'Weekend',
  alta: 'Alta stagione',
};

export function euro(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export function crediti(n: number): string {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(n);
}

export function dataBreve(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}
