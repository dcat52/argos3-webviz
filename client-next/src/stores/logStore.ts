import { create } from 'zustand'
import type { LogEntry } from '../types/protocol'
import { useSettingsStore } from './settingsStore'

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
        logs: [...s.logs, ...newLogs].slice(-useSettingsStore.getState().maxLogEntries),
        errors: [...s.errors, ...newErrors].slice(-useSettingsStore.getState().maxLogEntries),
      }
    }),

  clear: () => set({ logs: [], errors: [] }),
}))
