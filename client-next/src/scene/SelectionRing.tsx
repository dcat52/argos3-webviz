import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSettingsStore } from '@/stores/settingsStore'

export function SelectionRing() {
  const ref = useRef<THREE.Mesh>(null)
  const color = useSettingsStore((s) => s.selectionColor)
  const opacity = useSettingsStore((s) => s.selectionOpacity)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 1.5
  })
  return (
    <mesh ref={ref} rotation={[0, 0, 0]} position={[0, 0, 0.002]}>
      <ringGeometry args={[0.12, 0.14, 48]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  )
}
