import { compareStamps, maxStamp, type Stamp } from './stamp'

/**
 * Ein Datensatz, dessen Felder einzeln mit Zeitstempeln versehen sind.
 *
 * Alle gespeicherten Daten der App (Einträge, gelernte Produkte, Einstellungen der Liste)
 * haben diese Form. Dadurch lassen sich Stände von zwei Geräten später Feld für Feld
 * zusammenführen: Ändert Handy A die Menge und Handy B gleichzeitig die Notiz, bleiben
 * beide Änderungen erhalten. Ändern beide dasselbe Feld, gewinnt die spätere Änderung.
 *
 * Gelöscht wird nie wirklich, sondern über das Feld `deleted`. Sonst würde ein Gerät,
 * das die Löschung noch nicht kennt, den Eintrag beim Abgleich wieder herstellen.
 */
export type Fields = Record<string, unknown> & { deleted: boolean }

export type Stamps<F extends Fields> = { [K in keyof F]: Stamp }

export interface Doc<F extends Fields> {
  id: string
  fields: F
  stamps: Stamps<F>
  /** Größter Zeitstempel aller Felder. Ein Abgleich kann damit "alles seit X" abfragen. */
  updated: Stamp
}

export function createDoc<F extends Fields>(id: string, fields: F, stamp: Stamp): Doc<F> {
  const stamps = {} as Stamps<F>
  for (const key of Object.keys(fields) as (keyof F)[]) stamps[key] = stamp
  return { id, fields: { ...fields }, stamps, updated: stamp }
}

/** Ändert einzelne Felder. Felder ohne echte Änderung behalten ihren alten Zeitstempel. */
export function patchDoc<F extends Fields>(doc: Doc<F>, patch: Partial<F>, stamp: Stamp): Doc<F> {
  let changed = false
  const fields = { ...doc.fields }
  const stamps = { ...doc.stamps }
  for (const key of Object.keys(patch) as (keyof F)[]) {
    const value = patch[key] as F[keyof F]
    if (sameValue(fields[key], value)) continue
    fields[key] = value
    stamps[key] = stamp
    changed = true
  }
  if (!changed) return doc
  return { id: doc.id, fields, stamps, updated: maxStamp(doc.updated, stamp) }
}

/** Führt zwei Stände desselben Datensatzes zusammen. Reihenfolge der Argumente ist egal. */
export function mergeDocs<F extends Fields>(a: Doc<F>, b: Doc<F>): Doc<F> {
  if (a.id !== b.id) throw new Error(`Unterschiedliche Datensätze: ${a.id} und ${b.id}`)
  const fields = { ...a.fields }
  const stamps = { ...a.stamps }
  const keys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)]) as Set<keyof F>
  for (const key of keys) {
    const sa = a.stamps[key]
    const sb = b.stamps[key]
    if (sb !== undefined && (sa === undefined || compareStamps(sb, sa) > 0)) {
      fields[key] = b.fields[key]
      stamps[key] = sb
    }
  }
  return { id: a.id, fields, stamps, updated: maxStamp(a.updated, b.updated) }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i])
  return a === b
}
