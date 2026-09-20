'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

/** Nel menu: "Accedi" o "Area soci". Gira nel browser per non rendere
 *  dinamiche tutte le pagine pubbliche solo per questa voce. */
export default function MenuUtente() {
  const [dentro, setDentro] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = supabaseBrowser().auth;
    auth.getSession().then(({ data }) => setDentro(!!data.session));
    const { data } = auth.onAuthStateChange((_e, s) => setDentro(!!s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (dentro === null) return <span className="solo-desktop" style={{ width: 70 }} />;
  return dentro
    ? <a href="/app">Area soci</a>
    : <a href="/login">Accedi</a>;
}
