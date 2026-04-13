import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useExperimentStore } from '@/stores/experimentStore'
import { useVizConfigStore } from '@/stores/vizConfigStore'

export function EntityLinks() {
  const entities = useExperimentStore((s) => s.entities)
  const links = useVizConfigStore((s) => s.config.links)

  const segments = useMemo(() => {
    if (!links?.enabled || !links.field) return []
    const seen = new Set<string>()
    const result: [number, number, number, number, number, number][] = []

    for (const entity of entities.values()) {
      if (!('position' in entity) || !entity.user_data) continue
      const ud = entity.user_data as Record<string, unknown>
      const neighbors = ud[links.field]
      if (!Array.isArray(neighbors)) continue

      for (const nid of neighbors) {
        if (typeof nid !== 'string') continue
        const key = entity.id < nid ? `${entity.id}-${nid}` : `${nid}-${entity.id}`
        if (seen.has(key)) continue
        seen.add(key)
        const neighbor = entities.get(nid)
        if (!neighbor || !('position' in neighbor)) continue
        result.push([
          entity.position.x, entity.position.y, entity.position.z + 0.05,
          neighbor.position.x, neighbor.position.y, neighbor.position.z + 0.05,
        ])
      }
    }
    return result
  }, [entities, links])

  if (!links?.enabled || segments.length === 0) return null

  return (
    <>
      {segments.map((seg, i) => (
        <Line
          key={i}
          points={[[seg[0], seg[1], seg[2]], [seg[3], seg[4], seg[5]]]}
          color={links.color}
          lineWidth={2}
          transparent
          opacity={links.opacity}
        />
      ))}
    </>
  )
}
