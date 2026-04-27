import { useMemo } from 'react'
import { useExperimentStore } from '@/stores/experimentStore'
import { FloatingPanel } from '../FloatingPanel'

const HIDDEN_KEYS = new Set(['_draw', '_events', '_viz_hints', '_ui', 'available_scenes', 'current_scene'])

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4)
  if (typeof v === 'boolean') return v ? '✓' : '✗'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export function ExperimentDataPanel() {
  const userData = useExperimentStore((s) => s.userData)

  const entries = useMemo(() => {
    if (!userData || typeof userData !== 'object') return []
    return Object.entries(userData as Record<string, unknown>).filter(([k]) => !HIDDEN_KEYS.has(k))
  }, [userData])

  if (entries.length === 0) return null

  return (
    <FloatingPanel id="experiment-data" title="Experiment Data" defaultPosition={{ pin: 'top-right' }}>
      {entries.map(([k, v]) => (
        <div key={k} className="flex justify-between">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-mono">{formatValue(v)}</span>
        </div>
      ))}
    </FloatingPanel>
  )
}
