import { create } from 'zustand'
import type { BroadcastMessage } from '../types/protocol'
import { useExperimentStore } from './experimentStore'
import { useConnectionStore } from './connectionStore'

interface RecordedFrame {
  timestamp: number
  message: BroadcastMessage
}

type RecordingState = 'idle' | 'recording' | 'replaying'

interface RecordingStore {
  state: RecordingState
  frames: RecordedFrame[]
  frameIndex: number
  totalFrames: number
  speed: number
  playing: boolean

  startRecording: () => void
  stopRecording: () => void
  captureFrame: (msg: BroadcastMessage) => void
  downloadRecording: () => void
  loadRecording: (json: string) => void
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

function playLoop() {
  stopLoop()
  const tick = (now: number) => {
    const s = useRecordingStore.getState()
    if (!s.playing || s.state !== 'replaying' || s.frames.length === 0) return

    if (replayStart === null) replayStart = now

    const elapsed = (now - replayStart) * s.speed
    const baseTime = s.frames[0].timestamp

    // Find the frame matching elapsed time
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

    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  state: 'idle',
  frames: [],
  frameIndex: 0,
  totalFrames: 0,
  speed: 1,
  playing: false,

  startRecording: () => set({ state: 'recording', frames: [], frameIndex: 0, totalFrames: 0 }),

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
    set({ frames, totalFrames: frames.length, frameIndex: 0, state: 'idle' })
  },

  startReplay: () => {
    const { frames } = get()
    if (frames.length === 0) return
    savedUrl = useConnectionStore.getState().url
    useConnectionStore.getState().disconnect()
    set({ state: 'replaying', frameIndex: 0, playing: true })
    useExperimentStore.getState().applyBroadcast(frames[0].message)
    replayStart = null
    playLoop()
  },

  stopReplay: () => {
    stopLoop()
    set({ state: 'idle', playing: false })
    if (savedUrl) useConnectionStore.getState().connect(savedUrl)
  },

  togglePlayPause: () => {
    const { playing, frameIndex, frames } = get()
    if (playing) {
      stopLoop()
      set({ playing: false })
    } else {
      // If at end, restart
      if (frameIndex >= frames.length - 1) {
        set({ frameIndex: 0, playing: true })
        useExperimentStore.getState().applyBroadcast(frames[0].message)
      } else {
        set({ playing: true })
      }
      replayStart = null
      playLoop()
    }
  },

  setSpeed: (speed) => set({ speed }),

  seekTo: (idx) => {
    const { frames } = get()
    if (idx >= 0 && idx < frames.length) {
      stopLoop()
      set({ frameIndex: idx, playing: false })
      useExperimentStore.getState().applyBroadcast(frames[idx].message)
    }
  },
}))
