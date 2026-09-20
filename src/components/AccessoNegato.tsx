export default function AccessoNegato({ email }: { email: string }) {
  return (
    <main className="wrap" style={{ paddingTop: 44, paddingBottom: 70, maxWidth: 640 }}>
      <h1 style={{ fontSize: 'clamp(1.9rem,4.4vw,2.6rem)' }}>Pagina riservata allo staff</h1>
      <p className="guida" style={{ marginTop: 14 }}>
        Sei entrato come {email}, che è un account cliente. Se lavori in pensione, chiedi al
        gestore di abilitare il tuo account come staff e poi ricarica questa pagina.
      </p>
      <div className="riga" style={{ marginTop: 20 }}>
        <a className="btn" href="/app">Vai alla tua area</a>
        <a className="btn btn-vuoto" href="/">Torna alla home</a>
      </div>
    </main>
  );
}
