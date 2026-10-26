import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';

// Atkinson Hyperlegible Next: unterscheidet 0/O und 1/l/I – wichtig, wo
// Menschen PZN lesen und abtippen. Variable Schrift, lokal ausgeliefert.
const schrift = localFont({
  src: [
    { path: './schriften/atkinson-hyperlegible-next-latin-wght-normal.woff2', weight: '200 800' },
    {
      path: './schriften/atkinson-hyperlegible-next-latin-ext-wght-normal.woff2',
      weight: '200 800',
    },
  ],
  variable: '--schrift',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Apotheken-Werkbank', template: '%s · Apotheken-Werkbank' },
  description:
    'Übungsprojekt: Bestellen über MSV3, Kasse und Kassen-Automatisierung mit erfundenen Daten.',
  robots: { index: false, follow: false },
};

export default async function Wurzel({ children }: { children: ReactNode }) {
  // Jede Seite dynamisch: Nur so bekommt Next die Nonce der CSP (proxy.ts).
  await headers();
  return (
    <html lang="de-DE" className={schrift.variable}>
      <body>{children}</body>
    </html>
  );
}
