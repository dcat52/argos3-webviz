import { useShallow } from 'zustand/shallow'
import { Play, Pause, SkipForward, FastForward, RotateCcw, Activity } from 'lucide-react'
import { useConnectionStore } from '../stores/connectionStore'
import { useExperimentStore } from '../stores/experimentStore'
import { useSceneSettingsStore } from '../stores/sceneSettingsStore'
import { ExperimentState } from '../types/protocol'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PerspectiveSelector } from './PerspectiveSelector'

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
  const { state, steps, userData } = useExperimentStore(
    useShallow((s) => ({ state: s.state, steps: s.steps, userData: s.userData }))
  )

  const envPreset = useSceneSettingsStore((s) => s.envPreset)
  const setEnvPreset = useSceneSettingsStore((s) => s.setEnvPreset)
  const showFps = useSceneSettingsStore((s) => s.showFps)
  const toggleFps = useSceneSettingsStore((s) => s.toggleFps)

  const availableScenes = (userData as { available_scenes?: string[] })?.available_scenes
  const currentScene = (userData as { current_scene?: string })?.current_scene

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
      <Separator orientation="vertical" className="h-5" />
      <PerspectiveSelector />
      <Separator orientation="vertical" className="h-5" />
      <ToolbarButton icon={Activity} label="Toggle FPS" active={showFps} onClick={toggleFps} />
      <div className="ml-auto flex items-center gap-2">
        <Select value={envPreset} onValueChange={(v) => setEnvPreset(v as 'grid' | 'grass' | 'mountain')}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grid" className="text-xs">🔲 Grid</SelectItem>
            <SelectItem value="grass" className="text-xs">🌿 Grass</SelectItem>
            <SelectItem value="mountain" className="text-xs">🏜️ Desert</SelectItem>
          </SelectContent>
        </Select>
        {availableScenes && (
          <Select
            value={currentScene || ''}
            onValueChange={(scene) => {
              useConnectionStore.getState().send({ command: 'switchScene', scene } as never)
            }}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="Scene" />
            </SelectTrigger>
            <SelectContent>
              {availableScenes.map((s: string) => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Badge variant="secondary" className="text-xs font-normal">{label}</Badge>
      </div>
    </div>
  )
}
