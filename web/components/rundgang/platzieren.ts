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

/** Rollt das erklärte Element so ins Fenster, dass die Karte daneben Platz hat. */
export function zielZeigen(karte: HTMLDialogElement, ziel: HTMLElement): void {
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollBy({
    top: rollweg(kasten(ziel), kasten(karte), fenster()),
    behavior: ruhig ? 'auto' : 'smooth',
  });
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
