import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperimentStore } from '@/stores/experimentStore'
import { useConnectionStore } from '@/stores/connectionStore'

export function useDrag() {
  const { camera, gl, scene } = useThree()
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  useEffect(() => {
    const canvas = gl.domElement
    let dragging = false
    let dragId: string | null = null
    let ctrlHeld = false

    const camRef = () => (window as any).__cameraControlsRef?.current

    const getMouseNDC = (e: PointerEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
    }

    const findEntityId = (hits: THREE.Intersection[]): string | null => {
      const entities = useExperimentStore.getState().entities
      for (const hit of hits) {
        if (hit.instanceId !== undefined) {
          const ids = (hit.object as any).userData?.entityIds as string[] | undefined
          if (ids?.[hit.instanceId] && entities.has(ids[hit.instanceId])) return ids[hit.instanceId]
        }
        let obj: THREE.Object3D | null = hit.object
        while (obj) {
          if (obj.name && entities.has(obj.name)) return obj.name
          obj = obj.parent
        }
      }
      return null
    }

    // Ctrl key toggles camera freeze
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' && !ctrlHeld) {
        ctrlHeld = true
        const c = camRef()
        if (c) c.enabled = false
        canvas.style.cursor = 'crosshair'
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        ctrlHeld = false
        if (!dragging) {
          const c = camRef()
          if (c) c.enabled = true
          canvas.style.cursor = ''
        }
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !ctrlHeld) return

      const mouse = getMouseNDC(e)
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      const id = findEntityId(hits)

      if (id) {
        dragId = id
        dragging = true
        useExperimentStore.getState().startDrag(id)
        e.stopPropagation()
        e.preventDefault()
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || !dragId) return
      const mouse = getMouseNDC(e)
      raycaster.setFromCamera(mouse, camera)
      const hit = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        useExperimentStore.getState().updateDragPosition({ x: hit.x, y: hit.y, z: 0 })
      }
    }

    const onPointerUp = () => {
      if (!dragging || !dragId) return
      const store = useExperimentStore.getState()
      const entity = store.entities.get(dragId)
      if (entity && 'position' in entity && 'orientation' in entity) {
        useConnectionStore.getState().moveEntity(dragId, entity.position, entity.orientation)
      }
      store.endDrag()
      dragging = false
      dragId = null
      if (!ctrlHeld) {
        const c = camRef()
        if (c) c.enabled = true
        canvas.style.cursor = ''
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      const c = camRef()
      if (c) c.enabled = true
      canvas.style.cursor = ''
    }
  }, [camera, gl, scene, groundPlane, raycaster])
}
