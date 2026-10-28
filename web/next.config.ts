import type { NextConfig } from 'next';

/*
 * Weniger Angriffsfläche: kein «X-Powered-By», keine Bildoptimierung (es gibt
 * kein next/image; der Endpunkt /_next/image holte sonst fremde Bilder), keine
 * KI-Regeldateien vom Entwicklungsserver. Die Content Security Policy mit Nonce
 * setzt proxy.ts je Anfrage; hier stehen die festen Kopfzeilen.
 */
const SICHERHEIT = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Kein fremder Ursprung bettet Antworten ein, auch nicht den Beleg als PDF.
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Origin-Agent-Cluster', value: '?1' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), display-capture=()',
  },
];

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  agentRules: false,
  async headers() {
    return [{ source: '/:pfad*', headers: SICHERHEIT }];
  },
};

export default config;
