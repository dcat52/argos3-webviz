import type { StateStorage } from 'zustand/middleware'

/** No-op storage that keeps values in memory only (no localStorage writes). */
const map = new Map<string, string>()

export const memoryStorage: StateStorage = {
  getItem: (name) => map.get(name) ?? null,
  setItem: (name, value) => { map.set(name, value) },
  removeItem: (name) => { map.delete(name) },
}
