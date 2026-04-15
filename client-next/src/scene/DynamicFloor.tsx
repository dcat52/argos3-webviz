/**
 * Renders a dynamic floor color grid from user_data._floor.
 * Decodes base64 RGB data into a DataTexture on a ground plane.
 */
import { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { FloorColorGrid, ArenaInfo } from '@/types/protocol'

function decodeBase64RGB(b64: string, resolution: number): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  // Ensure correct size (resolution * resolution * 3)
  const expected = resolution * resolution * 3
  if (bytes.length < expected) {
    const padded = new Uint8Array(expected)
    padded.set(bytes)
    return padded
  }
  return bytes.slice(0, expected)
}

export function DynamicFloor({ floorData, arena }: { floorData: FloorColorGrid; arena: ArenaInfo }) {
  const texRef = useRef<THREE.DataTexture | null>(null)

  const texture = useMemo(() => {
    const res = floorData.resolution
    const rgb = decodeBase64RGB(floorData.colors, res)
    const tex = new THREE.DataTexture(rgb, res, res, THREE.RGBFormat)
    tex.needsUpdate = true
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    texRef.current = tex
    return tex
  }, [floorData.colors, floorData.resolution])

  // Update texture data without recreating
  useEffect(() => {
    if (texRef.current) {
      const res = floorData.resolution
      const rgb = decodeBase64RGB(floorData.colors, res)
      texRef.current.image.data.set(rgb)
      texRef.current.needsUpdate = true
    }
  }, [floorData.colors, floorData.resolution])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[arena.center.x, 0.001, arena.center.y]}>
      <planeGeometry args={[arena.size.x, arena.size.y]} />
      <meshBasicMaterial map={texture} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  )
}
