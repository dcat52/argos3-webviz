import { describe, it, expect, beforeEach } from 'vitest'
import { useExperimentStore } from '@/stores/experimentStore'
import { ExperimentState } from '@/types/protocol'

describe('delta removal handling', () => {
  beforeEach(() => {
    useExperimentStore.setState({
      entities: new Map([
        ['fb0', { type: 'foot-bot', id: 'fb0', position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, leds: [], rays: [], points: [] } as any],
        ['fb1', { type: 'foot-bot', id: 'fb1', position: { x: 1, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, leds: [], rays: [], points: [] } as any],
        ['b0', { type: 'box', id: 'b0', position: { x: 2, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 0.3, y: 0.3, z: 0.3 }, is_movable: true } as any],
      ]),
      prevEntities: new Map(),
      state: ExperimentState.EXPERIMENT_PLAYING,
    })
  })

  it('removes entities listed in removed array', () => {
    useExperimentStore.getState().applyDelta({
      type: 'delta',
      entities: {},
      removed: ['fb1', 'b0'],
    })
    const entities = useExperimentStore.getState().entities
    expect(entities.has('fb0')).toBe(true)
    expect(entities.has('fb1')).toBe(false)
    expect(entities.has('b0')).toBe(false)
    expect(entities.size).toBe(1)
  })

  it('handles delta with no removed field', () => {
    useExperimentStore.getState().applyDelta({
      type: 'delta',
      entities: {},
    })
    expect(useExperimentStore.getState().entities.size).toBe(3)
  })

  it('handles simultaneous changes and removals', () => {
    useExperimentStore.getState().applyDelta({
      type: 'delta',
      entities: { fb0: { position: { x: 5, y: 5, z: 0 } } },
      removed: ['b0'],
    })
    const entities = useExperimentStore.getState().entities
    expect(entities.size).toBe(2)
    expect(entities.get('fb0')!.position).toEqual({ x: 5, y: 5, z: 0 })
    expect(entities.has('b0')).toBe(false)
  })
})

describe('drag state', () => {
  beforeEach(() => {
    useExperimentStore.setState({
      entities: new Map([
        ['b0', { type: 'box', id: 'b0', position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 0.3, y: 0.3, z: 0.3 }, is_movable: true } as any],
      ]),
      dragEntityId: null,
      selectedEntityId: null,
    })
  })

  it('startDrag sets dragEntityId and selects entity', () => {
    useExperimentStore.getState().startDrag('b0')
    expect(useExperimentStore.getState().dragEntityId).toBe('b0')
    expect(useExperimentStore.getState().selectedEntityId).toBe('b0')
  })

  it('endDrag clears dragEntityId', () => {
    useExperimentStore.getState().startDrag('b0')
    useExperimentStore.getState().endDrag()
    expect(useExperimentStore.getState().dragEntityId).toBeNull()
  })

  it('updateDragPosition updates entity position locally', () => {
    useExperimentStore.getState().startDrag('b0')
    useExperimentStore.getState().updateDragPosition({ x: 3, y: 4, z: 0 })
    const entity = useExperimentStore.getState().entities.get('b0')!
    expect(entity.position).toEqual({ x: 3, y: 4, z: 0 })
  })

  it('updateDragPosition does nothing without active drag', () => {
    useExperimentStore.getState().updateDragPosition({ x: 3, y: 4, z: 0 })
    const entity = useExperimentStore.getState().entities.get('b0')!
    expect(entity.position).toEqual({ x: 0, y: 0, z: 0 })
  })
})
