import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Rinnova la sessione a ogni richiesta, cosi' i Server Components
 * trovano sempre un token valido.
 * Se Supabase rimanda il link di accesso a una pagina qualsiasi
 * (succede quando il redirect non e' tra quelli ammessi e ripiega sul
 * Site URL), il codice viene girato alla route di callback.
 */
export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const codice = url.searchParams.get('code');
  if (codice && url.pathname !== '/auth/callback') {
    const dest = url.clone();
    dest.pathname = '/auth/callback';
    dest.search = '';
    dest.searchParams.set('code', codice);
    const torna = url.searchParams.get('torna') ?? (url.pathname === '/' ? '/app' : url.pathname);
    dest.searchParams.set('torna', torna);
    return NextResponse.redirect(dest);
  }

  let res = NextResponse.next({ request: req });

  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (lista: { name: string; value: string; options: CookieOptions }[]) => {
          lista.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );
  await db.auth.getUser();

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:png|jpg|svg|ico|html)$).*)'],
};
