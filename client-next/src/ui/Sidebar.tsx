import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { VizConfigPanel } from './VizConfigPanel'
import type { AnyEntity, Vec3, Quaternion } from '../types/protocol'

const fv = (v: Vec3) => `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`
const fq = (q: Quaternion) => `${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(2)}, ${q.w.toFixed(2)}`

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono">{value}</span>
    </div>
  )
}

function Inspector({ entity }: { entity: AnyEntity }) {
  if (!('position' in entity)) return null
  return (
    <div className="p-3 space-y-1">
      <h3 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">Inspector</h3>
      <Row label="ID" value={entity.id} />
      <Row label="Type" value={entity.type} />
      <Row label="Position" value={fv(entity.position)} />
      <Row label="Orientation" value={fq(entity.orientation)} />
      {'leds' in entity && entity.leds && <Row label="LEDs" value={String(entity.leds.length)} />}
      {entity.user_data !== undefined && (
        <div className="pt-1">
          <span className="text-xs text-muted-foreground">User Data</span>
          <pre className="text-[10px] text-muted-foreground mt-1 bg-muted p-1.5 rounded overflow-auto max-h-24">
            {JSON.stringify(entity.user_data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { entities, selectedEntityId, selectEntity } = useExperimentStore(
    useShallow((s) => ({ entities: s.entities, selectedEntityId: s.selectedEntityId, selectEntity: s.selectEntity }))
  )
  const selected = selectedEntityId ? entities.get(selectedEntityId) : undefined

  return (
    <div className="h-full flex flex-col bg-card">
      {selected && (
        <>
          <Inspector entity={selected} />
          <Separator />
        </>
      )}
      <div className="px-3 pt-2 pb-1">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Entities ({entities.size})
        </h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2">
          {Array.from(entities.values()).map((e) => (
            <button
              key={e.id}
              onClick={() => selectEntity(e.id)}
              className={`block w-full text-left text-xs px-2 py-1 rounded truncate transition-colors ${
                e.id === selectedEntityId
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-foreground'
              }`}
            >
              {e.id} <span className={e.id === selectedEntityId ? 'text-primary-foreground/70' : 'text-muted-foreground'}>({e.type})</span>
            </button>
          ))}
        </div>
        <Separator />
        <VizConfigPanel />
      </ScrollArea>
    </div>
  )
}
