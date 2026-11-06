import { createContext, useContext } from 'react'
import type { Lang } from '../domain/lang'
import type { ColorKey, Priority } from '../domain/model'

/**
 * Alle Texte der Oberfläche auf Deutsch und Englisch. Die Komponenten holen sie mit `useT()`.
 * Texte mit Zahlen oder Namen sind Funktionen, damit Einzahl, Mehrzahl und Satzbau je Sprache stimmen.
 */
const de = {
  // Startseite
  defaultTitle: 'Notizen',
  all: 'Alle',
  noteCount: (n: number) => (n === 1 ? '1 Notiz' : `${n} Notizen`),
  search: 'Suchen',
  newNote: 'Neue Notiz',
  fontSmaller: 'Schrift verkleinern',
  fontLarger: 'Schrift vergrößern',
  fontSize: (percent: number) => `Schrift ${percent} %`,
  settings: 'Einstellungen',
  emptyTitle: 'Noch keine Notizen',
  emptyText: 'Tippe auf +, um die erste Notiz zu schreiben.',
  emptyCategory: 'In dieser Kategorie gibt es noch keine Notizen.',
  appBy: 'Eine App von',
  untitled: 'Ohne Titel',
  noteDeleted: (title: string) => `„${title}“ gelöscht`,
  undo: 'Rückgängig',
  noteHint: 'Tippen zum Öffnen, lange drücken zum Einordnen',
  moveNamed: (name: string) => `${name} verschieben`,
  filterNamed: (name: string) => `Nur ${name} zeigen`,
  delete: 'Löschen',

  // Priorität
  priority: { high: 'Hoch', normal: 'Normal', low: 'Niedrig' } as Record<Priority, string>,

  // Editor
  back: 'Zurück',
  titlePlaceholder: 'Titel',
  bodyPlaceholder: 'Notiz schreiben …',
  editedToday: (time: string) => `Geändert heute, ${time}`,
  editedOn: (date: string) => `Geändert ${date}`,
  bold: 'Fett',
  black: 'Schwarz',
  red: 'Rot',
  bullets: 'Aufzählung',
  undoEdit: 'Rückgängig',
  categoryButton: (name: string) => `Kategorie ${name}, ändern`,
  priorityButton: (name: string) => `Priorität ${name}, ändern`,

  // Einordnen
  category: 'KATEGORIE',
  priorityLabel: 'PRIORITÄT',
  deleteNote: 'Notiz löschen',
  close: 'Schließen',
  done: 'Fertig',

  // Suche
  searchPlaceholder: 'Suchen',
  noResults: 'Nichts gefunden',
  clearSearch: 'Suche löschen',
  today: 'heute',

  // Einstellungen
  language: 'SPRACHE',
  appearance: 'DARSTELLUNG',
  themeSystem: 'Automatisch',
  themeLight: 'Hell',
  themeDark: 'Dunkel',
  newEntries: 'ANORDNUNG NEUER EINTRÄGE',
  top: 'Oben',
  bottom: 'Unten',
  homeTitle: 'TITEL DER STARTSEITE',
  prioritiesLabel: 'PRIORITÄTEN',
  usePriorities: 'Prioritäten verwenden',
  categories: 'KATEGORIEN',
  newCategory: 'Neue Kategorie',
  data: 'DATEN',
  saveBackup: 'Sicherung speichern',
  importBackup: 'Sicherung laden',
  deleteAllData: 'Alle Daten löschen',
  appName: 'My Notes',
  about: 'Kein Konto, keine Cloud.\nDeine Daten bleiben auf diesem Handy.',
  madeBy: '© Aaron Kreis ·',
  openSource: 'Open Source unter MIT Lizenz',
  backToSettings: 'Zurück zu den Einstellungen',
  editCategory: 'Kategorie bearbeiten',
  editNamed: (name: string) => `${name} bearbeiten`,
  backupFileName: 'mynotes-sicherung',
  shareUnavailable: 'Teilen ist auf diesem Gerät nicht möglich.',
  backupFailed: (reason: string) => `Sicherung fehlgeschlagen: ${reason}`,
  backupImported: (n: number) => (n ? `Sicherung geladen (${n} ${n === 1 ? 'Änderung' : 'Änderungen'})` : 'Alles war schon auf dem Stand'),
  invalidBackup: 'Die Datei ist keine gültige Sicherung.',
  notABackup: 'Die Datei ist keine Sicherung dieser App.',
  damagedBackup: 'Die Sicherung ist beschädigt.',
  resetTitle: 'Alle Daten löschen?',
  resetText:
    'Alle Notizen und Kategorien werden auf diesem Handy gelöscht. Das lässt sich nicht rückgängig machen. Die Einstellungen bleiben, wie sie sind.',
  cancel: 'Abbrechen',
  deleteForever: 'Endgültig löschen',
  allDataDeleted: 'Alle Daten gelöscht',

  // Kategorie bearbeiten
  name: 'NAME',
  color: 'FARBE',
  preview: 'VORSCHAU',
  categoryPlaceholder: 'z. B. Arbeit',
  exists: (name: string) => `„${name}“ gibt es schon. Nicht gespeichert.`,
  existsHint: (name: string) => `Eine Kategorie „${name}“ gibt es schon.`,
  categoryCreated: (name: string) => `${name} angelegt`,
  createCategory: 'Kategorie anlegen',
  deleteCategory: 'Kategorie löschen',
  deleteCategoryTitle: (name: string) => `Kategorie „${name}“ löschen?`,
  deleteCategoryText: (n: number) =>
    n === 0 ? 'Die Kategorie enthält keine Notizen.' : n === 1 ? 'Die Kategorie wird mit 1 Notiz gelöscht.' : `Die Kategorie wird mit allen ${n} Notizen gelöscht.`,
  categoryDeleted: (name: string, n: number) => (n === 0 ? `${name} gelöscht` : `${name} mit ${n === 1 ? '1 Notiz' : `${n} Notizen`} gelöscht`),
  previewTitle: 'Beispiel',
  previewText: 'So sieht eine Notiz in dieser Kategorie aus.',
  colors: {
    red: 'Rot',
    orange: 'Orange',
    amber: 'Gelb',
    lime: 'Hellgrün',
    green: 'Grün',
    teal: 'Türkis',
    blue: 'Blau',
    indigo: 'Indigo',
    violet: 'Violett',
    pink: 'Pink',
    brown: 'Braun',
    gray: 'Grau',
  } as Record<ColorKey, string>,
}

export type Strings = typeof de

const en: Strings = {
  defaultTitle: 'Notes',
  all: 'All',
  noteCount: (n) => (n === 1 ? '1 note' : `${n} notes`),
  search: 'Search',
  newNote: 'New note',
  fontSmaller: 'Smaller text',
  fontLarger: 'Larger text',
  fontSize: (percent) => `Text ${percent} %`,
  settings: 'Settings',
  emptyTitle: 'No notes yet',
  emptyText: 'Tap + to write your first note.',
  emptyCategory: 'There are no notes in this category yet.',
  appBy: 'An app by',
  untitled: 'Untitled',
  noteDeleted: (title) => `"${title}" deleted`,
  undo: 'Undo',
  noteHint: 'Tap to open, long press to organize',
  moveNamed: (name) => `Move ${name}`,
  filterNamed: (name) => `Show only ${name}`,
  delete: 'Delete',

  priority: { high: 'High', normal: 'Normal', low: 'Low' },

  back: 'Back',
  titlePlaceholder: 'Title',
  bodyPlaceholder: 'Write a note …',
  editedToday: (time) => `Edited today, ${time}`,
  editedOn: (date) => `Edited ${date}`,
  bold: 'Bold',
  black: 'Black',
  red: 'Red',
  bullets: 'Bullet list',
  undoEdit: 'Undo',
  categoryButton: (name) => `Category ${name}, change`,
  priorityButton: (name) => `Priority ${name}, change`,

  category: 'CATEGORY',
  priorityLabel: 'PRIORITY',
  deleteNote: 'Delete note',
  close: 'Close',
  done: 'Done',

  searchPlaceholder: 'Search',
  noResults: 'Nothing found',
  clearSearch: 'Clear search',
  today: 'today',

  language: 'LANGUAGE',
  appearance: 'APPEARANCE',
  themeSystem: 'Automatic',
  themeLight: 'Light',
  themeDark: 'Dark',
  newEntries: 'POSITION OF NEW NOTES',
  top: 'Top',
  bottom: 'Bottom',
  homeTitle: 'TITLE OF THE HOME SCREEN',
  prioritiesLabel: 'PRIORITIES',
  usePriorities: 'Use priorities',
  categories: 'CATEGORIES',
  newCategory: 'New category',
  data: 'DATA',
  saveBackup: 'Save backup',
  importBackup: 'Restore backup',
  deleteAllData: 'Delete all data',
  appName: 'My Notes',
  about: 'No account, no cloud.\nYour data stays on this phone.',
  madeBy: 'Made by Aaron Kreis ·',
  openSource: 'Open source under the MIT license',
  backToSettings: 'Back to settings',
  editCategory: 'Edit category',
  editNamed: (name) => `Edit ${name}`,
  backupFileName: 'mynotes-backup',
  shareUnavailable: 'Sharing is not available on this device.',
  backupFailed: (reason) => `Backup failed: ${reason}`,
  backupImported: (n) => (n ? `Backup restored (${n} ${n === 1 ? 'change' : 'changes'})` : 'Everything was already up to date'),
  invalidBackup: 'The file is not a valid backup.',
  notABackup: 'The file is not a backup of this app.',
  damagedBackup: 'The backup is damaged.',
  resetTitle: 'Delete all data?',
  resetText: 'All notes and categories will be deleted from this phone. This cannot be undone. Your settings stay as they are.',
  cancel: 'Cancel',
  deleteForever: 'Delete forever',
  allDataDeleted: 'All data deleted',

  name: 'NAME',
  color: 'COLOR',
  preview: 'PREVIEW',
  categoryPlaceholder: 'e.g. Work',
  exists: (name) => `"${name}" already exists. Not saved.`,
  existsHint: (name) => `A category "${name}" already exists.`,
  categoryCreated: (name) => `${name} created`,
  createCategory: 'Create category',
  deleteCategory: 'Delete category',
  deleteCategoryTitle: (name) => `Delete category "${name}"?`,
  deleteCategoryText: (n) =>
    n === 0 ? 'The category contains no notes.' : n === 1 ? 'The category will be deleted with its 1 note.' : `The category will be deleted with all ${n} notes.`,
  categoryDeleted: (name, n) => (n === 0 ? `${name} deleted` : `${name} deleted with ${n === 1 ? '1 note' : `${n} notes`}`),
  previewTitle: 'Example',
  previewText: 'This is how a note in this category looks.',
  colors: {
    red: 'Red',
    orange: 'Orange',
    amber: 'Yellow',
    lime: 'Light green',
    green: 'Green',
    teal: 'Teal',
    blue: 'Blue',
    indigo: 'Indigo',
    violet: 'Violet',
    pink: 'Pink',
    brown: 'Brown',
    gray: 'Gray',
  },
}

export const STRINGS: Record<Lang, Strings> = { de, en }

/** Die Texte der gewählten Sprache. Wird in App.tsx gesetzt. */
export const LanguageContext = createContext<Strings>(de)

export const useT = (): Strings => useContext(LanguageContext)

/** Die gewählte Sprache selbst, z. B. für Datumsangaben und den Hinweis an die Tastatur. */
export const LangContext = createContext<Lang>('de')
export const useLang = (): Lang => useContext(LangContext)

/** Sprache mit Land, so wie Android und Datumsformate sie erwarten. */
export const LOCALES: Record<Lang, string> = { de: 'de-DE', en: 'en-US' }
