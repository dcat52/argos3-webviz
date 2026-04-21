import { describe, test, expect, beforeEach } from 'vitest'
import { useRecordingStore, buildKeyframeCache, computeCacheInterval } from '@/stores/recordingStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { makeBroadcast, makeEntity, makeSchema, makeDelta } from '../helpers'
import type { ArgosrecFrame } from '@/protocol/argosrecParser'
import type { SchemaMessage, DeltaMessage } from '@/types/protocol'

beforeEach(() => {
  useRecordingStore.setState({
    state: 'idle', frames: [], argosrecFrames: [], argosrecHeader: null,
    argosrecWarnings: [], frameIndex: 0, totalFrames: 0, speed: 1,
    playing: false, isArgosrec: false, keyframeCache: [], cacheInterval: 200,
  })
  useExperimentStore.setState({
    entities: new Map(), prevEntities: new Map(), computedFields: new Map(),
    arena: null, drawCommands: [], floorData: null, userData: undefined,
  })
})

/** Build a sequence of argosrec frames: 1 schema + N-1 deltas */
function buildDeltaFrames(entityCount: number, totalFrames: number): ArgosrecFrame[] {
  const entities = Array.from({ length: entityCount }, (_, i) => makeEntity(`r${i}`, i, 0))
  const schema: ArgosrecFrame = {
    type: 'schema', step: 0,
    message: makeSchema(entities),
  }
  const frames: ArgosrecFrame[] = [schema]
  for (let i = 1; i < totalFrames; i++) {
    const delta: Record<string, Partial<typeof entities[0]>> = {}
    delta['r0'] = { position: { x: i * 0.1, y: 0, z: 0 } }
    frames.push({
      type: 'delta', step: i,
      message: makeDelta(delta, i),
    })
  }
  return frames
}

describe('computeCacheInterval', () => {
  test('returns 200 for small entity counts', () => {
    expect(computeCacheInterval(6)).toBe(200)
    expect(computeCacheInterval(50)).toBe(200)
    expect(computeCacheInterval(99)).toBe(200)
  })

  test('scales with entity count above 100', () => {
    expect(computeCacheInterval(200)).toBe(400)
    expect(computeCacheInterval(1000)).toBe(2000)
  })
})

describe('buildKeyframeCache', () => {
  test('returns empty for empty frames', () => {
    expect(buildKeyframeCache([], 200)).toEqual([])
  })

  test('caches frame 0 (schema)', () => {
    const frames = buildDeltaFrames(3, 10)
    const cache = buildKeyframeCache(frames, 5)
    expect(cache.length).toBe(2) // frame 0 and frame 5
    expect(cache[0].frameIndex).toBe(0)
    expect(cache[0].entities.size).toBe(3)
    expect(cache[1].frameIndex).toBe(5)
  })

  test('cached snapshots reflect accumulated deltas', () => {
    const frames = buildDeltaFrames(2, 10)
    const cache = buildKeyframeCache(frames, 5)
    // At frame 5, r0 should have position.x = 5 * 0.1 = 0.5
    const r0 = cache[1].entities.get('r0')!
    expect((r0 as any).position.x).toBeCloseTo(0.5)
  })

  test('snapshots are independent (deep cloned)', () => {
    const frames = buildDeltaFrames(2, 10)
    const cache = buildKeyframeCache(frames, 5)
    // Mutating cache[0] should not affect cache[1]
    cache[0].entities.get('r0')!.id = 'mutated'
    expect(cache[1].entities.get('r0')!.id).toBe('r0')
  })
})

describe('seekTo with keyframe cache', () => {
  test('seeks to exact frame using cache', () => {
    const frames = buildDeltaFrames(3, 20)
    const cache = buildKeyframeCache(frames, 5)

    useRecordingStore.setState({
      state: 'replaying', argosrecFrames: frames, totalFrames: frames.length,
      isArgosrec: true, keyframeCache: cache, cacheInterval: 5,
    })

    useRecordingStore.getState().seekTo(7)
    expect(useRecordingStore.getState().frameIndex).toBe(7)

    // r0 should have position.x = 7 * 0.1 = 0.7
    const entities = useExperimentStore.getState().entities
    const r0 = entities.get('r0')!
    expect((r0 as any).position.x).toBeCloseTo(0.7)
  })

  test('seek sets prevEntities from frame target-1', () => {
    const frames = buildDeltaFrames(2, 10)
    const cache = buildKeyframeCache(frames, 5)

    useRecordingStore.setState({
      state: 'replaying', argosrecFrames: frames, totalFrames: frames.length,
      isArgosrec: true, keyframeCache: cache, cacheInterval: 5,
    })

    useRecordingStore.getState().seekTo(6)
    const prev = useExperimentStore.getState().prevEntities
    const prevR0 = prev.get('r0')!
    // prevEntities should be from frame 5: position.x = 5 * 0.1 = 0.5
    expect((prevR0 as any).position.x).toBeCloseTo(0.5)
  })

  test('seek to frame 0 works', () => {
    const frames = buildDeltaFrames(2, 10)
    const cache = buildKeyframeCache(frames, 5)

    useRecordingStore.setState({
      state: 'replaying', argosrecFrames: frames, totalFrames: frames.length,
      isArgosrec: true, keyframeCache: cache, cacheInterval: 5,
    })

    useRecordingStore.getState().seekTo(0)
    expect(useRecordingStore.getState().frameIndex).toBe(0)
    expect(useExperimentStore.getState().entities.size).toBe(2)
  })

  test('seek pauses playback', () => {
    const frames = buildDeltaFrames(2, 10)
    const cache = buildKeyframeCache(frames, 5)

    useRecordingStore.setState({
      state: 'replaying', argosrecFrames: frames, totalFrames: frames.length,
      isArgosrec: true, keyframeCache: cache, cacheInterval: 5, playing: true,
    })

    useRecordingStore.getState().seekTo(3)
    expect(useRecordingStore.getState().playing).toBe(false)
  })

  test('seek out of bounds is ignored', () => {
    const frames = buildDeltaFrames(2, 10)
    useRecordingStore.setState({
      state: 'replaying', argosrecFrames: frames, totalFrames: frames.length,
      isArgosrec: true, keyframeCache: [], cacheInterval: 200, frameIndex: 5,
    })

    useRecordingStore.getState().seekTo(-1)
    expect(useRecordingStore.getState().frameIndex).toBe(5)

    useRecordingStore.getState().seekTo(100)
    expect(useRecordingStore.getState().frameIndex).toBe(5)
  })
})

describe('full-mode recordings skip cache', () => {
  test('seekTo works without cache for full-mode frames', () => {
    const entities = [makeEntity('r0', 0, 0), makeEntity('r1', 1, 1)]
    const frames: ArgosrecFrame[] = [
      { type: 'full', step: 0, message: makeBroadcast(entities, 0) },
      { type: 'full', step: 1, message: makeBroadcast([makeEntity('r0', 5, 5), makeEntity('r1', 6, 6)], 1) },
    ]

    useRecordingStore.setState({
      state: 'replaying', argosrecFrames: frames, totalFrames: frames.length,
      isArgosrec: true, keyframeCache: [], cacheInterval: 200,
    })

    useRecordingStore.getState().seekTo(1)
    expect(useRecordingStore.getState().frameIndex).toBe(1)
    const r0 = useExperimentStore.getState().entities.get('r0')!
    expect((r0 as any).position.x).toBe(5)
  })
})

describe('recording (unchanged behavior)', () => {
  test('captureFrame ignores when not recording', () => {
    useRecordingStore.getState().captureFrame(makeBroadcast([]))
    expect(useRecordingStore.getState().frames.length).toBe(0)
  })

  test('captureFrame stores frames when recording', () => {
    useRecordingStore.getState().startRecording()
    useRecordingStore.getState().captureFrame(makeBroadcast([makeEntity('r0')]))
    useRecordingStore.getState().captureFrame(makeBroadcast([makeEntity('r0', 1, 1)]))
    expect(useRecordingStore.getState().frames.length).toBe(2)
  })

  test('stopRecording sets totalFrames', () => {
    useRecordingStore.getState().startRecording()
    useRecordingStore.getState().captureFrame(makeBroadcast([]))
    useRecordingStore.getState().captureFrame(makeBroadcast([]))
    useRecordingStore.getState().captureFrame(makeBroadcast([]))
    useRecordingStore.getState().stopRecording()
    expect(useRecordingStore.getState().totalFrames).toBe(3)
    expect(useRecordingStore.getState().state).toBe('idle')
  })
})

describe('seekTo for live recordings', () => {
  test('sets frameIndex within bounds', () => {
    const frames = [
      { timestamp: 100, message: makeBroadcast([makeEntity('r0')]) },
      { timestamp: 200, message: makeBroadcast([makeEntity('r0', 1, 1)]) },
    ]
    useRecordingStore.getState().loadRecording(JSON.stringify(frames))
    useRecordingStore.getState().seekTo(1)
    expect(useRecordingStore.getState().frameIndex).toBe(1)
  })
})

describe('user_data accumulation during seek', () => {
  test('last user_data is carried through deltas', () => {
    const schema: ArgosrecFrame = {
      type: 'schema', step: 0,
      message: {
        type: 'schema',
        arena: { size: { x: 10, y: 10, z: 1 }, center: { x: 0, y: 0, z: 0.5 } },
        entities: [makeEntity('r0')],
        user_data: { _draw: [{ shape: 'circle', pos: [0, 0, 0], radius: 1, color: [1, 0, 0, 1], fill: true }] },
      } as SchemaMessage,
    }
    const delta1: ArgosrecFrame = {
      type: 'delta', step: 1,
      message: { type: 'delta', steps: 1, entities: { r0: { position: { x: 1, y: 0, z: 0 } } } } as DeltaMessage,
    }
    const delta2: ArgosrecFrame = {
      type: 'delta', step: 2,
      message: {
        type: 'delta', steps: 2, entities: { r0: { position: { x: 2, y: 0, z: 0 } } },
        user_data: { _draw: [{ shape: 'circle', pos: [1, 1, 0], radius: 2, color: [0, 1, 0, 1], fill: false }] },
      } as DeltaMessage,
    }
    const delta3: ArgosrecFrame = {
      type: 'delta', step: 3,
      message: { type: 'delta', steps: 3, entities: { r0: { position: { x: 3, y: 0, z: 0 } } } } as DeltaMessage,
    }

    const frames = [schema, delta1, delta2, delta3]
    const cache = buildKeyframeCache(frames, 200)

    useRecordingStore.setState({
      state: 'replaying', argosrecFrames: frames, totalFrames: frames.length,
      isArgosrec: true, keyframeCache: cache, cacheInterval: 200,
    })

    // Seek to frame 3 — should carry forward user_data from frame 2
    useRecordingStore.getState().seekTo(3)
    const draw = useExperimentStore.getState().drawCommands
    expect(draw.length).toBe(1)
    expect(draw[0].shape).toBe('circle')
    expect((draw[0] as any).radius).toBe(2)
  })
})
