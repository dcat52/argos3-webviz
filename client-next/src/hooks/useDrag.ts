import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperimentStore } from '@/stores/experimentStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { usePlacementStore } from '@/stores/placementStore'

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

    const groundHit = (e: PointerEvent | MouseEvent): THREE.Vector3 | null => {
      const mouse = getMouseNDC(e)
      raycaster.setFromCamera(mouse, camera)
      const hit = new THREE.Vector3()
      return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null
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

    // --- Placement mode handlers ---
    const onPlacementMove = (e: PointerEvent) => {
      const placement = usePlacementStore.getState()
      if (!placement.active) return
      const hit = groundHit(e)
      if (hit) placement.updateCursor({ x: hit.x, y: hit.y, z: 0 })
    }

    const onPlacementClick = (e: MouseEvent) => {
      const placement = usePlacementStore.getState()
      if (!placement.active || e.button !== 0) return

      const config = placement.config
      const pos = placement.confirmPlacement()
      if (pos && config) {
        useConnectionStore.getState().addEntity({
          type: config.type,
          id_prefix: config.id_prefix ?? config.type,
          position: pos,
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
    }

    const onPlacementEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && usePlacementStore.getState().active) {
        usePlacementStore.getState().cancelPlacement()
        canvas.style.cursor = ''
      }
    }

    // --- Ctrl+drag handlers ---
    const onKeyDown = (e: KeyboardEvent) => {
      if (usePlacementStore.getState().active) return
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
      // Placement mode takes priority
      if (usePlacementStore.getState().active) return

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
      // Placement cursor tracking
      onPlacementMove(e)

      if (!dragging || !dragId) return
      const hit = groundHit(e)
      if (hit) {
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

    // Subscribe to placement mode changes for cursor style
    const unsub = usePlacementStore.subscribe((state) => {
      canvas.style.cursor = state.active ? 'copy' : ''
      const c = camRef()
      if (c) c.enabled = !state.active
    })

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('keydown', onPlacementEsc)
    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('click', onPlacementClick, true)

    return () => {
      unsub()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('keydown', onPlacementEsc)
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('click', onPlacementClick, true)
      const c = camRef()
      if (c) c.enabled = true
      canvas.style.cursor = ''
    }
  }, [camera, gl, scene, groundPlane, raycaster])
}
