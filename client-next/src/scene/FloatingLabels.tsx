import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useExperimentStore } from '@/stores/experimentStore'
import { useVizConfigStore } from '@/stores/vizConfigStore'

function BarIndicator({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const hue = value * 120 // 0=red, 0.5=yellow, 1=green
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      <div style={{ width: '36px', height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `hsl(${hue},80%,50%)`, borderRadius: '3px' }} />
      </div>
      <span style={{ fontSize: '8px', opacity: 0.7 }}>{label}</span>
    </div>
  )
}

function BadgeIndicator({ value }: { value: string }) {
  // Simple hash to color
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) & 0xffffff
  const color = `hsl(${h % 360},60%,55%)`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '9px' }}>{value}</span>
    </div>
  )
}

export function FloatingLabels() {
  const entities = useExperimentStore((s) => s.entities)
  const computedFields = useExperimentStore((s) => s.computedFields)
  const labels = useVizConfigStore((s) => s.config.labels)

  const active = labels.filter((l) => l.enabled)
  if (active.length === 0) return null

  return (
    <>
      {Array.from(entities.values()).map((entity) => {
        if (!('position' in entity)) return null
        const ud = entity.user_data as Record<string, unknown> | undefined
        const cf = computedFields.get(entity.id)

        const items = active.map((l) => {
          const val = l.field.startsWith('_') ? cf?.[l.field] : ud?.[l.field]
          if (val === undefined) return null
          const display = l.display ?? 'text'
          if (display === 'bar' && typeof val === 'number') return <BarIndicator key={l.field} value={val} label={l.field} />
          if (display === 'badge') return <BadgeIndicator key={l.field} value={String(val)} />
          return <span key={l.field} style={{ fontSize: '10px' }}>{String(val)}</span>
        }).filter(Boolean)

        if (items.length === 0) return null
        const { x, y, z } = entity.position
        return (
          <group key={entity.id} position={[x, y, z + 0.12]}>
            <Html center style={{ pointerEvents: 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                {items}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}
