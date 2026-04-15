import { create } from 'zustand'
import type { BroadcastMessage, SchemaMessage, DeltaMessage } from '../types/protocol'
import { useExperimentStore } from './experimentStore'
import { useConnectionStore } from './connectionStore'
import { parseArgosrec, type ArgosrecHeader, type ArgosrecFrame } from '../protocol/argosrecParser'

interface RecordedFrame {
  timestamp: number
  message: BroadcastMessage
}

type RecordingState = 'idle' | 'recording' | 'replaying'

interface RecordingStore {
  state: RecordingState
  frames: RecordedFrame[]
  /** Frames from .argosrec files (schema/delta) */
  argosrecFrames: ArgosrecFrame[]
  argosrecHeader: ArgosrecHeader | null
  argosrecWarnings: string[]
  frameIndex: number
  totalFrames: number
  speed: number
  playing: boolean
  /** Whether we're replaying an argosrec file (vs live recording) */
  isArgosrec: boolean

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

/** Apply an argosrec frame to the experiment store */
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

function playLoop() {
  stopLoop()
  const tick = (now: number) => {
    const s = useRecordingStore.getState()
    if (!s.playing || s.state !== 'replaying') return

    if (replayStart === null) replayStart = now

    if (s.isArgosrec) {
      // Argosrec: step-based, use speed as frames-per-second multiplier
      const elapsed = (now - replayStart) / 1000 * s.speed * 10 // 10 fps base
      const targetIdx = Math.min(Math.floor(elapsed), s.argosrecFrames.length - 1)

      if (targetIdx > s.frameIndex) {
        // Apply all frames between current and target (for delta correctness)
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
      // Live recording: timestamp-based
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

  startRecording: () => set({ state: 'recording', frames: [], argosrecFrames: [], frameIndex: 0, totalFrames: 0, isArgosrec: false }),

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
    set({ frames, totalFrames: frames.length, frameIndex: 0, state: 'idle', isArgosrec: false })
  },

  loadArgosrecFile: async (file) => {
    const result = await parseArgosrec(file)
    set({
      argosrecFrames: result.frames,
      argosrecHeader: result.header,
      argosrecWarnings: result.warnings,
      totalFrames: result.frames.length,
      frameIndex: 0,
      state: 'idle',
      isArgosrec: true,
      frames: [],
    })
    // Auto-start replay
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
        // Restart from beginning
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
    const { isArgosrec, argosrecFrames, frames } = get()
    const total = isArgosrec ? argosrecFrames.length : frames.length
    if (idx < 0 || idx >= total) return

    stopLoop()

    if (isArgosrec) {
      // Must replay from last schema to build correct state
      let schemaIdx = 0
      for (let i = idx; i >= 0; i--) {
        if (argosrecFrames[i].type === 'schema') { schemaIdx = i; break }
      }
      for (let i = schemaIdx; i <= idx; i++) {
        applyArgosrecFrame(argosrecFrames[i])
      }
    } else {
      useExperimentStore.getState().applyBroadcast(frames[idx].message)
    }

    set({ frameIndex: idx, playing: false })
  },
}))
