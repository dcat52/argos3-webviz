import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight } from 'lucide-react'
import { VizConfigPanel } from './VizConfigPanel'
import { SpawnPalette } from './SpawnPalette'
import { useConnectionStore } from '../stores/connectionStore'
import { useMetadataStore } from '../stores/metadataStore'
import type { AnyEntity, Vec3, Quaternion } from '../types/protocol'

const fv = (v: Vec3) => `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`
const fq = (q: Quaternion) => `${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(2)}, ${q.w.toFixed(2)}`

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 w-full text-xs font-semibold uppercase text-muted-foreground py-1 group">
        <ChevronRight className="h-3 w-3 transition-transform group-data-[panel-open]:rotate-90" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono">{value}</span>
    </div>
  )
}

function Inspector({ entity }: { entity: AnyEntity }) {
  const { debugPinnedIds, toggleDebugPin, computedFields } = useExperimentStore(
    useShallow((s) => ({ debugPinnedIds: s.debugPinnedIds, toggleDebugPin: s.toggleDebugPin, computedFields: s.computedFields }))
  )
  const isPinned = debugPinnedIds.has(entity.id)
  const computed = computedFields.get(entity.id)
  if (!('position' in entity)) return null
  return (
    <Section title="Inspector">
      <div className="pl-4 space-y-0.5">
        <Row label="ID" value={entity.id} />
        <Row label="Type" value={entity.type} />
        <Row label="Position" value={fv(entity.position)} />
        <Row label="Orientation" value={fq(entity.orientation)} />
        {computed && '_speed' in computed && <Row label="Speed" value={Number(computed._speed).toFixed(3)} />}
        {computed && '_heading' in computed && <Row label="Heading" value={`${(Number(computed._heading) * 180 / Math.PI).toFixed(1)}°`} />}
        {'leds' in entity && entity.leds && <Row label="LEDs" value={String(entity.leds.length)} />}
        <button
          onClick={() => toggleDebugPin(entity.id)}
          className={`w-full text-xs rounded px-2 py-1 mt-1 ${isPinned ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
        >
          {isPinned ? '🔍 Debug Pinned' : '🔍 Pin Debug View'}
        </button>
        {entity.user_data !== undefined && (
          <div className="pt-1">
            <span className="text-xs text-muted-foreground">User Data</span>
            <pre className="text-[10px] text-muted-foreground mt-1 bg-muted p-1.5 rounded overflow-auto max-h-24">
              {JSON.stringify(entity.user_data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Section>
  )
}

export function Sidebar() {
  const { entities, selectedEntityId, selectEntity } = useExperimentStore(
    useShallow((s) => ({ entities: s.entities, selectedEntityId: s.selectedEntityId, selectEntity: s.selectEntity }))
  )
  const selected = selectedEntityId ? entities.get(selectedEntityId) : undefined

  const grouped = useMemo(() => {
    const groups = new Map<string, AnyEntity[]>()
    for (const e of entities.values()) {
      const list = groups.get(e.type) ?? []
      list.push(e)
      groups.set(e.type, list)
    }
    return groups
  }, [entities])

  return (
    <div className="h-full flex flex-col bg-card">
      <ScrollArea className="flex-1">
        <div className="px-3 pt-2 space-y-1">
          {selected && <Inspector entity={selected} />}
          {selected && (
            <button
              className="w-full text-xs bg-destructive text-destructive-foreground rounded px-2 py-1 mb-1"
              onClick={() => {
                useConnectionStore.getState().removeEntity(selected.id)
                selectEntity(null)
              }}
            >
              Delete {selected.id}
            </button>
          )}

          <Separator />
          <SpawnPalette />

          <Section title={`Entities (${entities.size})`}>
            {Array.from(grouped.entries()).map(([type, list]) => (
              <div key={type} className="pl-2">
                <Section title={`${type} (${list.length})`} defaultOpen={false}>
                  <div className="pl-2">
                    {list.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => selectEntity(e.id)}
                        className={`block w-full text-left text-xs px-2 py-1 rounded truncate transition-colors ${
                          e.id === selectedEntityId
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent text-foreground'
                        }`}
                      >
                        {e.id}
                      </button>
                    ))}
                  </div>
                </Section>
              </div>
            ))}
          </Section>

          <Separator />
          <VizConfigPanel />
        </div>
      </ScrollArea>
    </div>
  )
}
