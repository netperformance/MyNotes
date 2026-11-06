/**
 * Umgang mit dem Text einer Notiz außerhalb des Editors: reiner Text für Vorschau und Suche,
 * Treffer der Suche mit Stelle im Original.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/**
 * Macht aus dem gespeicherten HTML reinen Text. Zeilen bleiben als Zeilenumbruch erhalten,
 * Aufzählungspunkte als "• ".
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|p|li|ul|ol)>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** Vorschau in der Liste: alles in einer Zeile, die Liste kürzt auf zwei Zeilen. */
export function previewText(html: string): string {
  return htmlToText(html).replace(/\n• /g, ', ').replace(/^• /, '').replace(/\n/g, ' ').trim()
}

/** Vereinfacht ein einzelnes Zeichen wie normalize() es für ganze Texte tut. */
function foldChar(ch: string): string {
  return ch.toLowerCase().replace('ß', 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Text ohne Groß und Klein, Akzente und Umlautpunkte, mit Zuordnung jeder Stelle
 * zur Stelle im Original. So findet "muller" auch "Müller" und markiert das richtige Wort.
 */
function fold(text: string): { folded: string; map: number[] } {
  let folded = ''
  const map: number[] = []
  let i = 0
  for (const ch of text) {
    const f = foldChar(ch)
    for (let k = 0; k < f.length; k++) map.push(i)
    folded += f
    i += ch.length
  }
  map.push(i)
  return { folded, map }
}

/** Sucht so, dass ä auch als ae geschrieben gefunden wird ("mueller" findet "Müller"). */
function foldQuery(query: string): string[] {
  const base = fold(query.trim().replace(/\s+/g, ' ')).folded
  if (!base) return []
  const alt = base.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
  return alt !== base ? [base, alt] : [base]
}

export type Range = [start: number, end: number]

/** Alle Fundstellen der Suche im Text, als Bereiche im Original. */
export function findMatches(text: string, query: string): Range[] {
  const variants = foldQuery(query)
  if (variants.length === 0) return []
  const { folded, map } = fold(text)
  const ranges: Range[] = []
  for (const q of variants) {
    let from = 0
    while (true) {
      const at = folded.indexOf(q, from)
      if (at < 0) break
      ranges.push([map[at], map[at + q.length]])
      from = at + q.length
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const merged: Range[] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

export const matches = (text: string, query: string): boolean => findMatches(text, query).length > 0

/**
 * Ausschnitt um die erste Fundstelle, mit "…" an gekürzten Enden.
 * Gibt den Ausschnitt und die Fundstellen darin zurück.
 */
export function snippet(text: string, query: string, before = 30, length = 110): { text: string; ranges: Range[] } {
  const flat = text.replace(/\s*\n\s*/g, ' ')
  const all = findMatches(flat, query)
  if (all.length === 0) return { text: flat.slice(0, length), ranges: [] }
  let start = Math.max(0, all[0][0] - before)
  // nicht mitten im Wort beginnen
  if (start > 0) {
    const space = flat.lastIndexOf(' ', start)
    start = space >= 0 && all[0][0] - space < before + 15 ? space + 1 : start
  }
  const end = Math.min(flat.length, start + length)
  const prefix = start > 0 ? '… ' : ''
  const suffix = end < flat.length ? ' …' : ''
  const shift = prefix.length - start
  const ranges = all
    .filter(([s, e]) => s < end && e > start)
    .map(([s, e]) => [Math.max(s, start) + shift, Math.min(e, end) + shift] as Range)
  return { text: prefix + flat.slice(start, end) + suffix, ranges }
}
