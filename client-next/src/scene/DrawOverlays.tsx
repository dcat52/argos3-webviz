/**
 * Renders world-space draw commands from user_data._draw[].
 * Supports: circle, cylinder, ray, text.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Line, Html } from '@react-three/drei'
import type { DrawCommand } from '@/types/protocol'

function toColor(c: [number, number, number, number]): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255).toFixed(2)})`
}

function toHex(c: [number, number, number, number]): string {
  const r = c[0].toString(16).padStart(2, '0')
  const g = c[1].toString(16).padStart(2, '0')
  const b = c[2].toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

function CircleShape({ cmd }: { cmd: Extract<DrawCommand, { shape: 'circle' }> }) {
  const geo = useMemo(() => {
    if (cmd.fill) {
      return new THREE.CircleGeometry(cmd.radius, 32)
    }
    return new THREE.RingGeometry(cmd.radius - 0.02, cmd.radius, 32)
  }, [cmd.radius, cmd.fill])

  return (
    <mesh geometry={geo} position={cmd.pos} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial
        color={toHex(cmd.color)}
        opacity={cmd.color[3] / 255}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function CylinderShape({ cmd }: { cmd: Extract<DrawCommand, { shape: 'cylinder' }> }) {
  const geo = useMemo(() => new THREE.CylinderGeometry(cmd.radius, cmd.radius, cmd.height, 16), [cmd.radius, cmd.height])

  return (
    <mesh geometry={geo} position={cmd.pos}>
      <meshBasicMaterial
        color={toHex(cmd.color)}
        opacity={cmd.color[3] / 255}
        transparent
      />
    </mesh>
  )
}

function RayShape({ cmd }: { cmd: Extract<DrawCommand, { shape: 'ray' }> }) {
  return (
    <Line
      points={[cmd.start, cmd.end]}
      color={toHex(cmd.color)}
      lineWidth={cmd.width}
      transparent
      opacity={cmd.color[3] / 255}
    />
  )
}

function TextShape({ cmd }: { cmd: Extract<DrawCommand, { shape: 'text' }> }) {
  return (
    <Html position={cmd.pos} center style={{ pointerEvents: 'none' }}>
      <span style={{ color: toColor(cmd.color), fontSize: '10px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        {cmd.text}
      </span>
    </Html>
  )
}

export function DrawOverlays({ commands }: { commands: DrawCommand[] }) {
  if (!commands || commands.length === 0) return null

  return (
    <group>
      {commands.map((cmd, i) => {
        switch (cmd.shape) {
          case 'circle': return <CircleShape key={i} cmd={cmd} />
          case 'cylinder': return <CylinderShape key={i} cmd={cmd} />
          case 'ray': return <RayShape key={i} cmd={cmd} />
          case 'text': return <TextShape key={i} cmd={cmd} />
          default: return null // skip unknown shapes
        }
      })}
    </group>
  )
}
