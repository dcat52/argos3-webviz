import { useMemo } from 'react'
import * as THREE from 'three'
import { Grid, Environment, Cloud } from '@react-three/drei'
import { useSceneSettingsStore } from '@/stores/sceneSettingsStore'
import type { ArenaInfo } from '../types/protocol'

export type EnvPreset = 'grid' | 'grass' | 'mountain' | 'soccer' | 'football'

interface Props {
  preset: EnvPreset
  arena: ArenaInfo | null
}

/** Grid — clean technical view */
function GridEnv({ arena }: { arena: ArenaInfo | null }) {
  const showFog = useSceneSettingsStore((s) => s.showFog)
  if (!arena) return null
  return (
    <>
      <color attach="background" args={['#f0f0f0']} />
      {showFog && <fog attach="fog" args={['#f0f0f0', 50, 150]} />}
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
        fadeDistance={999}
        side={THREE.DoubleSide}
      />
    </>
  )
}

/** Grass — green ground, blue sky, soft lighting */
function GrassEnv({ arena }: { arena: ArenaInfo | null }) {
  const showFog = useSceneSettingsStore((s) => s.showFog)
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
      {showFog && <fog attach="fog" args={['#87ceeb', 30, 80]} />}
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
  const showFog = useSceneSettingsStore((s) => s.showFog)
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
      {showFog && <fog attach="fog" args={['#eeddcc', 40, 120]} />}
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

/** Soccer field — regulation 105m × 68m, centered at origin */
function SoccerEnv({ arena }: { arena: ArenaInfo | null }) {
  const showFog = useSceneSettingsStore((s) => s.showFog)

  const fieldTex = useMemo(() => {
    const W = 1050, H = 680 // 10px per meter
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Grass base with stripe pattern
    for (let i = 0; i < W; i += 70) {
      ctx.fillStyle = i % 140 === 0 ? '#3d8b37' : '#349030'
      ctx.fillRect(i, 0, 70, H)
    }

    // Line drawing helper
    const lw = 3
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = lw
    ctx.fillStyle = '#ffffff'

    // Outer boundary
    ctx.strokeRect(lw, lw, W - lw * 2, H - lw * 2)

    // Halfway line
    ctx.beginPath()
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H)
    ctx.stroke()

    // Center circle (9.15m radius = 91.5px)
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 91.5, 0, Math.PI * 2)
    ctx.stroke()

    // Center spot
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2)
    ctx.fill()

    // Penalty areas (16.5m from goal line, 40.3m wide)
    const paW = 165, paH = 403
    const paY = (H - paH) / 2
    ctx.strokeRect(lw, paY, paW, paH)
    ctx.strokeRect(W - paW - lw, paY, paW, paH)

    // Goal areas (5.5m from goal line, 18.3m wide)
    const gaW = 55, gaH = 183
    const gaY = (H - gaH) / 2
    ctx.strokeRect(lw, gaY, gaW, gaH)
    ctx.strokeRect(W - gaW - lw, gaY, gaW, gaH)

    // Penalty spots (11m from goal line)
    ctx.beginPath()
    ctx.arc(110, H / 2, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(W - 110, H / 2, 4, 0, Math.PI * 2)
    ctx.fill()

    // Penalty arcs
    ctx.beginPath()
    ctx.arc(110, H / 2, 91.5, -0.93, 0.93)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(W - 110, H / 2, 91.5, Math.PI - 0.93, Math.PI + 0.93)
    ctx.stroke()

    // Corner arcs (1m radius = 10px)
    const corners: [number, number, number, number][] = [
      [0, 0, 0, Math.PI / 2],
      [W, 0, Math.PI / 2, Math.PI],
      [W, H, Math.PI, Math.PI * 1.5],
      [0, H, Math.PI * 1.5, Math.PI * 2],
    ]
    for (const [cx, cy, s, e] of corners) {
      ctx.beginPath()
      ctx.arc(cx, cy, 10, s, e)
      ctx.stroke()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <>
      <color attach="background" args={['#87ceeb']} />
      {showFog && <fog attach="fog" args={['#87ceeb', 80, 200]} />}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[105, 68]} />
        <meshStandardMaterial map={fieldTex} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#3a7a32" roughness={1} />
      </mesh>
    </>
  )
}

/** American football field — 109.7m × 48.8m (120yd × 53⅓yd), centered at origin */
function FootballEnv({ arena }: { arena: ArenaInfo | null }) {
  const showFog = useSceneSettingsStore((s) => s.showFog)

  const fieldTex = useMemo(() => {
    // 109.7m total (100yd field + 2×10yd end zones), 48.8m wide
    const W = 1097, H = 488 // 10px per meter
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Green base with 5-yard stripes
    const yardPx = W / 120 // px per yard
    for (let y = 0; y < 120; y += 5) {
      ctx.fillStyle = y % 10 === 0 ? '#2d7a2d' : '#338833'
      ctx.fillRect(y * yardPx, 0, 5 * yardPx, H)
    }

    ctx.strokeStyle = '#ffffff'
    ctx.fillStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.font = `bold ${Math.round(yardPx * 3)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Outer boundary
    ctx.strokeRect(2, 2, W - 4, H - 4)

    // End zone lines
    const ez = 10 * yardPx
    ctx.beginPath()
    ctx.moveTo(ez, 0); ctx.lineTo(ez, H)
    ctx.moveTo(W - ez, 0); ctx.lineTo(W - ez, H)
    ctx.stroke()

    // Yard lines every 5 yards + numbers every 10
    for (let y = 10; y <= 110; y += 5) {
      const x = y * yardPx
      ctx.beginPath()
      ctx.moveTo(x, 0); ctx.lineTo(x, H)
      ctx.stroke()

      if ((y - 10) % 10 === 0 && y > 10 && y < 110) {
        const num = (y - 10) <= 50 ? (y - 10) : (100 - (y - 10))
        // Top numbers
        ctx.save()
        ctx.translate(x, H * 0.15)
        ctx.fillText(String(num), 0, 0)
        ctx.restore()
        // Bottom numbers (flipped)
        ctx.save()
        ctx.translate(x, H * 0.85)
        ctx.rotate(Math.PI)
        ctx.fillText(String(num), 0, 0)
        ctx.restore()
      }
    }

    // Hash marks (short ticks at each yard)
    ctx.lineWidth = 1.5
    const hashLen = yardPx * 0.6
    for (let y = 11; y < 110; y++) {
      if ((y - 10) % 5 === 0) continue
      const x = y * yardPx
      // Top hash
      ctx.beginPath()
      ctx.moveTo(x, H * 0.33 - hashLen / 2); ctx.lineTo(x, H * 0.33 + hashLen / 2)
      ctx.stroke()
      // Bottom hash
      ctx.beginPath()
      ctx.moveTo(x, H * 0.67 - hashLen / 2); ctx.lineTo(x, H * 0.67 + hashLen / 2)
      ctx.stroke()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <>
      <color attach="background" args={['#87ceeb']} />
      {showFog && <fog attach="fog" args={['#87ceeb', 80, 200]} />}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[109.7, 48.8]} />
        <meshStandardMaterial map={fieldTex} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#3a7a32" roughness={1} />
      </mesh>
    </>
  )
}

export function EnvironmentPreset({ preset, arena }: Props) {
  switch (preset) {
    case 'grass': return <GrassEnv arena={arena} />
    case 'mountain': return <MountainEnv arena={arena} />
    case 'football': return <FootballEnv arena={arena} />
    case 'soccer': return <SoccerEnv arena={arena} />
    default: return <GridEnv arena={arena} />
  }
}
