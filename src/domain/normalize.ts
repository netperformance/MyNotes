/** Vereinfacht einen Text für Vergleiche: klein, ohne Akzente, ß als ss, einfache Leerzeichen. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Schreibt den ersten Buchstaben groß, so wie Produkte auf Listen meist stehen. */
export function capitalize(text: string): string {
  const t = text.trim()
  return t ? t.charAt(0).toLocaleUpperCase('de-DE') + t.slice(1) : t
}
