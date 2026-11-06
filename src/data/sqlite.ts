import { COLLECTIONS, type CollectionName, type Collections } from '../domain/model'
import type { Repository } from './repository'

/**
 * Die Teile von expo-sqlite, die der Speicher braucht. Als eigene Schnittstelle,
 * damit die Tests am PC eine andere SQLite-Anbindung einsetzen können.
 */
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>
  withTransactionAsync(task: () => Promise<void>): Promise<void>
}

/** Bei Änderungen am Aufbau erhöhen und in migrate() eine Umstellung ergänzen. */
const SCHEMA_VERSION = 2

/**
 * Speicher in einer SQLite-Datenbank auf dem Handy.
 * Je Sammlung eine Tabelle: ID, Änderungsstand und der Datensatz als JSON.
 * Die Spalte `updated` erlaubt einer späteren Synchronisation, "alles seit X" abzufragen.
 */
export class SqliteRepository implements Repository {
  private ready: Promise<void>

  constructor(private readonly db: SqlDatabase) {
    this.ready = this.migrate()
  }

  private async migrate(): Promise<void> {
    await this.db.execAsync('PRAGMA journal_mode = WAL;')
    const row = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;')
    const version = row?.user_version ?? 0
    // Version 2: Sammlung "categories" für eigene Kategorien. CREATE ... IF NOT EXISTS
    // legt nur an, was fehlt, deshalb genügt für beide Stände derselbe Schritt.
    if (version < SCHEMA_VERSION) {
      const tables = COLLECTIONS.map(
        (name) =>
          `CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY NOT NULL, updated TEXT NOT NULL, doc TEXT NOT NULL);
           CREATE INDEX IF NOT EXISTS ${name}_updated ON ${name}(updated);`,
      ).join('\n')
      await this.db.execAsync(`${tables}
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        PRAGMA user_version = ${SCHEMA_VERSION};`)
    }
  }

  async loadAll() {
    await this.ready
    const out = {} as { [K in CollectionName]: Collections[K][] }
    for (const name of COLLECTIONS) {
      const rows = await this.db.getAllAsync<{ doc: string }>(`SELECT doc FROM ${name}`)
      ;(out[name] as unknown[]) = rows.map((r) => JSON.parse(r.doc))
    }
    return out
  }

  async put<K extends CollectionName>(collection: K, docs: Collections[K][]) {
    if (docs.length === 0) return
    await this.ready
    await this.db.withTransactionAsync(async () => {
      for (const doc of docs) {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO ${collection} (id, updated, doc) VALUES (?, ?, ?)`,
          doc.id,
          doc.updated,
          JSON.stringify(doc),
        )
      }
    })
  }

  async getMeta<T>(key: string) {
    await this.ready
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)
    return row ? (JSON.parse(row.value) as T) : undefined
  }

  async setMeta<T>(key: string, value: T) {
    await this.ready
    await this.db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, JSON.stringify(value))
  }

  async clear() {
    await this.ready
    await this.db.withTransactionAsync(async () => {
      for (const name of [...COLLECTIONS, 'meta']) await this.db.runAsync(`DELETE FROM ${name}`)
    })
  }
}
