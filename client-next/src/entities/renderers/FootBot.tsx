import { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useSettingsStore } from '@/stores/settingsStore'
import { EntityRendererProps } from '../registry'
import { FootBotEntity } from '../../types/protocol'

function parseHex(hex: string): string {
  return '#' + hex.slice(2)
}

function parseRay(ray: string) {
  const [checked, startStr, endStr] = ray.split(':')
  const s = startStr.split(',').map(Number) as [number, number, number]
  const e = endStr.split(',').map(Number) as [number, number, number]
  return { hit: checked === 'true', start: s, end: e }
}

// Shared geometries
const baseGeo = new THREE.CylinderGeometry(0.0704, 0.0704, 0.053, 24)
const turretGeo = new THREE.CylinderGeometry(0.065, 0.068, 0.04, 24)
const turretCapGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.005, 24)
const wheelGeo = new THREE.BoxGeometry(0.015, 0.09, 0.04)
const gripperArmGeo = new THREE.BoxGeometry(0.035, 0.008, 0.025)
const scannerRingGeo = new THREE.TorusGeometry(0.075, 0.004, 8, 32)
const ledGeo = new THREE.SphereGeometry(0.006, 12, 12)
const beaconGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.02, 16)

export function FootBot({ entity, selected, ghost, tier, onClick, onDoubleClick, onPointerDown, overrideColor }: EntityRendererProps) {
  const e = entity as FootBotEntity
  const { position: p, orientation: q } = e
  const t = tier ?? 2

  const alpha = ghost ? 0.3 : 1
  // QT-OpenGL: white plastic body, blue circuit board top
  const bodyColor = overrideColor ?? (ghost ? '#64C8FF' : (selected ? '#aabbdd' : '#e8e8ec'))
  const boardColor = ghost ? '#64C8FF' : '#2244cc'

  const leds = useMemo(() =>
    e.leds.map((hex, i) => {
      const angle = (i / 12) * Math.PI * 2
      return { color: parseHex(hex), x: Math.cos(angle) * 0.075, y: Math.sin(angle) * 0.075, z: 0.074 }
    }), [e.leds])

  const rays = useMemo(() => t >= 3 ? e.rays.map(parseRay) : [], [e.rays, t])

  return (
    <group position={[p.x, p.y, p.z]} quaternion={[q.x, q.y, q.z, q.w]} onClick={onClick} onDoubleClick={onDoubleClick} onPointerDown={onPointerDown}>
      {/* Tier 1+: Base body — white plastic */}
      <mesh geometry={baseGeo} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color={bodyColor} metalness={0.0} roughness={0.3} clearcoat={ghost ? 0 : 0.4} transparent={ghost} opacity={alpha} depthWrite={!ghost} />
      </mesh>

      {/* Tier 1+: LEDs */}
      {leds.map((led, i) => (
        <mesh key={i} geometry={ledGeo} position={[led.x, led.y, led.z]}>
          <meshStandardMaterial color={led.color} emissive={led.color} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}

      {/* Tier 2+: Detailed model */}
      {t >= 2 && <>
        {/* Wheels — black tire */}
        <mesh geometry={wheelGeo} position={[0.072, 0, 0.0]} castShadow>
          <meshPhysicalMaterial color="#111" metalness={0.0} roughness={0.95} transparent={ghost} opacity={alpha} depthWrite={!ghost} />
        </mesh>
        <mesh geometry={wheelGeo} position={[-0.072, 0, 0.0]} castShadow>
          <meshPhysicalMaterial color="#111" metalness={0.0} roughness={0.95} transparent={ghost} opacity={alpha} depthWrite={!ghost} />
        </mesh>
        {/* Turret — white plastic */}
        <mesh geometry={turretGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.045]} castShadow>
          <meshPhysicalMaterial color={ghost ? bodyColor : '#e0e0e4'} metalness={0.0} roughness={0.3} transparent={ghost} opacity={alpha} depthWrite={!ghost} />
        </mesh>
        {/* Turret cap — blue circuit board */}
        <mesh geometry={turretCapGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.067]}>
          <meshPhysicalMaterial color={boardColor} metalness={0.1} roughness={0.5} transparent={ghost} opacity={alpha} depthWrite={!ghost} />
        </mesh>
        {/* Gripper arms — gray metal */}
        <mesh geometry={gripperArmGeo} position={[0.02, 0.075, 0.01]}>
          <meshPhysicalMaterial color="#999" metalness={0.3} roughness={0.4} transparent={ghost} opacity={alpha} depthWrite={!ghost} />
        </mesh>
        <mesh geometry={gripperArmGeo} position={[-0.02, 0.075, 0.01]}>
          <meshPhysicalMaterial color="#999" metalness={0.3} roughness={0.4} transparent={ghost} opacity={alpha} depthWrite={!ghost} />
        </mesh>
        {/* Distance scanner ring — white */}
        <mesh geometry={scannerRingGeo} position={[0, 0, 0.053]}>
          <meshPhysicalMaterial color="#ddd" metalness={0.0} roughness={0.3} transparent={ghost} opacity={alpha} depthWrite={!ghost} />
        </mesh>
        {/* Beacon — small cylinder on top */}
        <mesh geometry={beaconGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.08]}>
          <meshPhysicalMaterial color={boardColor} metalness={0.0} roughness={0.4} transparent={ghost} opacity={alpha} depthWrite={!ghost} />
        </mesh>
      </>}

      {/* Tier 3: Debug — sensor rays */}
      {rays.map((ray, i) => (
        <Line
          key={`ray-${i}`}
          points={[ray.start, ray.end]}
          color={ray.hit ? useSettingsStore.getState().rayHitColor : useSettingsStore.getState().rayMissColor}
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
    </group>
  )
}
