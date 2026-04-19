import { create } from 'zustand'
import { useCanvasRef } from './canvasRefStore'
import { useSettingsStore } from './settingsStore'

type VideoState = 'idle' | 'recording'

interface VideoRecordingStore {
  state: VideoState
  duration: number
  startVideoRecording: () => void
  stopVideoRecording: () => void
}

let recorder: MediaRecorder | null = null
let chunks: Blob[] = []
let timerInterval: ReturnType<typeof setInterval> | null = null

export const useVideoRecordingStore = create<VideoRecordingStore>((set, get) => ({
  state: 'idle',
  duration: 0,

  startVideoRecording: () => {
    const gl = useCanvasRef.getState().gl
    if (!gl) return

    const canvas = gl.domElement
    const { captureFps, videoBitrate } = useSettingsStore.getState()
    const stream = canvas.captureStream(captureFps)
    chunks = []

    recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
      videoBitsPerSecond: videoBitrate,
    })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `argos-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(a.href)
      chunks = []
    }

    recorder.start(100) // collect data every 100ms
    set({ state: 'recording', duration: 0 })

    timerInterval = setInterval(() => {
      set((s) => ({ duration: s.duration + 1 }))
    }, 1000)
  },

  stopVideoRecording: () => {
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    }
    recorder = null
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
    set({ state: 'idle', duration: 0 })
  },
}))
