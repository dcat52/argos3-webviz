import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '@/stores/experimentStore'
import { FloatingPanel } from '../FloatingPanel'
import { Pin } from 'lucide-react'

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4)
  if (typeof v === 'boolean') return v ? '✓' : '✗'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export function WatchListPanel() {
  const { pinnedFields, entities, unpinField } = useExperimentStore(
    useShallow((s) => ({ pinnedFields: s.pinnedFields, entities: s.entities, unpinField: s.unpinField }))
  )

  if (pinnedFields.length === 0) return null

  return (
    <FloatingPanel id="watch-list" title="Watch List" defaultPosition={{ pin: 'top-left' }}>
      <div className="w-64 max-h-[50vh] overflow-auto p-2 space-y-0">
        {pinnedFields.map(({ entityId, field }) => {
          const entity = entities.get(entityId)
          const ud = entity && 'user_data' in entity ? (entity as any).user_data as Record<string, unknown> | undefined : undefined
          const value = ud?.[field]
          return (
            <div key={`${entityId}.${field}`} className="flex items-baseline py-px group/row">
              <span className="text-[10px] text-muted-foreground truncate mr-1">{entityId}</span>
              <span className="text-[10px] text-muted-foreground/60">.</span>
              <span className="text-[10px] text-muted-foreground">{field}</span>
              <span className="text-[10px] font-mono text-right ml-auto">{formatValue(value)}</span>
              <button
                onClick={() => unpinField(entityId, field)}
                className="ml-1 shrink-0 text-yellow-500 hover:text-destructive"
                title="Unpin"
              >
                <Pin className="h-2.5 w-2.5" />
              </button>
            </div>
          )
        })}
      </div>
    </FloatingPanel>
  )
}
