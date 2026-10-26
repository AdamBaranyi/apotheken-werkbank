import type { NextRequest } from 'next/server';
import { gleicheHerkunft } from '@/lib/herkunft';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Abmelden nur per POST aus dem eigenen Formular. Fremde Herkunft wird
 * abgewiesen; die Weiterleitung ist relativ, damit sie hinter jedem Proxy stimmt.
 */
export async function POST(anfrage: NextRequest) {
  if (!gleicheHerkunft(anfrage.headers.get('origin'), anfrage.headers.get('host'))) {
    return new Response('Fremde Herkunft', { status: 403 });
  }
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return new Response(null, { status: 303, headers: { Location: '/anmelden' } });
}
