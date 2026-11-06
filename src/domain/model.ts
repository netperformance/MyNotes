import type { Doc } from './doc'

/**
 * Die Datenarten der App. Alle sind Datensätze mit Zeitstempel je Feld (siehe doc.ts),
 * damit eine spätere Synchronisation sie ohne Umbau abgleichen kann.
 */

export type Priority = 'low' | 'normal' | 'high'

/** Reihenfolge der Abschnitte auf der Startseite: Hoch steht oben. */
export const PRIORITY_SECTIONS: Priority[] = ['high', 'normal', 'low']

/** Reihenfolge der Auswahl im Fenster "Einordnen": Niedrig, Normal, Hoch. */
export const PRIORITY_CHOICES: Priority[] = ['low', 'normal', 'high']

export const isPriority = (v: unknown): v is Priority => v === 'low' || v === 'normal' || v === 'high'

/** Eine Notiz. */
export type NoteFields = {
  categoryId: string
  title: string
  /**
   * Text der Notiz als kleines HTML mit festem Wortschatz: <div>, <br>, <b>,
   * <span class="r"> für Rot, <ul>/<li> für Aufzählungen. Gespeichert wird nur "rot" oder
   * "normal", nicht der Farbwert, damit der Dunkelmodus eigene Töne zeigen kann.
   */
  body: string
  priority: Priority
  /** Platz innerhalb von Kategorie und Priorität. Kleiner steht weiter oben. */
  position: number
  /**
   * Platz innerhalb der Kategorie, wenn die Prioritäten ausgeschaltet sind. Ein eigenes Feld,
   * damit Priorität und Reihenfolge der Abschnitte beim Wiedereinschalten unverändert da sind.
   * Fehlt, solange die Notiz in dieser Ansicht nie verschoben wurde.
   */
  flatPosition?: number
  createdAt: number
  /** Letzte Änderung an Titel oder Text in ms. */
  editedAt: number
  deleted: boolean
}
export type Note = Doc<NoteFields>

/** Eine Kategorie mit Farbe. */
export type CategoryFields = {
  name: string
  /** Schlüssel aus der Farbpalette (siehe COLORS). */
  color: ColorKey
  /** Platz in der Reihenfolge der Kategorien. Kleiner steht weiter vorn. */
  position: number
  createdAt: number
  deleted: boolean
}
export type CategoryDoc = Doc<CategoryFields>

/**
 * Zwölf Farben, die in Hell und Dunkel gut lesbar sind.
 * Gespeichert wird der Schlüssel, damit sich ein Ton später anpassen lässt.
 */
export const COLORS = {
  red: '#e5484d',
  orange: '#ef6c1a',
  amber: '#e0a100',
  lime: '#5aa832',
  green: '#1f9d5c',
  teal: '#12a594',
  blue: '#2f6fe4',
  indigo: '#3e63dd',
  violet: '#8e4ec6',
  pink: '#d6409f',
  brown: '#978365',
  gray: '#8b8d98',
} as const
export type ColorKey = keyof typeof COLORS
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]
export const isColorKey = (v: unknown): v is ColorKey => typeof v === 'string' && v in COLORS

/** Die Kategorie, die die App beim ersten Start anlegt und neu anlegt, wenn keine mehr da ist. */
export const DEFAULT_CATEGORY_ID = 'allgemein'

/** Alle Sammlungen, die gespeichert und später synchronisiert werden. */
export type Collections = {
  notes: Note
  categories: CategoryDoc
}
export type CollectionName = keyof Collections
export const COLLECTIONS: CollectionName[] = ['notes', 'categories']
