import { COLLECTIONS, type CollectionName, type Collections } from '../domain/model'
import type { Repository } from './repository'

/** Speicher im Arbeitsspeicher. Für Tests und als Rückfall, wenn IndexedDB fehlt. */
export class MemoryRepository implements Repository {
  private data = new Map<CollectionName, Map<string, unknown>>(COLLECTIONS.map((c) => [c, new Map()]))
  private meta = new Map<string, unknown>()

  async loadAll() {
    const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
    return Object.fromEntries(COLLECTIONS.map((c) => [c, [...this.data.get(c)!.values()].map(clone)])) as {
      [K in CollectionName]: Collections[K][]
    }
  }

  async put<K extends CollectionName>(collection: K, docs: Collections[K][]) {
    const store = this.data.get(collection)!
    for (const doc of docs) store.set(doc.id, JSON.parse(JSON.stringify(doc)))
  }

  async getMeta<T>(key: string) {
    return this.meta.get(key) as T | undefined
  }

  async setMeta<T>(key: string, value: T) {
    this.meta.set(key, value)
  }

  async clear() {
    for (const store of this.data.values()) store.clear()
    this.meta.clear()
  }
}
