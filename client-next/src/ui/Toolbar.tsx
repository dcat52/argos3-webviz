import { useShallow } from 'zustand/react/shallow'
import { Play, Pause, SkipForward, FastForward, RotateCcw } from 'lucide-react'
import { useConnectionStore } from '../stores/connectionStore'
import { useExperimentStore } from '../stores/experimentStore'
import { ExperimentState } from '../types/protocol'

const statusColor: Record<string, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  disconnected: 'bg-red-500',
}

export function Toolbar() {
  const { status, play, pause, step, fastForward, reset } = useConnectionStore(
    useShallow((s) => ({
      status: s.status,
      play: s.play,
      pause: s.pause,
      step: s.step,
      fastForward: s.fastForward,
      reset: s.reset,
    }))
  )

  const { state, steps } = useExperimentStore(
    useShallow((s) => ({ state: s.state, steps: s.steps }))
  )

  const isPlaying = state === ExperimentState.EXPERIMENT_PLAYING
  const isFF = state === ExperimentState.EXPERIMENT_FAST_FORWARDING

  const btn = 'p-1.5 rounded hover:bg-white/10 text-gray-300 disabled:opacity-30'
  const active = 'bg-white/20 text-white'

  return (
    <div className="flex items-center gap-2 h-10 px-3 bg-[#12122a] border-b border-white/10 shrink-0">
      <div className={`w-2.5 h-2.5 rounded-full ${statusColor[status]}`} />
      <div className="w-px h-5 bg-white/10" />
      <button className={`${btn} ${isPlaying ? active : ''}`} onClick={play}><Play size={16} /></button>
      <button className={btn} onClick={pause}><Pause size={16} /></button>
      <button className={btn} onClick={step}><SkipForward size={16} /></button>
      <button className={`${btn} ${isFF ? active : ''}`} onClick={() => fastForward()}><FastForward size={16} /></button>
      <button className={btn} onClick={reset}><RotateCcw size={16} /></button>
      <div className="w-px h-5 bg-white/10" />
      <span className="text-xs text-gray-400 font-mono">Step {steps}</span>
      <span className="ml-auto text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300">
        {state.replace('EXPERIMENT_', '')}
      </span>
    </div>
  )
}
