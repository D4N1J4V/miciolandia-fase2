'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

type Modo = 'link' | 'password' | 'nuovo';

function destinazione() {
  try {
    const t = new URLSearchParams(window.location.search).get('torna');
    return t && t.startsWith('/') && !t.startsWith('//') ? t : '/app';
  } catch { return '/app'; }
}

function urlRitorno() {
  return `${window.location.origin}/auth/callback?torna=${encodeURIComponent(destinazione())}`;
}

export default function Login() {
  const [modo, setModo] = useState<Modo>('link');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stato, setStato] = useState<'fermo' | 'invio' | 'inviata'>('fermo');
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('errore') === 'link') {
      setErrore('Il link non è più valido o è stato aperto da un altro browser. Chiedine uno nuovo da qui.');
    }
  }, []);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    setStato('invio');
    setErrore(null);
    const auth = supabaseBrowser().auth;

    if (modo === 'link') {
      const { error } = await auth.signInWithOtp({ email, options: { emailRedirectTo: urlRitorno() } });
      if (error) {
        setErrore(error.status === 429
          ? 'Sono stati chiesti troppi link in poco tempo. Aspetta qualche minuto oppure entra con la password.'
          : 'Non sono riuscito a inviare il link. Controlla l’indirizzo e riprova.');
        setStato('fermo');
      } else setStato('inviata');
      return;
    }

    if (modo === 'password') {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) {
        setErrore(error.message.includes('Email not confirmed')
          ? 'Devi prima confermare l’indirizzo: apri il link che ti è arrivato per email, poi riprova.'
          : 'Email o password non corrispondono. Riprova, oppure fatti mandare un link di accesso.');
        setStato('fermo');
      } else window.location.href = destinazione();
      return;
    }

    if (password.length < 8) {
      setErrore('La password deve avere almeno 8 caratteri.');
      setStato('fermo');
      return;
    }
    const { data, error } = await auth.signUp({
      email, password,
      options: { emailRedirectTo: urlRitorno(), data: { name: nome.trim() } },
    });
    if (error) {
      setErrore(error.status === 429
        ? 'Sono state inviate troppe email in poco tempo. Aspetta qualche minuto e riprova.'
        : 'Non sono riuscito a creare l’account. Controlla i dati e riprova.');
      setStato('fermo');
    } else if (data.session) {
      window.location.href = destinazione();
    } else setStato('inviata');
  }

  const titoli: Record<Modo, string> = {
    link: 'Mandami il link',
    password: 'Entra',
    nuovo: 'Crea l’account',
  };

  return (
    <main className="wrap" style={{ paddingTop: 44, paddingBottom: 70, maxWidth: 560 }}>
      <h1 style={{ fontSize: 'clamp(2rem,4.6vw,2.8rem)' }}>Entra nell’area soci</h1>

      {stato === 'inviata' ? (
        <div className="avviso avviso-ok" style={{ marginTop: 22 }}>
          Ti ho mandato un’email a {email}. Apri il link da questo stesso browser ed entri
          direttamente. Se non la vedi entro un paio di minuti, controlla nello spam.
        </div>
      ) : (
        <>
          <div className="schede" role="tablist" style={{ marginTop: 22 }}>
            {(['link', 'password', 'nuovo'] as Modo[]).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={modo === m}
                      className={modo === m ? 'scheda attiva' : 'scheda'}
                      onClick={() => { setModo(m); setErrore(null); }}>
                {m === 'link' ? 'Link via email' : m === 'password' ? 'Password' : 'Nuovo account'}
              </button>
            ))}
          </div>

          <p className="guida" style={{ marginTop: 16 }}>
            {modo === 'link' && 'Niente password: inserisci la tua email e ti arriva un link per entrare.'}
            {modo === 'password' && 'Se hai già creato un account con password, entra da qui.'}
            {modo === 'nuovo' && 'Crea l’account una volta: ti mandiamo un’email per confermare l’indirizzo.'}
          </p>

          <form className="card" onSubmit={invia} style={{ display: 'grid', gap: 14 }}>
            {modo === 'nuovo' && (
              <div className="campo">
                <label htmlFor="nome">Nome</label>
                <input id="nome" value={nome} autoComplete="given-name"
                       onChange={(e) => setNome(e.target.value)} placeholder="Giulia" />
              </div>
            )}
            <div className="campo">
              <label htmlFor="em">Email</label>
              <input id="em" type="email" required value={email} autoComplete="email"
                     onChange={(e) => setEmail(e.target.value)} placeholder="nome@esempio.it" />
            </div>
            {modo !== 'link' && (
              <div className="campo">
                <label htmlFor="pw">Password</label>
                <input id="pw" type="password" required value={password}
                       autoComplete={modo === 'nuovo' ? 'new-password' : 'current-password'}
                       onChange={(e) => setPassword(e.target.value)}
                       placeholder={modo === 'nuovo' ? 'Almeno 8 caratteri' : ''} />
              </div>
            )}
            {errore && <div className="avviso avviso-no" style={{ marginTop: 0 }}>{errore}</div>}
            <button className="btn" type="submit" disabled={!email || stato === 'invio'}>
              {stato === 'invio' ? 'Un momento…' : titoli[modo]}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
