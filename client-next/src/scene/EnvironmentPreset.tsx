import { useMemo } from 'react'
import * as THREE from 'three'
import { Grid, Environment, Cloud } from '@react-three/drei'
import type { ArenaInfo } from '../types/protocol'

export type EnvPreset = 'grid' | 'grass' | 'mountain'

interface Props {
  preset: EnvPreset
  arena: ArenaInfo | null
}

/** Grid — clean technical view */
function GridEnv({ arena }: { arena: ArenaInfo | null }) {
  if (!arena) return null
  return (
    <>
      <color attach="background" args={['#f0f0f0']} />
      <fog attach="fog" args={['#f0f0f0', 50, 150]} />
      <Grid
        args={[arena.size.x, arena.size.y]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[arena.center.x, arena.center.y, -0.001]}
        cellSize={1}
        cellThickness={0.8}
        cellColor="#aaa"
        sectionSize={5}
        sectionThickness={1.5}
        sectionColor="#777"
        side={THREE.DoubleSide}
      />
    </>
  )
}

/** Grass — green ground, blue sky, soft lighting */
function GrassEnv({ arena }: { arena: ArenaInfo | null }) {
  const grassTex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const ctx = canvas.getContext('2d')!
    // Base green
    ctx.fillStyle = '#4a7c3f'
    ctx.fillRect(0, 0, 256, 256)
    // Noise blades
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const g = 60 + Math.random() * 60
      ctx.fillStyle = `rgb(${30 + Math.random() * 30},${g},${20 + Math.random() * 20})`
      ctx.fillRect(x, y, 1, 2 + Math.random() * 3)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(8, 8)
    return tex
  }, [])

  return (
    <>
      <color attach="background" args={['#87ceeb']} />
      <fog attach="fog" args={['#87ceeb', 30, 80]} />
      <Environment preset="park" background={false} />
      {arena && (
        <mesh rotation={[0, 0, 0]} position={[arena.center.x, arena.center.y, -0.002]}>
          <planeGeometry args={[arena.size.x, arena.size.y]} />
          <meshStandardMaterial map={grassTex} roughness={0.9} />
        </mesh>
      )}
      {/* Surrounding ground beyond arena */}
      <mesh rotation={[0, 0, 0]} position={[0, 0, -0.01]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#5a8a4a" roughness={1} />
      </mesh>
    </>
  )
}

/** Mountain — dramatic terrain, sunset sky */
function MountainEnv({ arena }: { arena: ArenaInfo | null }) {
  const heightMap = useMemo(() => {
    const geo = new THREE.PlaneGeometry(200, 200, 128, 128)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const dist = Math.sqrt(x * x + y * y)
      // Mountains rise at edges, flat in center for arena
      const flatRadius = arena ? Math.max(arena.size.x, arena.size.y) * 0.6 : 10
      const t = Math.max(0, (dist - flatRadius) / 40)
      const height = t * t * 1.5 * (
        Math.sin(x * 0.05) * Math.cos(y * 0.07) +
        Math.sin(x * 0.12 + 1) * 0.5 +
        Math.cos(y * 0.09 + 2) * 0.7
      )
      pos.setZ(i, Math.max(0, height))
    }
    geo.computeVertexNormals()
    return geo
  }, [arena])

  return (
    <>
      <color attach="background" args={['#eeddcc']} />
      <fog attach="fog" args={['#eeddcc', 40, 120]} />
      {/* Arena ground */}
      {arena && (
        <mesh rotation={[0, 0, 0]} position={[arena.center.x, arena.center.y, -0.002]}>
          <planeGeometry args={[arena.size.x, arena.size.y]} />
          <meshStandardMaterial color="#c4a882" roughness={0.85} />
        </mesh>
      )}
      {/* Terrain */}
      <mesh geometry={heightMap} position={[0, 0, -0.5]}>
        <meshStandardMaterial
          color="#8b7355"
          roughness={0.9}
          flatShading
        />
      </mesh>
      <Cloud position={[30, 20, 25]} speed={0.2} opacity={0.4} width={20} depth={5} />
      <Cloud position={[-25, 30, 20]} speed={0.15} opacity={0.3} width={15} depth={4} />
    </>
  )
}

export function EnvironmentPreset({ preset, arena }: Props) {
  switch (preset) {
    case 'grass': return <GrassEnv arena={arena} />
    case 'mountain': return <MountainEnv arena={arena} />
    default: return <GridEnv arena={arena} />
  }
}
