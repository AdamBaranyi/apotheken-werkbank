import { belegLaden } from '@/lib/kasse/beleg-laden';
import { belegZeilen } from '@/lib/kasse/beleg-zeilen';
import { pdfBauen } from '@/lib/pdf/pdf';

/** Bonrolle 80 mm in Punkt (80 / 25,4 × 72). */
const ROLLE_PT = 226.77;

/**
 * Der Beleg als PDF. Wer ihn sieht, entscheidet die Datenbank (RLS); ein
 * fremder oder unbekannter Beleg gibt 404, ohne zu verraten, ob es ihn gibt.
 */
export async function GET(_anfrage: Request, { params }: { params: Promise<{ id: string }> }) {
  const beleg = await belegLaden((await params).id);
  if (!beleg) return new Response('Beleg nicht gefunden', { status: 404 });
  const pdf = pdfBauen({
    titel: `Beleg ${beleg.belegnummer}, ${beleg.apotheke}`,
    breitePt: ROLLE_PT,
    zeilen: belegZeilen(beleg),
  });
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="beleg-${beleg.belegnummer}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
