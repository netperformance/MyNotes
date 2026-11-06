import type { Repository } from '../data/repository'
import { isLang, type Lang } from '../domain/lang'
import type { ThemeMode } from './theme'

/**
 * Einstellungen, die nur dieses Handy betreffen. Sie liegen in der Datenbank des Handys
 * (Tabelle meta) und werden nicht synchronisiert. Beim Start liest die App sie, bevor sie
 * etwas anzeigt, damit sie gleich in der gewählten Darstellung erscheint.
 */
export interface Prefs {
  theme: ThemeMode
  /** Sprache der Oberfläche und Hinweis für die Tastatur. */
  language: Lang
  /** Neue Notizen oben in ihren Abschnitt einfügen (sonst unten). */
  newOnTop: boolean
  /** Prioritäten verwenden. Aus: keine Abschnitte, keine Auswahl, die gespeicherten Prioritäten bleiben. */
  priorities: boolean
  /** Eigener Titel der Startseite. Leer: "Notizen" oder "Notes" je nach Sprache. */
  homeTitle: string
  /** Stufe der Schriftgröße, Index in FONT_STEPS. */
  fontStep: number
  /** Gewählter Filter auf der Startseite: "all" oder die ID einer Kategorie. */
  filter: string
}

/** Schriftgrößen der App, zusätzlich zur Einstellung von Android. */
export const FONT_STEPS = [0.85, 1, 1.15, 1.3, 1.5]
export const DEFAULT_FONT_STEP = 1

/**
 * Ohne gespeicherte Wahl startet die App hell, auch wenn das Handy dunkel eingestellt ist.
 * Die Sprache folgt ohne gespeicherte Wahl dem Handy: App.tsx gibt sie an loadPrefs.
 */
export const DEFAULT_PREFS: Prefs = { theme: 'light', language: 'de', newOnTop: true, priorities: true, homeTitle: '', fontStep: DEFAULT_FONT_STEP, filter: 'all' }

const key = (name: keyof Prefs) => `pref:${name}`

/** Diese Werte bleiben auch bei "Alle Daten löschen" erhalten. */
export const PREF_KEYS = (Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]).map(key)

export async function loadPrefs(repo: Repository, deviceLanguage: Lang = DEFAULT_PREFS.language): Promise<Prefs> {
  const prefs = { ...DEFAULT_PREFS, language: deviceLanguage }
  try {
    const theme = await repo.getMeta<ThemeMode>(key('theme'))
    if (theme === 'system' || theme === 'light' || theme === 'dark') prefs.theme = theme
    const language = await repo.getMeta<Lang>(key('language'))
    if (isLang(language)) prefs.language = language
    const newOnTop = await repo.getMeta<boolean>(key('newOnTop'))
    if (typeof newOnTop === 'boolean') prefs.newOnTop = newOnTop
    const priorities = await repo.getMeta<boolean>(key('priorities'))
    if (typeof priorities === 'boolean') prefs.priorities = priorities
    const homeTitle = await repo.getMeta<string>(key('homeTitle'))
    if (typeof homeTitle === 'string') prefs.homeTitle = homeTitle
    const fontStep = await repo.getMeta<number>(key('fontStep'))
    if (typeof fontStep === 'number' && fontStep >= 0 && fontStep < FONT_STEPS.length) prefs.fontStep = Math.round(fontStep)
    const filter = await repo.getMeta<string>(key('filter'))
    if (typeof filter === 'string' && filter) prefs.filter = filter
  } catch (error) {
    console.error('Einstellungen nicht lesbar', error)
  }
  return prefs
}

export function savePref<K extends keyof Prefs>(repo: Repository, name: K, value: Prefs[K]): Promise<void> {
  return repo.setMeta(key(name), value).catch((error) => console.error('Einstellung nicht gespeichert', error))
}
