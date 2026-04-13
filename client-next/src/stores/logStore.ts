import { create } from 'zustand'
import type { LogEntry } from '../types/protocol'

const MAX_ENTRIES = 1000

interface LogState {
  logs: LogEntry[]
  errors: LogEntry[]
  addMessages: (entries: LogEntry[]) => void
  clear: () => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  errors: [],

  addMessages: (entries) =>
    set((s) => {
      const newLogs: LogEntry[] = []
      const newErrors: LogEntry[] = []
      for (const e of entries) {
        if (e.log_type === 'LOGERR') newErrors.push(e)
        else newLogs.push(e)
      }
      return {
        logs: [...s.logs, ...newLogs].slice(-MAX_ENTRIES),
        errors: [...s.errors, ...newErrors].slice(-MAX_ENTRIES),
      }
    }),

  clear: () => set({ logs: [], errors: [] }),
}))
