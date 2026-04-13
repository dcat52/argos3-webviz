import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useShallow } from 'zustand/shallow'
import { useExperimentStore } from '../stores/experimentStore'
import { useCameraStore } from '../stores/cameraStore'
import { EntityRenderer } from '../entities/EntityRenderer'
import { SelectionRing } from './SelectionRing'
import type { AnyEntity, BaseEntity } from '../types/protocol'

const INSTANCED_TYPES = new Set(['kheperaiv', 'foot-bot'])
const BODY_PARAMS: Record<string, { radius: number; height: number; color: string }> = {
  'kheperaiv': { radius: 0.07, height: 0.054, color: '#2a3a4a' },
  'foot-bot': { radius: 0.085, height: 0.146, color: '#2a2a3a' },
}

const _obj = new THREE.Object3D()
const _color = new THREE.Color()
const _q = new THREE.Quaternion()
const _euler = new THREE.Euler(Math.PI / 2, 0, 0)
const _bodyRot = new THREE.Quaternion().setFromEuler(_euler)

interface Props {
  colorMap: Map<string, string>
}

function InstancedGroup({ type, entities, colorMap }: { type: string; entities: BaseEntity[]; colorMap: Map<string, string> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { selectedEntityId, selectEntity } = useExperimentStore(
    useShallow((s) => ({ selectedEntityId: s.selectedEntityId, selectEntity: s.selectEntity }))
  )
  const flyTo = useCameraStore((s) => s.flyTo)
  const params = BODY_PARAMS[type]

  const geo = useMemo(() => new THREE.CylinderGeometry(params.radius, params.radius, params.height, 16), [params])
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ metalness: 0.1, roughness: 0.6 }), [])

  // Filter out selected entity for individual rendering
  const selectedEntity = useMemo(() =>
    entities.find((e) => e.id === selectedEntityId),
    [entities, selectedEntityId]
  )
  const instanced = useMemo(() =>
    entities.filter((e) => e.id !== selectedEntityId),
    [entities, selectedEntityId]
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < instanced.length; i++) {
      const e = instanced[i]
      _q.set(e.orientation.x, e.orientation.y, e.orientation.z, e.orientation.w)
      _obj.position.set(e.position.x, e.position.y, e.position.z)
      _obj.quaternion.copy(_q).multiply(_bodyRot)
      _obj.updateMatrix()
      mesh.setMatrixAt(i, _obj.matrix)
      const c = colorMap.get(e.id) ?? params.color
      mesh.setColorAt(i, _color.set(c))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  // Map instanceId -> entity for click handling
  const idxMap = useRef<BaseEntity[]>([])
  useEffect(() => { idxMap.current = instanced }, [instanced])

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geo, mat, instanced.length]}
        castShadow
        receiveShadow
        onClick={(e) => {
          if (e.instanceId !== undefined && idxMap.current[e.instanceId]) {
            selectEntity(idxMap.current[e.instanceId].id)
          }
        }}
        onDoubleClick={(e) => {
          if (e.instanceId !== undefined && idxMap.current[e.instanceId]) {
            const ent = idxMap.current[e.instanceId]
            flyTo([ent.position.x, ent.position.y, ent.position.z])
          }
        }}
      />
      {selectedEntity && (
        <group key={selectedEntity.id}>
          <EntityRenderer
            entity={selectedEntity as AnyEntity}
            selected
            onClick={() => selectEntity(selectedEntity.id)}
            onDoubleClick={() => flyTo([selectedEntity.position.x, selectedEntity.position.y, selectedEntity.position.z])}
            overrideColor={colorMap.get(selectedEntity.id)}
          />
          <group position={[selectedEntity.position.x, selectedEntity.position.y, selectedEntity.position.z]}>
            <SelectionRing />
          </group>
        </group>
      )}
    </>
  )
}

export function InstancedEntities({ colorMap }: Props) {
  const entities = useExperimentStore((s) => s.entities)

  const grouped = useMemo(() => {
    const groups = new Map<string, BaseEntity[]>()
    for (const e of entities.values()) {
      if (!INSTANCED_TYPES.has(e.type) || !('position' in e)) continue
      const arr = groups.get(e.type) ?? []
      arr.push(e as BaseEntity)
      groups.set(e.type, arr)
    }
    return groups
  }, [entities])

  return (
    <>
      {Array.from(grouped.entries()).map(([type, ents]) =>
        ents.length === 1 ? (
          <group key={type}>
            <EntityRenderer entity={ents[0] as AnyEntity} />
          </group>
        ) : (
          <InstancedGroup key={type} type={type} entities={ents} colorMap={colorMap} />
        )
      )}
    </>
  )
}
