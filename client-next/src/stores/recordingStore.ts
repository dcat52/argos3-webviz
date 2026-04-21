import { create } from 'zustand'
import type { BroadcastMessage, SchemaMessage, DeltaMessage, AnyEntity, ArenaInfo } from '../types/protocol'
import { useExperimentStore } from './experimentStore'
import { useConnectionStore } from './connectionStore'
import { computeFields } from '../lib/computedFields'
import { parseArgosrec, type ArgosrecHeader, type ArgosrecFrame } from '../protocol/argosrecParser'

interface RecordedFrame {
  timestamp: number
  message: BroadcastMessage
}

type RecordingState = 'idle' | 'recording' | 'replaying'

export interface KeyframeSnapshot {
  frameIndex: number
  entities: Map<string, AnyEntity>
  arena: ArenaInfo | null
  userData: unknown
}

interface RecordingStore {
  state: RecordingState
  frames: RecordedFrame[]
  argosrecFrames: ArgosrecFrame[]
  argosrecHeader: ArgosrecHeader | null
  argosrecWarnings: string[]
  frameIndex: number
  totalFrames: number
  speed: number
  playing: boolean
  isArgosrec: boolean
  keyframeCache: KeyframeSnapshot[]
  cacheInterval: number

  startRecording: () => void
  stopRecording: () => void
  captureFrame: (msg: BroadcastMessage) => void
  downloadRecording: () => void
  loadRecording: (json: string) => void
  loadArgosrecFile: (file: File) => Promise<void>
  startReplay: () => void
  stopReplay: () => void
  togglePlayPause: () => void
  setSpeed: (s: number) => void
  seekTo: (idx: number) => void
}

let rafId: number | null = null
let savedUrl: string | null = null
let replayStart: number | null = null

function stopLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  replayStart = null
}

/** Apply an argosrec frame to the experiment store (used during normal playback) */
function applyArgosrecFrame(frame: ArgosrecFrame) {
  const store = useExperimentStore.getState()
  switch (frame.type) {
    case 'schema':
      store.applySchema(frame.message as SchemaMessage)
      break
    case 'delta':
      store.applyDelta(frame.message as DeltaMessage)
      break
    case 'full':
      store.applyBroadcast(frame.message as BroadcastMessage)
      break
  }
}

/** Check if a recording needs keyframe caching (has delta frames) */
function needsCache(frames: ArgosrecFrame[]): boolean {
  return frames.some(f => f.type === 'delta')
}

/** Compute adaptive cache interval based on entity count */
export function computeCacheInterval(entityCount: number): number {
  return Math.max(200, entityCount * 2)
}

/**
 * Build keyframe cache by replaying frames into a local Map.
 * Does NOT touch the experiment store — pure computation.
 */
export function buildKeyframeCache(
  frames: ArgosrecFrame[],
  interval: number,
): KeyframeSnapshot[] {
  if (frames.length === 0) return []

  const cache: KeyframeSnapshot[] = []
  let entities = new Map<string, AnyEntity>()
  let arena: ArenaInfo | null = null
  let userData: unknown = undefined

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]

    switch (frame.type) {
      case 'schema': {
        const msg = frame.message as SchemaMessage
        entities = new Map<string, AnyEntity>()
        for (const e of msg.entities) entities.set(e.id, e)
        arena = msg.arena
        if (msg.user_data !== undefined) userData = msg.user_data
        break
      }
      case 'delta': {
        const msg = frame.message as DeltaMessage
        for (const [id, changes] of Object.entries(msg.entities)) {
          const existing = entities.get(id)
          if (existing) {
            entities.set(id, { ...existing, ...changes } as AnyEntity)
          } else {
            entities.set(id, changes as AnyEntity)
          }
        }
        if (msg.arena) arena = msg.arena
        if (msg.user_data !== undefined) userData = msg.user_data
        break
      }
      case 'full': {
        const msg = frame.message as BroadcastMessage
        entities = new Map<string, AnyEntity>()
        for (const e of msg.entities) entities.set(e.id, e)
        arena = msg.arena
        if (msg.user_data !== undefined) userData = msg.user_data
        break
      }
    }

    if (i % interval === 0) {
      cache.push({
        frameIndex: i,
        entities: structuredClone(entities),
        arena: arena ? structuredClone(arena) : null,
        userData: userData !== undefined ? structuredClone(userData) : undefined,
      })
    }
  }

  return cache
}

/**
 * Optimized seek: restore from nearest keyframe, replay forward without
 * calling computeFields on intermediate frames. Only one setState at the end.
 */
function optimizedSeek(
  frames: ArgosrecFrame[],
  cache: KeyframeSnapshot[],
  targetIdx: number,
) {
  // Find nearest cached snapshot <= targetIdx
  let snapshot: KeyframeSnapshot | null = null
  for (let i = cache.length - 1; i >= 0; i--) {
    if (cache[i].frameIndex <= targetIdx) {
      snapshot = cache[i]
      break
    }
  }

  let entities: Map<string, AnyEntity>
  let arena: ArenaInfo | null
  let userData: unknown
  let startFrom: number

  if (snapshot) {
    entities = structuredClone(snapshot.entities)
    arena = snapshot.arena ? structuredClone(snapshot.arena) : null
    userData = snapshot.userData
    startFrom = snapshot.frameIndex + 1
  } else {
    // No cache hit — start from frame 0
    entities = new Map()
    arena = null
    userData = undefined
    startFrom = 0
  }

  // Replay forward to target, tracking prevEntities at target-1
  let prevEntities = new Map(entities)

  for (let i = startFrom; i <= targetIdx; i++) {
    if (i === targetIdx) {
      prevEntities = new Map(entities)
    }
    const frame = frames[i]
    switch (frame.type) {
      case 'schema': {
        const msg = frame.message as SchemaMessage
        entities = new Map<string, AnyEntity>()
        for (const e of msg.entities) entities.set(e.id, e)
        arena = msg.arena
        if (msg.user_data !== undefined) userData = msg.user_data
        break
      }
      case 'delta': {
        const msg = frame.message as DeltaMessage
        for (const [id, changes] of Object.entries(msg.entities)) {
          const existing = entities.get(id)
          if (existing) {
            entities.set(id, { ...existing, ...changes } as AnyEntity)
          } else {
            entities.set(id, changes as AnyEntity)
          }
        }
        if (msg.arena) arena = msg.arena
        if (msg.user_data !== undefined) userData = msg.user_data
        break
      }
      case 'full': {
        const msg = frame.message as BroadcastMessage
        entities = new Map<string, AnyEntity>()
        for (const e of msg.entities) entities.set(e.id, e)
        arena = msg.arena
        if (msg.user_data !== undefined) userData = msg.user_data
        break
      }
    }
  }

  // Extract draw commands and floor data from userData
  const drawCommands = extractDraw(userData)
  const floorData = extractFloor(userData)

  // Single setState with computeFields only on the final frame
  useExperimentStore.setState({
    entities,
    prevEntities,
    arena,
    computedFields: computeFields(entities, prevEntities, arena),
    drawCommands,
    floorData,
    userData,
  })
}

function extractDraw(userData: unknown): import('../types/protocol').DrawCommand[] {
  if (!userData || typeof userData !== 'object') return []
  const ud = userData as Record<string, unknown>
  if (!Array.isArray(ud._draw)) return []
  return ud._draw.filter((c: unknown) => c && typeof c === 'object' && 'shape' in (c as object)) as import('../types/protocol').DrawCommand[]
}

function extractFloor(userData: unknown): import('../types/protocol').FloorColorGrid | null {
  if (!userData || typeof userData !== 'object') return null
  const ud = userData as Record<string, unknown>
  const f = ud._floor as import('../types/protocol').FloorColorGrid | undefined
  if (!f || !f.resolution || !f.colors) return null
  return f
}

function playLoop() {
  stopLoop()
  const tick = (now: number) => {
    const s = useRecordingStore.getState()
    if (!s.playing || s.state !== 'replaying') return

    if (replayStart === null) replayStart = now

    if (s.isArgosrec) {
      const elapsed = (now - replayStart) / 1000 * s.speed * 10
      const targetIdx = Math.min(Math.floor(elapsed), s.argosrecFrames.length - 1)

      if (targetIdx > s.frameIndex) {
        // During playback, apply frames sequentially (they're consecutive)
        for (let i = s.frameIndex + 1; i <= targetIdx; i++) {
          applyArgosrecFrame(s.argosrecFrames[i])
        }
        useRecordingStore.setState({ frameIndex: targetIdx })
      }

      if (targetIdx >= s.argosrecFrames.length - 1) {
        useRecordingStore.setState({ playing: false })
        return
      }
    } else {
      const elapsed = (now - replayStart) * s.speed
      const baseTime = s.frames[0]?.timestamp ?? 0

      let idx = s.frameIndex
      while (idx < s.frames.length - 1 && (s.frames[idx + 1].timestamp - baseTime) <= elapsed) {
        idx++
      }

      if (idx !== s.frameIndex) {
        useRecordingStore.setState({ frameIndex: idx })
        useExperimentStore.getState().applyBroadcast(s.frames[idx].message)
      }

      if (idx >= s.frames.length - 1) {
        useRecordingStore.setState({ playing: false })
        return
      }
    }

    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  state: 'idle',
  frames: [],
  argosrecFrames: [],
  argosrecHeader: null,
  argosrecWarnings: [],
  frameIndex: 0,
  totalFrames: 0,
  speed: 1,
  playing: false,
  isArgosrec: false,
  keyframeCache: [],
  cacheInterval: 200,

  startRecording: () => set({ state: 'recording', frames: [], argosrecFrames: [], frameIndex: 0, totalFrames: 0, isArgosrec: false, keyframeCache: [], cacheInterval: 200 }),

  stopRecording: () => {
    const { frames } = get()
    set({ state: 'idle', totalFrames: frames.length })
  },

  captureFrame: (msg) => {
    if (get().state !== 'recording') return
    set((s) => {
      const frames = [...s.frames, { timestamp: performance.now(), message: msg }]
      return { frames, totalFrames: frames.length }
    })
  },

  downloadRecording: () => {
    const { frames } = get()
    const blob = new Blob([JSON.stringify(frames)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `argos-recording-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  },

  loadRecording: (json) => {
    const frames = JSON.parse(json) as RecordedFrame[]
    set({ frames, totalFrames: frames.length, frameIndex: 0, state: 'idle', isArgosrec: false, keyframeCache: [], cacheInterval: 200 })
  },

  loadArgosrecFile: async (file) => {
    const result = await parseArgosrec(file)

    // Build keyframe cache if recording uses deltas
    let keyframeCache: KeyframeSnapshot[] = []
    let cacheInterval = 200

    if (needsCache(result.frames) && result.frames.length > 0) {
      // Get entity count from first schema frame
      const schemaFrame = result.frames.find(f => f.type === 'schema')
      const entityCount = schemaFrame
        ? (schemaFrame.message as SchemaMessage).entities.length
        : 0
      cacheInterval = computeCacheInterval(entityCount)
      keyframeCache = buildKeyframeCache(result.frames, cacheInterval)
    }

    set({
      argosrecFrames: result.frames,
      argosrecHeader: result.header,
      argosrecWarnings: result.warnings,
      totalFrames: result.frames.length,
      frameIndex: 0,
      state: 'idle',
      isArgosrec: true,
      frames: [],
      keyframeCache,
      cacheInterval,
    })
    if (result.frames.length > 0) {
      get().startReplay()
    }
  },

  startReplay: () => {
    const { isArgosrec, argosrecFrames, frames } = get()
    const total = isArgosrec ? argosrecFrames.length : frames.length
    if (total === 0) return

    savedUrl = useConnectionStore.getState().url
    useConnectionStore.getState().disconnect()
    set({ state: 'replaying', frameIndex: 0, playing: true })

    if (isArgosrec) {
      applyArgosrecFrame(argosrecFrames[0])
    } else {
      useExperimentStore.getState().applyBroadcast(frames[0].message)
    }

    replayStart = null
    playLoop()
  },

  stopReplay: () => {
    stopLoop()
    set({ state: 'idle', playing: false })
    if (savedUrl) useConnectionStore.getState().connect(savedUrl)
  },

  togglePlayPause: () => {
    const { playing, frameIndex, isArgosrec, argosrecFrames, frames } = get()
    const total = isArgosrec ? argosrecFrames.length : frames.length

    if (playing) {
      stopLoop()
      set({ playing: false })
    } else {
      if (frameIndex >= total - 1) {
        set({ frameIndex: 0, playing: true })
        if (isArgosrec) {
          applyArgosrecFrame(argosrecFrames[0])
        } else {
          useExperimentStore.getState().applyBroadcast(frames[0].message)
        }
      } else {
        set({ playing: true })
      }
      replayStart = null
      playLoop()
    }
  },

  setSpeed: (speed) => set({ speed }),

  seekTo: (idx) => {
    const { isArgosrec, argosrecFrames, frames, keyframeCache } = get()
    const total = isArgosrec ? argosrecFrames.length : frames.length
    if (idx < 0 || idx >= total) return

    stopLoop()

    if (isArgosrec) {
      if (keyframeCache.length > 0) {
        // Use optimized seek with keyframe cache
        optimizedSeek(argosrecFrames, keyframeCache, idx)
      } else {
        // Full-mode or no cache: frames are self-contained
        applyArgosrecFrame(argosrecFrames[idx])
      }
    } else {
      useExperimentStore.getState().applyBroadcast(frames[idx].message)
    }

    set({ frameIndex: idx, playing: false })
  },
}))
