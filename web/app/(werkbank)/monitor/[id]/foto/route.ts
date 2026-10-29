import { z } from 'zod';
import { sitzungLesen, supabaseServer } from '@/lib/supabase/server';
import { fotoBytes } from '@/lib/monitor/texte';

/**
 * Das Bildschirmfoto eines Laufs als PNG. Gelesen wird mit der Sitzung der
 * angemeldeten Person; welche Fotos sie sehen darf, entscheidet die
 * Datenbank (RLS). Textkarten zeigt die Seite selbst.
 */
export async function GET(_anfrage: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || !(await sitzungLesen())) {
    return new Response('Nicht gefunden', { status: 404 });
  }
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('engine_fotos')
    .select('art, inhalt')
    .eq('lauf_id', id)
    .maybeSingle();
  if (!data || data.art !== 'png') return new Response('Nicht gefunden', { status: 404 });
  return new Response(fotoBytes(data.inhalt as string), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
