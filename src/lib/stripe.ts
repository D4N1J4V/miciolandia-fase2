import Stripe from 'stripe';

let client: Stripe | null = null;

/** Vero solo con una chiave Stripe reale: con i segnaposto di .env.example
 *  il sito resta in modalita' dimostrativa invece di andare in errore. */
export function stripeConfigurato(): boolean {
  return /^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(process.env.STRIPE_SECRET_KEY ?? '');
}

/** Client creato al primo uso, non all'import: un modulo che importa
 *  questo file non deve rompersi se la chiave manca. */
export function stripe(): Stripe {
  if (!stripeConfigurato()) {
    throw new Error('STRIPE_SECRET_KEY mancante o segnaposto');
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });
  }
  return client;
}

function priceIdValido(id: string | undefined): string | undefined {
  return id && /^price_[A-Za-z0-9]{10,}$/.test(id) ? id : undefined;
}

/** Mappa piano -> price id, presi dalle variabili d'ambiente. */
export const PRICE_ID: Record<string, string | undefined> = {
  base: priceIdValido(process.env.STRIPE_PRICE_BASE),
  plus: priceIdValido(process.env.STRIPE_PRICE_PLUS),
  premium: priceIdValido(process.env.STRIPE_PRICE_PREMIUM),
};

export function pianoDaPriceId(priceId: string): string | null {
  const trovato = Object.entries(PRICE_ID).find(([, id]) => id === priceId);
  return trovato ? trovato[0] : null;
}
