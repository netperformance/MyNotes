import { createDoc, mergeDocs, patchDoc, type Doc, type Fields } from '../domain/doc'
import { compareText, type Lang } from '../domain/lang'
import {
  COLLECTIONS,
  DEFAULT_CATEGORY_ID,
  isColorKey,
  isPriority,
  PRIORITY_SECTIONS,
  type CategoryDoc,
  type CollectionName,
  type Collections,
  type ColorKey,
  type Note,
  type NoteFields,
  type Priority,
} from '../domain/model'
import { normalize } from '../domain/normalize'
import { Clock, compareStamps, type Stamp } from '../domain/stamp'
import { htmlToText } from '../domain/text'
import type { Repository } from '../data/repository'

/** Ein Paket geänderter Datensätze. Dieselbe Form nutzen Sicherung und spätere Synchronisation. */
export type ChangeSet = { [K in CollectionName]: Collections[K][] }

export const emptyChangeSet = (): ChangeSet => ({ notes: [], categories: [] })

/** Eine Kategorie, so wie die Oberfläche sie zeigt. */
export interface CategoryInfo {
  id: string
  name: string
  color: ColorKey
  /** Anzahl der Notizen in dieser Kategorie. */
  count: number
}

/** Was die Oberfläche anzeigt. Wird bei jeder Änderung neu erzeugt (unveränderlich). */
export interface Snapshot {
  /** Kategorien in der eingestellten Reihenfolge. */
  categories: CategoryInfo[]
  /**
   * Alle Notizen, sortiert wie auf der Startseite: erst Priorität (Hoch, Normal, Niedrig),
   * dann Kategorie in ihrer Reihenfolge, dann der eigene Platz.
   */
  notes: Note[]
  /**
   * Dieselben Notizen für die Ansicht ohne Prioritäten: Kategorie in ihrer Reihenfolge,
   * dann der Platz in dieser Ansicht.
   */
  flatNotes: Note[]
  lang: Lang
}

/** Name der ersten Kategorie, solange der Nutzer sie nicht umbenennt. */
export const DEFAULT_CATEGORY_NAMES: Record<Lang, string> = { de: 'Allgemein', en: 'General' }

/** Fehler beim Einspielen einer Sicherung. Die Oberfläche zeigt die Meldung in der gewählten Sprache. */
export class BackupError extends Error {
  constructor(readonly code: 'not-a-backup' | 'damaged') {
    super(code === 'not-a-backup' ? 'Die Datei ist keine Sicherung dieser App.' : 'Die Sicherung ist beschädigt.')
    this.name = 'BackupError'
  }
}

export interface Backup extends ChangeSet {
  app: 'mynotes'
  format: 1
  exportedAt: string
}

export interface NewNote {
  categoryId: string
  priority?: Priority
  title?: string
  body?: string
}

type Listener = () => void
type ChangeListener = (changes: ChangeSet) => void

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

/**
 * Zentrale Datenhaltung der App.
 *
 * Jede Aktion der Oberfläche läuft über diese Klasse. Sie vergibt Zeitstempel, speichert
 * und meldet die geänderten Datensätze an `onLocalChange`. Dort setzt eine spätere
 * Synchronisation an. Fremde Änderungen kommen über `applyRemote` herein und werden mit
 * denselben Regeln zusammengeführt wie eine eingespielte Sicherung.
 */
export class NotesStore {
  private docs: { [K in CollectionName]: Map<string, Collections[K]> } = {
    notes: new Map(),
    categories: new Map(),
  }
  private listeners = new Set<Listener>()
  private changeListeners = new Set<ChangeListener>()
  private snapshot!: Snapshot
  private writes: Promise<void> = Promise.resolve()
  private textCache = new Map<string, { body: string; text: string }>()
  /** Platz jeder Notiz in der Ansicht ohne Prioritäten (gespeichert oder aus der Reihenfolge mit Prioritäten). */
  private flatKeys = new Map<string, number>()
  /** Die erste Kategorie wurde neu angelegt, weil die letzte gelöscht wurde. */
  private autoDefault = false

  private constructor(
    private readonly repo: Repository,
    private clock: Clock,
    private readonly clockNow: () => number = Date.now,
    private lang: Lang = 'de',
  ) {}

  static async open(repo: Repository, options: { now?: () => number; lang?: Lang } = {}): Promise<NotesStore> {
    let deviceId = await repo.getMeta<string>('deviceId')
    if (!deviceId) {
      deviceId = newId().replaceAll('-', '').slice(0, 12)
      await repo.setMeta('deviceId', deviceId)
    }
    const last = await repo.getMeta<Stamp>('clock')
    const store = new NotesStore(repo, new Clock(deviceId, last, options.now), options.now, options.lang)
    const data = await repo.loadAll()
    for (const name of COLLECTIONS) for (const doc of data[name]) store.map(name).set(doc.id, doc)
    store.ensureCategory()
    store.autoDefault = false
    store.rebuild()
    return store
  }

  // ---------- Lesen ----------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): Snapshot => this.snapshot

  get language(): Lang {
    return this.lang
  }

  /** Wechselt die Sprache. Nur der Name der ersten Kategorie ändert sich, solange er nicht selbst vergeben ist. */
  setLanguage(lang: Lang): void {
    if (lang === this.lang) return
    this.lang = lang
    this.rebuild()
    this.emit()
  }

  getNote(id: string): Note | undefined {
    return this.docs.notes.get(id)
  }

  /** Reiner Text einer Notiz (ohne Formatierung), für Vorschau und Suche. */
  textOf(note: Note): string {
    const cached = this.textCache.get(note.id)
    if (cached && cached.body === note.fields.body) return cached.text
    const text = htmlToText(note.fields.body)
    this.textCache.set(note.id, { body: note.fields.body, text })
    return text
  }

  /** Gibt es die Kategorie und ist sie nicht gelöscht? */
  hasCategory(id: string): boolean {
    const c = this.docs.categories.get(id)
    return !!c && !c.fields.deleted
  }

  /** Eine andere Kategorie mit demselben Namen (ohne Groß und Klein, Akzente). */
  findCategoryByName(name: string, exceptId?: string): CategoryInfo | undefined {
    const key = normalize(name)
    if (!key) return undefined
    return this.snapshot.categories.find((c) => c.id !== exceptId && normalize(c.name) === key)
  }

  /** Erste Kategorie in der Reihenfolge, z. B. für eine neue Notiz unter "Alle". */
  get firstCategoryId(): string {
    return this.snapshot.categories[0].id
  }

  // ---------- Notizen ----------

  /** Legt eine Notiz an. `top`: oben im Abschnitt einfügen, sonst unten. */
  createNote(input: NewNote, top: boolean): string {
    const categoryId = this.hasCategory(input.categoryId) ? input.categoryId : this.firstCategoryId
    const priority = input.priority ?? 'normal'
    const now = this.now()
    const fields: NoteFields = {
      categoryId,
      title: input.title ?? '',
      body: input.body ?? '',
      priority,
      position: this.slot(categoryId, priority, top),
      flatPosition: this.flatSlot(categoryId, top),
      createdAt: now,
      editedAt: now,
      deleted: false,
    }
    const note = createDoc(newId(), fields, this.clock.tick())
    this.commit({ ...emptyChangeSet(), notes: [note] })
    return note.id
  }

  /** Ändert Titel und Text. Das Änderungsdatum zählt nur bei echten Änderungen. */
  updateNote(id: string, patch: { title?: string; body?: string }): void {
    const note = this.docs.notes.get(id)
    if (!note) return
    const changed =
      (patch.title !== undefined && patch.title !== note.fields.title) ||
      (patch.body !== undefined && patch.body !== note.fields.body)
    if (!changed) return
    const next = patchDoc(note, { ...patch, editedAt: this.now() }, this.clock.tick())
    this.commit({ ...emptyChangeSet(), notes: [next] })
  }

  /** Ordnet eine Notiz einer anderen Kategorie zu. Sie kommt dort oben oder unten in ihren Abschnitt. */
  setCategory(id: string, categoryId: string, top: boolean): void {
    const note = this.docs.notes.get(id)
    if (!note || !this.hasCategory(categoryId) || note.fields.categoryId === categoryId) return
    this.move(note, { categoryId, position: this.slot(categoryId, note.fields.priority, top), flatPosition: this.flatSlot(categoryId, top) })
  }

  /** Ändert die Priorität. Die Notiz kommt oben oder unten in den neuen Abschnitt. */
  setPriority(id: string, priority: Priority, top: boolean): void {
    const note = this.docs.notes.get(id)
    if (!note || note.fields.priority === priority) return
    this.move(note, { priority, position: this.slot(note.fields.categoryId, priority, top) })
  }

  /**
   * Neue Reihenfolge eines Abschnitts nach dem Ziehen am Griff.
   * `ids` sind alle Notizen, die danach in diesem Abschnitt stehen, von oben nach unten.
   * Hineingezogene Notizen bekommen die Priorität des Abschnitts. Gehören die Notizen zu
   * mehreren Kategorien (Ansicht "Alle"), gilt die Reihenfolge je Kategorie, denn innerhalb
   * eines Abschnitts stehen die Kategorien immer in ihrer eingestellten Reihenfolge.
   */
  arrangeSection(priority: Priority, ids: string[]): void {
    const stamp = this.clock.tick()
    const changes = emptyChangeSet()
    const index = new Map<string, number>()
    for (const id of ids) {
      const note = this.docs.notes.get(id)
      if (!note || note.fields.deleted) continue
      const cat = note.fields.categoryId
      const position = index.get(cat) ?? 0
      index.set(cat, position + 1)
      const next = patchDoc(note, { priority, position }, stamp)
      if (next !== note) changes.notes.push(next)
    }
    this.commit(changes)
  }

  /**
   * Neue Reihenfolge nach dem Ziehen, wenn die Prioritäten ausgeschaltet sind. `ids` sind alle
   * angezeigten Notizen von oben nach unten. Die Priorität bleibt unverändert gespeichert.
   */
  arrangeFlat(ids: string[]): void {
    const stamp = this.clock.tick()
    const changes = emptyChangeSet()
    const index = new Map<string, number>()
    for (const id of ids) {
      const note = this.docs.notes.get(id)
      if (!note || note.fields.deleted) continue
      const cat = note.fields.categoryId
      const flatPosition = index.get(cat) ?? 0
      index.set(cat, flatPosition + 1)
      const next = patchDoc(note, { flatPosition }, stamp)
      if (next !== note) changes.notes.push(next)
    }
    this.commit(changes)
  }

  /** Löscht Notizen (nur als Markierung, daher mit "Rückgängig" umkehrbar). */
  removeNotes(ids: string[]): void {
    this.setDeleted(ids, true)
  }

  restoreNotes(ids: string[]): void {
    this.setDeleted(ids, false)
  }

  // ---------- Kategorien ----------

  /** Legt eine Kategorie an. Sie steht am Ende der Reihenfolge. */
  createCategory(name: string, color: ColorKey): string | null {
    const clean = name.trim()
    if (!clean || !isColorKey(color) || this.findCategoryByName(clean)) return null
    const last = Math.max(-1, ...this.activeCategories().map((c) => c.fields.position))
    const doc = createDoc<CategoryDoc['fields']>(
      newId(),
      { name: clean, color, position: last + 1, createdAt: this.now(), deleted: false },
      this.clock.tick(),
    )
    this.commit({ ...emptyChangeSet(), categories: [doc] })
    return doc.id
  }

  /** Ändert Name oder Farbe. Gibt false zurück, wenn der Name schon vergeben ist. */
  updateCategory(id: string, patch: { name?: string; color?: ColorKey }): boolean {
    const doc = this.docs.categories.get(id)
    if (!doc || doc.fields.deleted) return false
    const fields: Partial<CategoryDoc['fields']> = {}
    const name = patch.name?.trim()
    if (name) {
      if (this.findCategoryByName(name, id)) return false
      // Die erste Kategorie behält ihren übersetzbaren Namen, solange er nicht wirklich geändert wird.
      if (name !== this.displayName(doc)) fields.name = name
    }
    if (patch.color && isColorKey(patch.color)) fields.color = patch.color
    const next = patchDoc(doc, fields, this.clock.tick())
    if (next !== doc) this.commit({ ...emptyChangeSet(), categories: [next] })
    return true
  }

  /**
   * Löscht eine Kategorie mit allen ihren Notizen (nur als Markierung, daher mit "Rückgängig"
   * umkehrbar). Gibt die IDs der mitgelöschten Notizen zurück.
   * Ist danach keine Kategorie mehr übrig, legt die App die erste Kategorie wieder an.
   */
  deleteCategory(id: string): string[] | null {
    const doc = this.docs.categories.get(id)
    if (!doc || doc.fields.deleted) return null
    const stamp = this.clock.tick()
    const notes = this.activeNotes().filter((n) => n.fields.categoryId === id)
    this.commit({
      ...emptyChangeSet(),
      categories: [patchDoc(doc, { deleted: true }, stamp)],
      notes: notes.map((n) => patchDoc(n, { deleted: true }, stamp)),
    })
    return notes.map((n) => n.id)
  }

  /** Holt eine gelöschte Kategorie mit ihren Notizen zurück. */
  restoreCategory(id: string, noteIds: string[]): void {
    const doc = this.docs.categories.get(id)
    if (!doc) return
    const stamp = this.clock.tick()
    const notes = noteIds.map((n) => this.docs.notes.get(n)).filter((n): n is Note => !!n)
    const categories = [patchDoc(doc, { deleted: false }, stamp)]
    // Wurde "Allgemein" nur angelegt, weil die letzte Kategorie weg war, und ist noch leer:
    // mit dem Rückgängigmachen wieder entfernen.
    const fallback = this.docs.categories.get(DEFAULT_CATEGORY_ID)
    if (this.autoDefault && id !== DEFAULT_CATEGORY_ID && fallback && !fallback.fields.deleted && this.countInCategory(DEFAULT_CATEGORY_ID) === 0) {
      categories.push(patchDoc(fallback, { deleted: true }, stamp))
    }
    this.autoDefault = false
    this.commit({
      ...emptyChangeSet(),
      categories,
      notes: notes.map((n) => patchDoc(n, { deleted: false }, stamp)),
    })
  }

  /** Neue Reihenfolge der Kategorien (nach Ziehen am Griff in den Einstellungen). */
  setCategoryOrder(ids: string[]): void {
    const stamp = this.clock.tick()
    const changes = emptyChangeSet()
    const rest = this.activeCategories().filter((c) => !ids.includes(c.id))
    ;[...ids.map((id) => this.docs.categories.get(id)).filter((c): c is CategoryDoc => !!c && !c.fields.deleted), ...rest].forEach(
      (cat, i) => {
        const next = patchDoc(cat, { position: i }, stamp)
        if (next !== cat) changes.categories.push(next)
      },
    )
    this.commit(changes)
  }

  countInCategory(id: string): number {
    return this.snapshot.categories.find((c) => c.id === id)?.count ?? 0
  }

  // ---------- Sicherung ----------

  exportBackup(): Backup {
    return { app: 'mynotes', format: 1, exportedAt: new Date().toISOString(), ...this.allDocs() }
  }

  /** Spielt eine Sicherung ein. Vorhandene Daten bleiben erhalten, es wird zusammengeführt. */
  importBackup(data: unknown): number {
    const backup = data as Partial<Backup>
    if (!backup || backup.app !== 'mynotes' || backup.format !== 1) throw new BackupError('not-a-backup')
    const changes = emptyChangeSet()
    for (const name of COLLECTIONS) {
      const docs = (backup[name] ?? []) as Doc<Fields>[]
      if (!Array.isArray(docs) || docs.some((d) => typeof d?.id !== 'string' || !d.fields || !d.stamps || typeof d.updated !== 'string')) {
        throw new BackupError('damaged')
      }
      ;(changes[name] as Doc<Fields>[]) = docs
    }
    return this.applyRemote(changes)
  }

  /** Löscht alles auf diesem Gerät. Die unter `keepMeta` genannten Werte (Einstellungen) bleiben. */
  async reset(options: { keepMeta?: string[] } = {}): Promise<void> {
    await this.writes
    const kept: [string, unknown][] = []
    for (const key of options.keepMeta ?? []) {
      const value = await this.repo.getMeta(key)
      if (value !== undefined) kept.push([key, value])
    }
    await this.repo.clear()
    for (const [key, value] of kept) await this.repo.setMeta(key, value)
    for (const name of COLLECTIONS) this.map(name).clear()
    this.textCache.clear()
    await this.repo.setMeta('deviceId', this.clock.deviceId)
    this.ensureCategory()
    this.autoDefault = false
    this.rebuild()
    this.emit()
  }

  // ---------- Schnittstelle für eine spätere Synchronisation ----------

  onLocalChange(listener: ChangeListener): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  /** Übernimmt Datensätze von außen (anderes Gerät, Sicherung) und führt sie zusammen. */
  applyRemote(changes: ChangeSet): number {
    const merged = emptyChangeSet()
    for (const name of COLLECTIONS) {
      const map = this.map(name) as Map<string, Doc<Fields>>
      for (const incoming of changes[name] as Doc<Fields>[]) {
        this.clock.receive(incoming.updated)
        const current = map.get(incoming.id)
        const next = current ? mergeDocs(current, incoming) : incoming
        if (!current || JSON.stringify(next) !== JSON.stringify(current)) (merged[name] as Doc<Fields>[]).push(next)
      }
    }
    const count = COLLECTIONS.reduce((n, name) => n + merged[name].length, 0)
    if (count > 0) this.commit(merged, { remote: true })
    return count
  }

  changesSince(stamp: Stamp): ChangeSet {
    const out = emptyChangeSet()
    for (const name of COLLECTIONS) {
      for (const doc of this.map(name).values()) {
        if (compareStamps(doc.updated, stamp) > 0) (out[name] as Doc<Fields>[]).push(doc)
      }
    }
    return out
  }

  /** Wartet, bis alle Änderungen gespeichert sind. */
  flush(): Promise<void> {
    return this.writes
  }

  // ---------- Intern ----------

  private map<K extends CollectionName>(name: K): Map<string, Collections[K]> {
    return this.docs[name]
  }

  private now(): number {
    return this.clockNow()
  }

  private allDocs(): ChangeSet {
    return { notes: [...this.docs.notes.values()], categories: [...this.docs.categories.values()] }
  }

  private activeNotes(): Note[] {
    return [...this.docs.notes.values()].filter((n) => !n.fields.deleted)
  }

  private activeCategories(): CategoryDoc[] {
    return [...this.docs.categories.values()]
      .filter((c) => !c.fields.deleted)
      .sort((a, b) => a.fields.position - b.fields.position || a.fields.createdAt - b.fields.createdAt || a.id.localeCompare(b.id))
  }

  /** Platz für eine Notiz, die neu in einen Abschnitt kommt: vor die erste oder hinter die letzte. */
  private slot(categoryId: string, priority: Priority, top: boolean): number {
    const positions = this.activeNotes()
      .filter((n) => n.fields.categoryId === categoryId && n.fields.priority === priority)
      .map((n) => n.fields.position)
    if (positions.length === 0) return 0
    return top ? Math.min(...positions) - 1 : Math.max(...positions) + 1
  }

  /** Wie slot(), für die Ansicht ohne Prioritäten. */
  private flatSlot(categoryId: string, top: boolean): number {
    const keys = this.activeNotes()
      .filter((n) => n.fields.categoryId === categoryId)
      .map((n) => this.flatKeys.get(n.id) ?? n.fields.flatPosition ?? 0)
    if (keys.length === 0) return 0
    return top ? Math.min(...keys) - 1 : Math.max(...keys) + 1
  }

  private move(note: Note, patch: Partial<NoteFields>): void {
    const next = patchDoc(note, patch, this.clock.tick())
    if (next !== note) this.commit({ ...emptyChangeSet(), notes: [next] })
  }

  private setDeleted(ids: string[], deleted: boolean): void {
    if (ids.length === 0) return
    const stamp = this.clock.tick()
    const changes = emptyChangeSet()
    for (const id of ids) {
      const note = this.docs.notes.get(id)
      if (note) changes.notes.push(patchDoc(note, { deleted }, stamp))
    }
    this.commit(changes)
  }

  /** Sorgt dafür, dass es immer mindestens eine Kategorie gibt. */
  private ensureCategory(): void {
    if (this.activeCategories().length > 0) return
    const existing = this.docs.categories.get(DEFAULT_CATEGORY_ID)
    const stamp = this.clock.tick()
    const doc = existing
      ? patchDoc(existing, { deleted: false, position: 0 }, stamp)
      : createDoc<CategoryDoc['fields']>(
          DEFAULT_CATEGORY_ID,
          { name: DEFAULT_CATEGORY_NAMES[this.lang], color: 'blue', position: 0, createdAt: 0, deleted: false },
          stamp,
        )
    this.docs.categories.set(doc.id, doc)
    this.autoDefault = true
    this.persist({ ...emptyChangeSet(), categories: [doc] })
  }

  private commit(changes: ChangeSet, options: { remote?: boolean } = {}): void {
    let count = 0
    for (const name of COLLECTIONS) {
      const map = this.map(name) as Map<string, Doc<Fields>>
      for (const doc of changes[name] as Doc<Fields>[]) {
        map.set(doc.id, doc)
        count++
      }
    }
    if (count === 0) return
    this.persist(changes)
    // Gilt nur bis zur nächsten Änderung: "Rückgängig" muss direkt danach kommen.
    this.autoDefault = false
    this.ensureCategory()
    this.rebuild()
    this.emit()
    if (!options.remote) for (const l of this.changeListeners) l(changes)
  }

  private persist(changes: ChangeSet): void {
    const clock = this.clock.last()
    this.writes = this.writes
      .then(async () => {
        for (const name of COLLECTIONS) await this.repo.put(name, changes[name] as never)
        await this.repo.setMeta('clock', clock)
      })
      .catch((error) => {
        console.error('Speichern fehlgeschlagen', error)
      })
  }

  private rebuild(): void {
    const cats = this.activeCategories()
    const rank = new Map(cats.map((c, i) => [c.id, i]))
    const counts = new Map<string, number>()
    // Notizen einer Kategorie, die es nicht mehr gibt (z. B. nach einem Abgleich), zeigt die App
    // unter der ersten Kategorie, statt sie zu verstecken.
    const fallback = cats[0].id
    const notes = this.activeNotes().map((n) => (rank.has(n.fields.categoryId) ? n : { ...n, fields: { ...n.fields, categoryId: fallback } }))
    for (const n of notes) counts.set(n.fields.categoryId, (counts.get(n.fields.categoryId) ?? 0) + 1)
    const section = (p: Priority) => PRIORITY_SECTIONS.indexOf(isPriority(p) ? p : 'normal')
    const cmp = compareText(this.lang)
    notes.sort(
      (a, b) =>
        section(a.fields.priority) - section(b.fields.priority) ||
        (rank.get(a.fields.categoryId) ?? 0) - (rank.get(b.fields.categoryId) ?? 0) ||
        a.fields.position - b.fields.position ||
        b.fields.createdAt - a.fields.createdAt ||
        cmp(a.fields.title, b.fields.title),
    )
    // Ohne gespeicherten Platz gilt der Platz aus der Reihenfolge mit Prioritäten, je Kategorie gezählt.
    const counter = new Map<string, number>()
    const flatKeys = new Map<string, number>()
    for (const n of notes) {
      const i = counter.get(n.fields.categoryId) ?? 0
      counter.set(n.fields.categoryId, i + 1)
      flatKeys.set(n.id, typeof n.fields.flatPosition === 'number' ? n.fields.flatPosition : i)
    }
    this.flatKeys = flatKeys
    const flatNotes = [...notes].sort(
      (a, b) =>
        (rank.get(a.fields.categoryId) ?? 0) - (rank.get(b.fields.categoryId) ?? 0) ||
        flatKeys.get(a.id)! - flatKeys.get(b.id)! ||
        b.fields.createdAt - a.fields.createdAt,
    )
    this.snapshot = {
      flatNotes,
      categories: cats.map((c) => ({ id: c.id, name: this.displayName(c), color: isColorKey(c.fields.color) ? c.fields.color : 'gray', count: counts.get(c.id) ?? 0 })),
      notes,
      lang: this.lang,
    }
  }

  /** Die erste Kategorie heißt in der gewählten Sprache, solange der Nutzer ihr keinen eigenen Namen gibt. */
  private displayName(cat: CategoryDoc): string {
    const name = cat.fields.name
    const untouched = cat.id === DEFAULT_CATEGORY_ID && Object.values(DEFAULT_CATEGORY_NAMES).includes(name)
    return untouched ? DEFAULT_CATEGORY_NAMES[this.lang] : name
  }

  private emit(): void {
    for (const l of this.listeners) l()
  }
}
