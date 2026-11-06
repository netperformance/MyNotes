import { createContext, useContext, useSyncExternalStore } from 'react'
import type { NotesStore, Snapshot } from '../store/store'

export const StoreContext = createContext<NotesStore | null>(null)

export function useNotesStore(): NotesStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('NotesStore fehlt')
  return store
}

export function useSnapshot(): Snapshot {
  const store = useNotesStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
