import { supabaseServer, supabaseAdmin } from '@/lib/supabase';
import FormServizio from '@/components/FormServizio';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cura a domicilio e trasporto — Miciolandia',
};

export default async function Servizi() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  const { data: cliente } = user
    ? await supabaseAdmin().from('clienti').select('nome, email, telefono').eq('id', user.id).maybeSingle()
    : { data: null };

  return (
    <main className="wrap" style={{ paddingTop: 44, paddingBottom: 70 }}>
      <h1 style={{ fontSize: 'clamp(2rem,4.6vw,3rem)' }}>Cura a domicilio e trasporto</h1>
      <p className="guida stretta" style={{ marginTop: 14 }}>
        Per i gatti che stanno meglio a casa loro, e per chi il trasportino proprio non lo
        sopporta. Si possono chiedere anche senza essere soci e senza un soggiorno in pensione.
      </p>

      <div className="servizi" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <article className="servizio">
          <h3>Cura a domicilio</h3>
          <p>
            Una visita al giorno a casa tua: cibo, acqua, lettiera, farmaci se servono, e le
            stesse foto che riceveresti se fosse da noi.
          </p>
          <span className="tariffa">18 € a visita</span>
        </article>
        <article className="servizio">
          <h3>Trasporto</h3>
          <p>
            Veniamo a prenderlo e te lo riportiamo. Puoi usarlo anche da solo, per esempio per
            accompagnarlo dal veterinario.
          </p>
          <span className="tariffa">15 € andata e ritorno entro 20 km</span>
        </article>
      </div>

      <p className="nota" style={{ marginTop: 14, maxWidth: '64ch' }}>
        Oltre i 20 km il trasporto non è a listino: indicalo nella richiesta e ti ricontattiamo
        prima di confermare.
      </p>

      <h2 style={{ marginTop: 44, fontSize: '1.6rem' }}>Chiedi una visita o un trasporto</h2>
      <FormServizio
        nome={cliente?.nome ?? ''}
        email={cliente?.email ?? user?.email ?? ''}
        telefono={cliente?.telefono ?? ''}
      />
    </main>
  );
}
