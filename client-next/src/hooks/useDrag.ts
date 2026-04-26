import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperimentStore } from '@/stores/experimentStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { usePlacementStore, setDragStartScreen, isDragAboveThreshold } from '@/stores/placementStore'
import { useInteractionStore } from '@/stores/interactionStore'

const camCtrl = () => (globalThis as any).__cameraControlsRef?.current

function enableCamera(enabled: boolean) {
  const c = camCtrl()
  if (c) c.enabled = enabled
}

export function useDrag() {
  const { camera, gl, scene } = useThree()
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  useEffect(() => {
    const canvas = gl.domElement
    let dragging = false
    let rotating = false
    let dragId: string | null = null

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

    const updateCursor = () => {
      const mode = useInteractionStore.getState().mode
      const placement = usePlacementStore.getState()
      if (mode === 'place' && placement.active) {
        canvas.style.cursor = 'copy'
      } else if (rotating) {
        canvas.style.cursor = 'alias'
      } else if (dragging) {
        canvas.style.cursor = 'grabbing'
      } else {
        canvas.style.cursor = ''
      }
    }

    const updateCamera = () => {
      const mode = useInteractionStore.getState().mode
      const placement = usePlacementStore.getState()
      if (dragging || rotating || (mode === 'place' && placement.active)) {
        enableCamera(false)
      } else {
        enableCamera(true)
      }
    }

    const DRAG_THRESHOLD = 5 // pixels before click becomes drag
    let pendingEntityId: string | null = null
    let downX = 0, downY = 0
    let altHeldOnDown = false

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const mode = useInteractionStore.getState().mode

      // Place mode: press to set position, drag to aim, release to spawn
      if (mode === 'place') {
        const placement = usePlacementStore.getState()
        if (!placement.active) return
        const hit = groundHit(e)
        if (hit) {
          setDragStartScreen(e.clientX, e.clientY)
          usePlacementStore.getState().beginDrag({ x: hit.x, y: hit.y, z: 0 })
        }
        e.stopPropagation()
        e.preventDefault()
        return
      }

      // Select mode: record pointer down position and entity under cursor
      downX = e.clientX
      downY = e.clientY
      altHeldOnDown = e.altKey
      pendingEntityId = findEntityId(e)
      // Don't start drag yet — wait for movement threshold
    }

    const onPointerMove = (e: PointerEvent) => {
      const mode = useInteractionStore.getState().mode

      // Ghost cursor + drag-to-aim in place mode
      if (mode === 'place') {
        const placement = usePlacementStore.getState()
        if (placement.active) {
          if (placement.dragging) {
            if (isDragAboveThreshold(e.clientX, e.clientY)) {
              const hit = groundHit(e)
              if (hit) usePlacementStore.getState().updateDrag({ x: hit.x, y: hit.y, z: 0 })
            }
          } else {
            const hit = groundHit(e)
            if (hit) placement.updateCursor({ x: hit.x, y: hit.y, z: 0 })
          }
        }
      }

      // Pending entity drag/rotate: start once threshold exceeded
      if (!dragging && !rotating && pendingEntityId) {
        const dx = e.clientX - downX, dy = e.clientY - downY
        if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
          dragId = pendingEntityId
          if (altHeldOnDown) {
            rotating = true
          } else {
            dragging = true
          }
          useExperimentStore.getState().startDrag(dragId)
          enableCamera(false)
          updateCursor()
          pendingEntityId = null
        }
      }

      // Active drag: update position
      if (dragging && dragId) {
        const hit = groundHit(e)
        if (hit) useExperimentStore.getState().updateDragPosition({ x: hit.x, y: hit.y, z: 0 })
      }

      // Active rotate: compute angle from entity center to cursor
      if (rotating && dragId) {
        const hit = groundHit(e)
        const entity = useExperimentStore.getState().entities.get(dragId)
        if (hit && entity && 'position' in entity) {
          const angle = Math.atan2(hit.y - entity.position.y, hit.x - entity.position.x)
          const halfAngle = angle / 2
          useExperimentStore.getState().updateDragOrientation({
            x: 0, y: 0, z: Math.sin(halfAngle), w: Math.cos(halfAngle)
          })
        }
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      // Place mode: release to spawn with orientation
      const mode = useInteractionStore.getState().mode
      if (mode === 'place') {
        const placement = usePlacementStore.getState()
        if (placement.dragging && placement.config) {
          const result = usePlacementStore.getState().endDrag()
          if (result) {
            const config = placement.config
            useConnectionStore.getState().addEntity({
              type: config.type,
              id_prefix: config.id_prefix ?? config.type,
              position: result.position,
              orientation: result.orientation,
              controller: config.controller,
              size: config.size,
              movable: config.movable,
              mass: config.mass,
              radius: config.radius,
              height: config.height,
            })
          }
        }
        return
      }

      // Entity drag/rotate release: commit to server
      if ((dragging || rotating) && dragId) {
        const store = useExperimentStore.getState()
        const entity = store.entities.get(dragId)
        if (entity && 'position' in entity && 'orientation' in entity) {
          useConnectionStore.getState().moveEntity(dragId, entity.position, entity.orientation)
        }
        store.endDrag()
        dragging = false
        rotating = false
        dragId = null
        pendingEntityId = null
        enableCamera(true)
        updateCursor()
        return
      }

      // Click (no drag): select entity or deselect
      if (pendingEntityId) {
        useExperimentStore.getState().selectEntity(pendingEntityId)
      } else {
        // Clicked empty ground — deselect
        const dx = e.clientX - downX, dy = e.clientY - downY
        if (dx * dx + dy * dy <= DRAG_THRESHOLD * DRAG_THRESHOLD) {
          useExperimentStore.getState().selectEntity(null)
        }
      }
      pendingEntityId = null
    }

    // React to store changes
    const unsub1 = useInteractionStore.subscribe(() => { updateCamera(); updateCursor() })
    const unsub2 = usePlacementStore.subscribe(() => { updateCamera(); updateCursor() })

    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      unsub1(); unsub2()
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      enableCamera(true)
      canvas.style.cursor = ''
    }
  }, [camera, gl, scene, groundPlane, raycaster])
}
