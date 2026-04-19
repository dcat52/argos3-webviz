import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { useExperimentStore } from '@/stores/experimentStore'
import { FloatingPanel } from '../FloatingPanel'

interface EventEntry { step: number; label: string; type?: 'info' | 'success' | 'warning' }

interface EventLogState {
  events: EventEntry[]
  lastStep: number
  push: (entries: EventEntry[]) => void
  clear: () => void
}

const useEventLog = create<EventLogState>((set) => ({
  events: [],
  lastStep: -1,
  push: (entries) => set((s) => ({ events: [...s.events, ...entries].slice(-200), lastStep: entries[entries.length - 1]?.step ?? s.lastStep })),
  clear: () => set({ events: [], lastStep: -1 }),
}))

const TYPE_ICON: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️' }

export function EventLogPanel() {
  const userData = useExperimentStore((s) => s.userData)
  const push = useEventLog((s) => s.push)
  const events = useEventLog((s) => s.events)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const raw = (userData as Record<string, unknown>)?._events
    if (!Array.isArray(raw) || raw.length === 0) return
    push(raw as EventEntry[])
  }, [userData, push])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [events.length])

  if (events.length === 0) return null

  return (
    <FloatingPanel id="event-log" title="Events" defaultPosition={{ pin: 'bottom-left' }}>
      {events.map((e, i) => (
        <div key={i} className="flex gap-1.5 items-baseline">
          <span className="text-[10px] font-mono text-muted-foreground w-8 shrink-0">{e.step}</span>
          <span className="text-[10px]">{TYPE_ICON[e.type ?? 'info'] ?? ''}</span>
          <span className="text-[11px]">{e.label}</span>
        </div>
      ))}
      <div ref={endRef} />
    </FloatingPanel>
  )
}
