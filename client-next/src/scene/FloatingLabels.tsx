import { Html } from '@react-three/drei'
import { useExperimentStore } from '@/stores/experimentStore'
import { useVizConfigStore } from '@/stores/vizConfigStore'

export function FloatingLabels() {
  const entities = useExperimentStore((s) => s.entities)
  const labels = useVizConfigStore((s) => s.config.labels)

  const active = labels.filter((l) => l.enabled)
  if (active.length === 0) return null

  return (
    <>
      {Array.from(entities.values()).map((entity) => {
        if (!('position' in entity) || !entity.user_data) return null
        const ud = entity.user_data as Record<string, unknown>
        const texts = active.map((l) => ud[l.field]).filter((v) => v !== undefined)
        if (texts.length === 0) return null
        const { x, y, z } = entity.position
        return (
          <group key={entity.id} position={[x, y, z + 0.12]}>
            <Html center style={{ pointerEvents: 'none' }}>
              <div style={{ fontSize: '10px', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                {texts.join(' | ')}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}
