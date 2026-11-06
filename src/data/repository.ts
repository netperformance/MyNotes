import type { CollectionName, Collections } from '../domain/model'

/**
 * Schnittstelle zum Speicher. Die App kennt nur diese Schnittstelle, nicht die Technik
 * dahinter. Heute: IndexedDB im Browser. Für Tests: Arbeitsspeicher.
 */
export interface Repository {
  loadAll(): Promise<{ [K in CollectionName]: Collections[K][] }>
  put<K extends CollectionName>(collection: K, docs: Collections[K][]): Promise<void>
  /** Kleine Werte, die nur dieses Gerät betreffen (Geräte-ID, Uhrstand, Sync-Stand). */
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta<T>(key: string, value: T): Promise<void>
  /** Löscht alle Daten dieses Geräts unwiderruflich. */
  clear(): Promise<void>
}
