import { useShallow } from 'zustand/shallow'
import { Play, Pause, SkipForward, FastForward, RotateCcw } from 'lucide-react'
import { useConnectionStore } from '../stores/connectionStore'
import { useExperimentStore } from '../stores/experimentStore'
import { ExperimentState } from '../types/protocol'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

const statusColors: Record<string, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  disconnected: 'bg-red-500',
}

function ToolbarButton({ icon: Icon, label, active, onClick }: {
  icon: React.ElementType; label: string; active?: boolean; onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? 'default' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={onClick}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom"><p>{label}</p></TooltipContent>
    </Tooltip>
  )
}

export function Toolbar() {
  const { status, play, pause, step, fastForward, reset } = useConnectionStore(
    useShallow((s) => ({ status: s.status, play: s.play, pause: s.pause, step: s.step, fastForward: s.fastForward, reset: s.reset }))
  )
  const { state, steps } = useExperimentStore(
    useShallow((s) => ({ state: s.state, steps: s.steps }))
  )

  const isPlaying = state === ExperimentState.EXPERIMENT_PLAYING
  const isFF = state === ExperimentState.EXPERIMENT_FAST_FORWARDING
  const label = state.replace('EXPERIMENT_', '').replace(/_/g, ' ')

  return (
    <div className="flex items-center gap-1.5 h-10 px-3 border-b bg-card">
      <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      <span className="text-xs text-muted-foreground mr-1">{status}</span>
      <Separator orientation="vertical" className="h-5" />
      <ToolbarButton icon={Play} label="Play" active={isPlaying} onClick={play} />
      <ToolbarButton icon={Pause} label="Pause" onClick={pause} />
      <ToolbarButton icon={SkipForward} label="Step" onClick={step} />
      <ToolbarButton icon={FastForward} label="Fast Forward" active={isFF} onClick={() => fastForward()} />
      <ToolbarButton icon={RotateCcw} label="Reset" onClick={reset} />
      <Separator orientation="vertical" className="h-5" />
      <span className="text-xs font-mono text-muted-foreground">Step {steps}</span>
      <div className="ml-auto">
        <Badge variant="secondary" className="text-xs font-normal">{label}</Badge>
      </div>
    </div>
  )
}
