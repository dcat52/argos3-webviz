import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperimentStore } from '@/stores/experimentStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { usePlacementStore } from '@/stores/placementStore'
import { useInteractionStore } from '@/stores/interactionStore'

export function useDrag() {
  const { camera, gl, scene } = useThree()
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  useEffect(() => {
    const canvas = gl.domElement
    let dragging = false
    let dragId: string | null = null
    let ctrlHeld = false

    const camRef = () => (globalThis as any).__cameraControlsRef?.current

    const groundHit = (e: PointerEvent | MouseEvent): THREE.Vector3 | null => {
      const rect = canvas.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(mouse, camera)
      const hit = new THREE.Vector3()
      return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null
    }

    const findEntityId = (e: PointerEvent): string | null => {
      const rect = canvas.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
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

    // --- Ctrl key for drag in select mode ---
    const onKeyDown = (e: KeyboardEvent) => {
      const mode = useInteractionStore.getState().mode
      if (mode !== 'select') return
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
      if (e.button !== 0) return
      const mode = useInteractionStore.getState().mode

      // SELECT mode: ctrl+click to drag entities
      if (mode === 'select' && ctrlHeld) {
        const id = findEntityId(e)
        if (id) {
          dragId = id
          dragging = true
          useExperimentStore.getState().startDrag(id)
          e.stopPropagation()
          e.preventDefault()
        }
        return
      }

      // PLACE mode: click to place entity
      if (mode === 'place') {
        const placement = usePlacementStore.getState()
        if (!placement.active) return
        const hit = groundHit(e)
        if (hit && placement.config) {
          const config = placement.config
          useConnectionStore.getState().addEntity({
            type: config.type,
            id_prefix: config.id_prefix ?? config.type,
            position: { x: hit.x, y: hit.y, z: 0 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
            controller: config.controller,
            size: config.size,
            movable: config.movable,
            mass: config.mass,
            radius: config.radius,
            height: config.height,
          })
        }
        e.stopPropagation()
        e.preventDefault()
        return
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const mode = useInteractionStore.getState().mode

      // Update ghost cursor in place mode
      if (mode === 'place') {
        const placement = usePlacementStore.getState()
        if (placement.active) {
          const hit = groundHit(e)
          if (hit) placement.updateCursor({ x: hit.x, y: hit.y, z: 0 })
        }
      }

      // Drag in select mode
      if (dragging && dragId) {
        const hit = groundHit(e)
        if (hit) {
          useExperimentStore.getState().updateDragPosition({ x: hit.x, y: hit.y, z: 0 })
        }
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

    // Mode change: update cursor and camera
    const unsub = useInteractionStore.subscribe((state) => {
      if (state.mode === 'place' && usePlacementStore.getState().active) {
        canvas.style.cursor = 'copy'
        const c = camRef()
        if (c) c.enabled = false
      } else if (state.mode === 'select') {
        canvas.style.cursor = ''
        const c = camRef()
        if (c && !ctrlHeld) c.enabled = true
      } else if (state.mode === 'distribute') {
        canvas.style.cursor = ''
        const c = camRef()
        if (c) c.enabled = true
      }
    })

    const unsubPlace = usePlacementStore.subscribe((state) => {
      const iMode = useInteractionStore.getState().mode
      if (iMode === 'place') {
        canvas.style.cursor = state.active ? 'copy' : ''
        const c = camRef()
        if (c) c.enabled = !state.active
      }
    })

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      unsub()
      unsubPlace()
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
