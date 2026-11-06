import { describe, expect, it } from 'vitest'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/repository'
import { SqliteRepository } from '../data/sqlite'
import { nodeSqlite } from '../data/sqlite.node-test'
import { DEFAULT_CATEGORY_ID } from '../domain/model'
import { BackupError, DEFAULT_CATEGORY_NAMES, NotesStore } from './store'

let t = 1_000_000
const now = () => (t += 1000)
const open = (repo: Repository = new MemoryRepository(), lang: 'de' | 'en' = 'de') => NotesStore.open(repo, { now, lang })
const titles = (s: NotesStore, filter?: (n: ReturnType<NotesStore['getSnapshot']>['notes'][number]) => boolean) =>
  s.getSnapshot().notes.filter(filter ?? (() => true)).map((n) => n.fields.title)

describe('Start', () => {
  it('legt beim ersten Start die Kategorie "Allgemein" an', async () => {
    const s = await open()
    expect(s.getSnapshot().categories).toEqual([{ id: DEFAULT_CATEGORY_ID, name: 'Allgemein', color: 'blue', count: 0 }])
  })

  it('übersetzt den Namen der ersten Kategorie, solange er nicht geändert wurde', async () => {
    const s = await open()
    s.setLanguage('en')
    expect(s.getSnapshot().categories[0].name).toBe(DEFAULT_CATEGORY_NAMES.en)
    s.updateCategory(DEFAULT_CATEGORY_ID, { name: 'Arbeit' })
    s.setLanguage('de')
    expect(s.getSnapshot().categories[0].name).toBe('Arbeit')
  })
})

describe('Notizen', () => {
  it('neue Notizen starten mit Normal und kommen oben oder unten in ihren Abschnitt', async () => {
    const s = await open()
    const cat = s.firstCategoryId
    s.createNote({ categoryId: cat, title: 'A' }, true)
    s.createNote({ categoryId: cat, title: 'B' }, true)
    s.createNote({ categoryId: cat, title: 'C' }, false)
    expect(titles(s)).toEqual(['B', 'A', 'C'])
    expect(s.getSnapshot().notes.every((n) => n.fields.priority === 'normal')).toBe(true)
  })

  it('sortiert nach Priorität: Hoch, Normal, Niedrig', async () => {
    const s = await open()
    const cat = s.firstCategoryId
    s.createNote({ categoryId: cat, title: 'niedrig', priority: 'low' }, true)
    s.createNote({ categoryId: cat, title: 'normal' }, true)
    s.createNote({ categoryId: cat, title: 'hoch', priority: 'high' }, true)
    expect(titles(s)).toEqual(['hoch', 'normal', 'niedrig'])
  })

  it('Priorität ändern verschiebt die Notiz oben oder unten in den neuen Abschnitt', async () => {
    const s = await open()
    const cat = s.firstCategoryId
    s.createNote({ categoryId: cat, title: 'H1', priority: 'high' }, false)
    s.createNote({ categoryId: cat, title: 'H2', priority: 'high' }, false)
    const id = s.createNote({ categoryId: cat, title: 'X' }, true)
    s.setPriority(id, 'high', true)
    expect(titles(s)).toEqual(['X', 'H1', 'H2'])
    s.setPriority(id, 'normal', false)
    s.setPriority(id, 'high', false)
    expect(titles(s)).toEqual(['H1', 'H2', 'X'])
  })

  it('unter "Alle" stehen die Kategorien innerhalb eines Abschnitts in ihrer Reihenfolge', async () => {
    const s = await open()
    const arbeit = s.firstCategoryId
    const privat = s.createCategory('Privat', 'green')!
    s.createNote({ categoryId: privat, title: 'P1', priority: 'high' }, false)
    s.createNote({ categoryId: arbeit, title: 'A1', priority: 'high' }, false)
    s.createNote({ categoryId: arbeit, title: 'A2' }, false)
    expect(titles(s)).toEqual(['A1', 'P1', 'A2'])
    s.setCategoryOrder([privat, arbeit])
    expect(titles(s)).toEqual(['P1', 'A1', 'A2'])
  })

  it('Ziehen in einen anderen Abschnitt ändert Priorität und Reihenfolge', async () => {
    const s = await open()
    const cat = s.firstCategoryId
    const h = s.createNote({ categoryId: cat, title: 'H', priority: 'high' }, false)
    const a = s.createNote({ categoryId: cat, title: 'A' }, false)
    const b = s.createNote({ categoryId: cat, title: 'B' }, false)
    s.arrangeSection('high', [b, h])
    expect(titles(s)).toEqual(['B', 'H', 'A'])
    expect(s.getNote(b)!.fields.priority).toBe('high')
    s.arrangeSection('normal', [b, a])
    expect(titles(s)).toEqual(['H', 'B', 'A'])
  })

  it('beim Ziehen unter "Alle" bleibt jede Notiz in ihrer Kategorie', async () => {
    const s = await open()
    const arbeit = s.firstCategoryId
    const privat = s.createCategory('Privat', 'green')!
    const a1 = s.createNote({ categoryId: arbeit, title: 'A1' }, false)
    const a2 = s.createNote({ categoryId: arbeit, title: 'A2' }, false)
    const p1 = s.createNote({ categoryId: privat, title: 'P1' }, false)
    // A1 wurde zwischen die Notizen von Privat gezogen
    s.arrangeSection('normal', [a2, p1, a1])
    expect(titles(s)).toEqual(['A2', 'A1', 'P1'])
  })

  it('ändert das Datum nur bei echten Änderungen', async () => {
    const s = await open()
    const id = s.createNote({ categoryId: s.firstCategoryId, title: 'A' }, true)
    const before = s.getNote(id)!.fields.editedAt
    s.updateNote(id, { title: 'A' })
    expect(s.getNote(id)!.fields.editedAt).toBe(before)
    s.updateNote(id, { body: '<div>neu</div>' })
    expect(s.getNote(id)!.fields.editedAt).toBeGreaterThan(before)
    expect(s.textOf(s.getNote(id)!)).toBe('neu')
  })

  it('löschen und rückgängig', async () => {
    const s = await open()
    const id = s.createNote({ categoryId: s.firstCategoryId, title: 'A' }, true)
    s.removeNotes([id])
    expect(titles(s)).toEqual([])
    s.restoreNotes([id])
    expect(titles(s)).toEqual(['A'])
  })

  it('Kategorie wechseln', async () => {
    const s = await open()
    const privat = s.createCategory('Privat', 'green')!
    const id = s.createNote({ categoryId: s.firstCategoryId, title: 'A' }, true)
    s.setCategory(id, privat, true)
    expect(s.getNote(id)!.fields.categoryId).toBe(privat)
    expect(s.getSnapshot().categories.map((c) => c.count)).toEqual([0, 1])
  })
})

describe('Ohne Prioritäten', () => {
  it('übernimmt zuerst die Reihenfolge mit Prioritäten', async () => {
    const s = await open()
    const cat = s.firstCategoryId
    s.createNote({ categoryId: cat, title: 'N' }, false)
    s.createNote({ categoryId: cat, title: 'H', priority: 'high' }, false)
    s.createNote({ categoryId: cat, title: 'L', priority: 'low' }, false)
    expect(s.getSnapshot().flatNotes.map((n) => n.fields.title)).toEqual(['N', 'H', 'L'])
  })

  it('Verschieben ohne Prioritäten ändert weder Priorität noch die Reihenfolge mit Prioritäten', async () => {
    const s = await open()
    const cat = s.firstCategoryId
    const h = s.createNote({ categoryId: cat, title: 'H', priority: 'high' }, false)
    const n1 = s.createNote({ categoryId: cat, title: 'N1' }, false)
    const n2 = s.createNote({ categoryId: cat, title: 'N2' }, false)
    s.arrangeFlat([n2, n1, h])
    expect(s.getSnapshot().flatNotes.map((n) => n.fields.title)).toEqual(['N2', 'N1', 'H'])
    expect(titles(s)).toEqual(['H', 'N1', 'N2'])
    expect(s.getNote(h)!.fields.priority).toBe('high')
  })

  it('neue Notizen kommen auch in der Ansicht ohne Prioritäten oben oder unten hin', async () => {
    const s = await open()
    const cat = s.firstCategoryId
    const a = s.createNote({ categoryId: cat, title: 'A' }, false)
    const b = s.createNote({ categoryId: cat, title: 'B', priority: 'high' }, false)
    s.arrangeFlat([a, b])
    s.createNote({ categoryId: cat, title: 'oben' }, true)
    s.createNote({ categoryId: cat, title: 'unten' }, false)
    expect(s.getSnapshot().flatNotes.map((n) => n.fields.title)).toEqual(['oben', 'A', 'B', 'unten'])
  })
})

describe('Kategorien', () => {
  it('lehnt doppelte Namen ab, auch mit anderer Schreibweise', async () => {
    const s = await open()
    expect(s.createCategory('Privat', 'green')).toBeTruthy()
    expect(s.createCategory(' privat ', 'red')).toBeNull()
    expect(s.updateCategory(s.firstCategoryId, { name: 'PRIVAT' })).toBe(false)
  })

  it('löscht eine Kategorie mit allen Notizen und holt beides zurück', async () => {
    const s = await open()
    const privat = s.createCategory('Privat', 'green')!
    s.createNote({ categoryId: privat, title: 'P1' }, true)
    s.createNote({ categoryId: privat, title: 'P2' }, true)
    s.createNote({ categoryId: s.firstCategoryId, title: 'A' }, true)
    const ids = s.deleteCategory(privat)!
    expect(ids).toHaveLength(2)
    expect(titles(s)).toEqual(['A'])
    s.restoreCategory(privat, ids)
    expect(titles(s).sort()).toEqual(['A', 'P1', 'P2'])
  })

  it('legt "Allgemein" wieder an, wenn die letzte Kategorie gelöscht wird', async () => {
    const s = await open()
    const only = s.firstCategoryId
    s.updateCategory(only, { name: 'Arbeit', color: 'red' })
    s.deleteCategory(only)
    const cats = s.getSnapshot().categories
    expect(cats).toHaveLength(1)
    expect(cats[0].id).toBe(DEFAULT_CATEGORY_ID)
  })

  it('Rückgängig nach dem Löschen der letzten Kategorie entfernt das leere "Allgemein" wieder', async () => {
    const s = await open()
    const arbeit = s.createCategory('Arbeit', 'red')!
    s.deleteCategory(DEFAULT_CATEGORY_ID)
    s.createNote({ categoryId: arbeit, title: 'A' }, true)
    const ids = s.deleteCategory(arbeit)!
    expect(s.getSnapshot().categories.map((c) => c.id)).toEqual([DEFAULT_CATEGORY_ID])
    s.restoreCategory(arbeit, ids)
    expect(s.getSnapshot().categories.map((c) => c.name)).toEqual(['Arbeit'])
    expect(titles(s)).toEqual(['A'])
  })

  it('Rückgängig einer anderen Kategorie lässt ein leeres "Allgemein" stehen', async () => {
    const s = await open()
    const privat = s.createCategory('Privat', 'green')!
    const ids = s.deleteCategory(privat)!
    s.restoreCategory(privat, ids)
    expect(s.getSnapshot().categories.map((c) => c.name)).toEqual(['Allgemein', 'Privat'])
  })

  it('neue Notiz in einer gelöschten Kategorie landet in der ersten', async () => {
    const s = await open()
    const privat = s.createCategory('Privat', 'green')!
    s.deleteCategory(privat)
    const id = s.createNote({ categoryId: privat, title: 'X' }, true)
    expect(s.getNote(id)!.fields.categoryId).toBe(s.firstCategoryId)
  })
})

describe('Sicherung und Speicher', () => {
  it('Sicherung lässt sich in ein leeres Handy einspielen', async () => {
    const a = await open()
    const privat = a.createCategory('Privat', 'green')!
    a.createNote({ categoryId: privat, title: 'P1', body: '<div><b>fett</b></div>', priority: 'high' }, true)
    const backup = JSON.parse(JSON.stringify(a.exportBackup()))
    const b = await open()
    expect(b.importBackup(backup)).toBeGreaterThan(0)
    expect(titles(b)).toEqual(['P1'])
    expect(b.getSnapshot().categories.map((c) => c.name)).toEqual(['Allgemein', 'Privat'])
  })

  it('erkennt fremde und beschädigte Dateien', async () => {
    const s = await open()
    expect(() => s.importBackup({ app: 'einkaufsliste', format: 1 })).toThrow(BackupError)
    expect(() => s.importBackup({ app: 'mynotes', format: 1, notes: [{ id: 1 }] })).toThrow(BackupError)
  })

  it('speichert in SQLite und lädt beim nächsten Start', async () => {
    const file = `/tmp/mynotes-test-${process.pid}-${Date.now()}.db`
    const s = await open(new SqliteRepository(nodeSqlite(file)))
    s.createNote({ categoryId: s.firstCategoryId, title: 'bleibt' }, true)
    await s.flush()
    const again = await open(new SqliteRepository(nodeSqlite(file)))
    expect(titles(again)).toEqual(['bleibt'])
  })

  it('"Alle Daten löschen" behält die Einstellungen', async () => {
    const repo = new MemoryRepository()
    const s = await open(repo)
    await repo.setMeta('pref:theme', 'dark')
    s.createNote({ categoryId: s.firstCategoryId, title: 'weg' }, true)
    await s.reset({ keepMeta: ['pref:theme'] })
    expect(titles(s)).toEqual([])
    expect(await repo.getMeta('pref:theme')).toBe('dark')
    expect(s.getSnapshot().categories).toHaveLength(1)
  })
})
