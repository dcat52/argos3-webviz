import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVizConfigStore } from '@/stores/vizConfigStore'
import { useHeatmapData } from '@/hooks/useHeatmapData'

export function HeatmapOverlay() {
  const config = useVizConfigStore((s) => s.config.heatmap)
  const { grid, arena } = useHeatmapData(config.resolution, config.decay)
  const meshRef = useRef<THREE.Mesh>(null)

  const colorA = useMemo(() => new THREE.Color(config.colorA), [config.colorA])
  const colorB = useMemo(() => new THREE.Color(config.colorB), [config.colorB])

  const texture = useMemo(() => {
    const size = config.resolution
    const data = new Uint8Array(size * size * 4)
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    tex.needsUpdate = true
    return tex
  }, [config.resolution])

  useFrame(() => {
    if (!config.enabled || !arena) return
    const size = config.resolution
    const data = texture.image.data as Uint8Array
    const tmp = new THREE.Color()
    for (let i = 0; i < size * size; i++) {
      const v = grid[i] ?? 0
      tmp.copy(colorA).lerp(colorB, v)
      data[i * 4] = Math.floor(tmp.r * 255)
      data[i * 4 + 1] = Math.floor(tmp.g * 255)
      data[i * 4 + 2] = Math.floor(tmp.b * 255)
      data[i * 4 + 3] = Math.floor(v * 200)
    }
    texture.needsUpdate = true
  })

  if (!config.enabled || !arena) return null

  return (
    <mesh ref={meshRef} position={[arena.center.x, arena.center.y, 0.001]} rotation={[0, 0, 0]}>
      <planeGeometry args={[arena.size.x, arena.size.y]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}
