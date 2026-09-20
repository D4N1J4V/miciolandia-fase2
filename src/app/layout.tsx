import type { Metadata } from 'next';
import './globals.css';
import MenuUtente from '@/components/MenuUtente';

export const metadata: Metadata = {
  title: 'Miciolandia — pensione per soli gatti a Bergamo',
  description:
    'Pensione felina a Bergamo e provincia: zona comune interna ed esterna, cura a domicilio, ' +
    'trasporto dedicato. Prezzi pubblici e posto garantito per i soci.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="barra">
          <div className="barra-in">
            <a className="logo" href="/">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10.5V5l3.6 2.6a8.6 8.6 0 0 1 8.8 0L20 5v5.5a8 8 0 1 1-16 0Z" />
                <path d="M9.2 12h.01M14.8 12h.01M12 15.2v1.4" />
              </svg>
              Miciolandia
            </a>
            <nav className="menu">
              <a className="solo-desktop" href="/servizi">Domicilio e trasporto</a>
              <a className="solo-desktop" href="/prezzi">Prezzi</a>
              <a className="solo-desktop" href="/faq">Domande</a>
              <MenuUtente />
              <a className="btn btn-miele" href="/prenota">Prenota</a>
            </nav>
          </div>
        </header>
        {children}
        <footer>
          <div className="wrap">
            Miciolandia · Bergamo e provincia · Pensione per soli gatti.
            Prezzi e servizi aggiornati a settembre 2026.
          </div>
        </footer>
      </body>
    </html>
  );
}
