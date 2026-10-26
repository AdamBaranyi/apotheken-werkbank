import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Läuft vor jeder Seite: Nonce für die Content Security Policy, Sitzung von
 * Supabase auffrischen, und ohne Anmeldung zur Anmeldung leiten. Ein Layout
 * ist keine Sperre – jede Seite und jede Server-Aktion prüft die Sitzung
 * zusätzlich selbst.
 */
const OEFFENTLICH = ['/anmelden'];

function csp(nonce: string): string {
  const entwicklung = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${entwicklung ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${entwicklung ? ' ws:' : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export async function proxy(anfrage: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const richtlinie = csp(nonce);
  const kopf = new Headers(anfrage.headers);
  kopf.set('x-nonce', nonce);
  kopf.set('content-security-policy', richtlinie);

  let antwort = NextResponse.next({ request: { headers: kopf } });
  const supabase = createServerClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
    {
      cookies: {
        getAll: () => anfrage.cookies.getAll(),
        setAll: (liste) => {
          for (const { name, value } of liste) anfrage.cookies.set(name, value);
          antwort = NextResponse.next({ request: { headers: kopf } });
          for (const { name, value, options } of liste) antwort.cookies.set(name, value, options);
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  const pfad = anfrage.nextUrl.pathname;
  if (!data.user && !OEFFENTLICH.includes(pfad)) {
    const ziel = anfrage.nextUrl.clone();
    ziel.pathname = '/anmelden';
    ziel.search = '';
    antwort = NextResponse.redirect(ziel);
  }
  antwort.headers.set('content-security-policy', richtlinie);
  return antwort;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|schriften/).*)'],
};
