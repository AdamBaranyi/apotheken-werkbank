/**
 * Pharmazentralnummer (PZN) mit acht Stellen: sieben Ziffern und eine
 * Prüfziffer. Die Prüfziffer ist die Summe der ersten sieben Ziffern, je mit
 * ihrer Stelle (1 bis 7) gewichtet, modulo 11. Ergibt sich 10, wird die
 * Nummer nicht vergeben.
 */
export function pruefzifferBerechnen(siebenStellen: string): number | null {
  if (!/^[0-9]{7}$/.test(siebenStellen)) return null;
  let summe = 0;
  for (let i = 0; i < 7; i++) summe += Number(siebenStellen[i]) * (i + 1);
  const rest = summe % 11;
  return rest === 10 ? null : rest;
}

export function istGueltigePzn(pzn: string): boolean {
  if (!/^[0-9]{8}$/.test(pzn)) return false;
  return pruefzifferBerechnen(pzn.slice(0, 7)) === Number(pzn[7]);
}
