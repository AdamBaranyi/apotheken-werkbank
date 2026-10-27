import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Sitzungs-Cookies nur für den Server lesbar (httpOnly): Der Browser spricht
 * nie selbst mit Supabase (E17), kein Skript im Browser braucht das Token.
 * Ein eingeschleustes Skript käme so nicht an die Sitzung. «secure» nur im
 * Produktionsbuild; der Entwicklungsserver läuft über http.
 */
export const SITZUNGS_COOKIE: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};
