import { type Kasten, type Masse, lageBerechnen, rollweg } from './lage';

/** Die Seite unter dem Rundgang: rollen und messen, die Rechnung steht in lage.ts. */

function kasten(element: Element): Kasten {
  const r = element.getBoundingClientRect();
  return { oben: r.top, links: r.left, breite: r.width, hoehe: r.height };
}

function fenster(): Masse {
  const wurzel = document.documentElement;
  return { breite: wurzel.clientWidth, hoehe: wurzel.clientHeight };
}

/**
 * Steht das Element am Ende einer kurzen Seite, rollt sie nicht weit genug, und die Karte
 * deckte es zu. Dann entsteht unter der Seite so viel Platz, wie fehlt: nach dem letzten
 * Element, darum bewegt sich nichts Sichtbares. Er wächst nur und verschwindet mit dem Rundgang.
 */
function platzSchaffen(weg: number): void {
  const wurzel = document.documentElement;
  const fehlt = window.scrollY + weg - (wurzel.scrollHeight - wurzel.clientHeight);
  if (fehlt <= 0) return;
  const bisher = parseFloat(document.body.style.paddingBottom) || 0;
  document.body.style.paddingBottom = `${Math.ceil(bisher + fehlt)}px`;
}

/** Nach dem Rundgang: den Platz unter der Seite wieder entfernen. */
export function platzFreigeben(): void {
  document.body.style.removeProperty('padding-bottom');
}

/** Rollt das erklärte Element so ins Fenster, dass die Karte daneben Platz hat. */
export function zielZeigen(karte: HTMLDialogElement, ziel: HTMLElement): void {
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weg = rollweg(kasten(ziel), kasten(karte), fenster());
  if (weg > 0) platzSchaffen(weg);
  window.scrollBy({ top: weg, behavior: ruhig ? 'auto' : 'smooth' });
}

/**
 * Stellt die Karte zum Element. Lage und Zeiger gehen als CSS-Variablen an den Dialog
 * (rundgang.module.css); über das CSSOM gesetzt, darum ohne style-Attribut und CSP-fest.
 */
export function kartePlatzieren(karte: HTMLDialogElement, ziel: HTMLElement | null): void {
  const lage = lageBerechnen(ziel ? kasten(ziel) : null, kasten(karte), fenster());
  karte.style.setProperty('--rundgang-oben', `${Math.round(lage.oben)}px`);
  karte.style.setProperty('--rundgang-links', `${Math.round(lage.links)}px`);
  karte.style.setProperty('--rundgang-zeiger', `${Math.round(lage.zeiger)}px`);
  karte.dataset.lage = lage.art;
}
