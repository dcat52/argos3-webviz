import { useEffect } from 'react'
import { useConnectionStore } from '@/stores/connectionStore'
import { useExperimentStore } from '@/stores/experimentStore'
import { useRecordingStore } from '@/stores/recordingStore'
import { useInteractionStore } from '@/stores/interactionStore'
import { usePlacementStore } from '@/stores/placementStore'
import { ExperimentState } from '@/types/protocol'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return

      // Escape: cancel place mode, or deselect
      if (e.code === 'Escape') {
        const mode = useInteractionStore.getState().mode
        if (mode === 'place') {
          usePlacementStore.getState().cancelPlacement()
          useInteractionStore.getState().setMode('select')
          return
        }
        useExperimentStore.getState().selectEntity(null)
        return
      }

      const recording = useRecordingStore.getState()

      // Replay-mode shortcuts
      if (recording.state === 'replaying') {
        switch (e.code) {
          case 'Space':
            e.preventDefault()
            recording.togglePlayPause()
            return
          case 'ArrowLeft':
            e.preventDefault()
            recording.seekTo(recording.frameIndex - (e.shiftKey ? 10 : 1))
            return
          case 'ArrowRight':
            e.preventDefault()
            recording.seekTo(recording.frameIndex + (e.shiftKey ? 10 : 1))
            return
        }
      }

      // Live-connection shortcuts
      const { pause, step, reset, playAtSpeed } = useConnectionStore.getState()
      const { state } = useExperimentStore.getState()
      const isRunning = state === ExperimentState.EXPERIMENT_PLAYING || state === ExperimentState.EXPERIMENT_FAST_FORWARDING
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          isRunning ? pause() : playAtSpeed(1)
          break
        case 'ArrowRight': e.preventDefault(); step(); break
        case 'KeyR': if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); reset() } break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
