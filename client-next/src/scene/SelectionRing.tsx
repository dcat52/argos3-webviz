import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function SelectionRing() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 1.5
  })
  return (
    <mesh ref={ref} rotation={[0, 0, 0]} position={[0, 0, 0.002]}>
      <ringGeometry args={[0.12, 0.14, 48]} />
      <meshBasicMaterial color="#44aaff" transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  )
}
