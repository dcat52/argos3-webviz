import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperimentStore } from '@/stores/experimentStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useCameraStore } from '@/stores/cameraStore'

export function useDrag() {
  const { camera, gl } = useThree()
  const dragEntityId = useExperimentStore((s) => s.dragEntityId)
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])

  useEffect(() => {
    if (!dragEntityId) return

    const canvas = gl.domElement
    const cameraRef = useCameraStore.getState().cameraControlsRef
    if (cameraRef?.current) cameraRef.current.enabled = false

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const hit = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        useExperimentStore.getState().updateDragPosition({ x: hit.x, y: hit.y, z: 0 })
      }
    }

    const onUp = () => {
      const store = useExperimentStore.getState()
      const entity = store.entities.get(dragEntityId)
      if (entity && 'position' in entity && 'orientation' in entity) {
        useConnectionStore.getState().moveEntity(
          dragEntityId,
          entity.position,
          entity.orientation
        )
      }
      store.endDrag()
      const ref = useCameraStore.getState().cameraControlsRef
      if (ref?.current) ref.current.enabled = true
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      const ref = useCameraStore.getState().cameraControlsRef
      if (ref?.current) ref.current.enabled = true
    }
  }, [dragEntityId, camera, gl, groundPlane])
}
