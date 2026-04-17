import { Line } from '@react-three/drei'
import { useVizConfigStore } from '@/stores/vizConfigStore'
import { useTrailHistory } from '@/hooks/useTrailHistory'

export function TrailRenderer() {
  const config = useVizConfigStore((s) => s.config.trails)
  const trails = useTrailHistory(config.length)

  if (!config.enabled) return null

  return (
    <>
      {Array.from(trails.entries()).map(([id, points]) =>
        points.length >= 2 ? (
          <Line
            key={id}
            points={points}
            color="#44aaff"
            lineWidth={1.5}
            transparent
            opacity={config.opacity}
          />
        ) : null
      )}
    </>
  )
}
