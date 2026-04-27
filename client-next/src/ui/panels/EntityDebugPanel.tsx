import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '@/stores/experimentStore'
import { FloatingPanel } from '../FloatingPanel'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight } from 'lucide-react'
import type { AnyEntity, Vec3, Quaternion } from '@/types/protocol'
import { UserDataView } from '../UserDataView'

export const ENTITY_DEBUG_PANEL_ID = 'entity-debug'

const fv = (v: Vec3) => `${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)}`
const fq = (q: Quaternion) => `${q.x.toFixed(3)}, ${q.y.toFixed(3)}, ${q.z.toFixed(3)}, ${q.w.toFixed(3)}`
const fn = (n: unknown) => typeof n === 'number' ? n.toFixed(3) : String(n ?? '—')

function Sect({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 w-full text-[10px] font-semibold uppercase text-muted-foreground py-0.5 group">
        <ChevronRight className="h-2.5 w-2.5 transition-transform group-data-[panel-open]:rotate-90" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-px">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[10px] font-mono">{value}</span>
    </div>
  )
}

function LedSwatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 py-1">
      {colors.map((c, i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-sm border border-border"
          style={{ backgroundColor: c.startsWith('0x') ? `#${c.slice(2)}` : c }}
          title={`LED ${i}: ${c}`}
        />
      ))}
    </div>
  )
}

function EntityContent({ entity, computed }: { entity: AnyEntity; computed: Record<string, unknown> | undefined }) {
  const { pinField, unpinField, isFieldPinned } = useExperimentStore(
    useShallow((s) => ({ pinField: s.pinField, unpinField: s.unpinField, isFieldPinned: s.isFieldPinned }))
  )
  if (!('position' in entity)) return <p className="text-xs text-muted-foreground">No spatial data</p>

  const hasLeds = 'leds' in entity && Array.isArray(entity.leds) && entity.leds.length > 0
  const hasRays = 'rays' in entity && Array.isArray((entity as any).rays)
  const rays = hasRays ? (entity as any).rays as string[] : []
  const points = 'points' in entity ? (entity as any).points as string[] : []

  return (
    <div className="space-y-1">
      <Sect title="Transform">
        <div className="pl-2">
          <Row label="Position" value={fv(entity.position)} />
          <Row label="Orientation" value={fq(entity.orientation)} />
        </div>
      </Sect>

      {computed && (
        <Sect title="Computed Fields">
          <div className="pl-2">
            {Object.entries(computed).map(([k, v]) => (
              <Row key={k} label={k} value={fn(v)} />
            ))}
          </div>
        </Sect>
      )}

      {hasLeds && (
        <Sect title={`LEDs (${(entity as any).leds.length})`}>
          <div className="pl-2">
            <LedSwatches colors={(entity as any).leds} />
          </div>
        </Sect>
      )}

      {hasRays && (
        <Sect title={`Sensors (${rays.length} rays)`} defaultOpen={false}>
          <div className="pl-2">
            <Row label="Rays" value={String(rays.length)} />
            <Row label="Intersections" value={String(points.length)} />
          </div>
        </Sect>
      )}

      {'is_movable' in entity && (
        <Sect title="Physics" defaultOpen={false}>
          <div className="pl-2">
            <Row label="Movable" value={String(entity.is_movable)} />
            {'scale' in entity && entity.scale && <Row label="Scale" value={fv(entity.scale as Vec3)} />}
            {'radius' in entity && <Row label="Radius" value={String((entity as any).radius)} />}
            {'height' in entity && <Row label="Height" value={String((entity as any).height)} />}
          </div>
        </Sect>
      )}

      {entity.user_data !== undefined && (
        <Sect title="User Data" defaultOpen={false}>
          <div className="pl-2">
            <UserDataView
              data={entity.user_data}
              entityId={entity.id}
              onPinField={(field) => {
                if (isFieldPinned(entity.id, field)) unpinField(entity.id, field)
                else pinField(entity.id, field)
              }}
              isFieldPinned={(field) => isFieldPinned(entity.id, field)}
            />
          </div>
        </Sect>
      )}

      <Sect title="Raw JSON" defaultOpen={false}>
        <pre className="text-[9px] text-muted-foreground bg-muted p-1.5 rounded overflow-auto max-h-48">
          {JSON.stringify(entity, null, 2)}
        </pre>
      </Sect>
    </div>
  )
}

export function EntityDebugPanel() {
  const { selectedEntityId, entities, computedFields } = useExperimentStore(
    useShallow((s) => ({
      selectedEntityId: s.selectedEntityId,
      entities: s.entities,
      computedFields: s.computedFields,
    }))
  )

  const entity = selectedEntityId ? entities.get(selectedEntityId) : undefined
  const computed = selectedEntityId ? computedFields.get(selectedEntityId) : undefined

  return (
    <FloatingPanel
      id={ENTITY_DEBUG_PANEL_ID}
      title={entity ? `Debug: ${entity.id}` : 'Debug: (none)'}
      defaultPosition={{ pin: 'top-left' }}
      initialOpen={false}
    >
      <div className="w-80 max-h-[70vh] overflow-auto p-2">
        {entity ? (
          <EntityContent entity={entity} computed={computed} />
        ) : (
          <p className="text-xs text-muted-foreground">Select an entity to inspect</p>
        )}
      </div>
    </FloatingPanel>
  )
}
