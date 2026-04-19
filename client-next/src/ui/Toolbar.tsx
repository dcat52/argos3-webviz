import { useState, type RefObject } from 'react'
import { useShallow } from 'zustand/shallow'
import { Play, Pause, SkipForward, RotateCcw, Activity, Settings, Camera, Maximize2, Minimize2, Video, VideoOff, CloudFog, PanelTop } from 'lucide-react'
import { useConnectionStore } from '../stores/connectionStore'
import { useExperimentStore } from '../stores/experimentStore'
import { useSceneSettingsStore } from '../stores/sceneSettingsStore'
import type { EnvPreset } from '../scene/EnvironmentPreset'
import { ExperimentState } from '../types/protocol'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PerspectiveSelector } from './PerspectiveSelector'
import { SettingsPanel } from './SettingsPanel'
import { useCanvasRef } from '@/stores/canvasRefStore'
import { useVideoRecordingStore } from '@/stores/videoRecordingStore'
import { usePanelStore } from '@/stores/panelStore'

const statusColors: Record<string, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  disconnected: 'bg-red-500',
}

function RealTimeRatioBadge() {
  const ratio = useExperimentStore((s) => s.realTimeRatio)
  const state = useExperimentStore((s) => s.state)
  if (state !== ExperimentState.EXPERIMENT_PLAYING &&
      state !== ExperimentState.EXPERIMENT_FAST_FORWARDING) return null
  const display = ratio >= 10 ? `${Math.round(ratio)}×` : `${ratio.toFixed(1)}×`
  const color = ratio > 1.05 ? 'text-blue-400' : ratio >= 0.95 ? 'text-green-400' : ratio >= 0.5 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`text-xs font-mono ${color}`} title="Real-time ratio">⏱{display}</span>
}

function ToolbarButton({ icon: Icon, label, active, onClick, testId }: {
  icon: React.ElementType; label: string; active?: boolean; onClick: () => void; testId?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? 'default' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={onClick}
          data-testid={testId}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom"><p>{label}</p></TooltipContent>
    </Tooltip>
  )
}

function PanelsDropdown({ onClose }: { onClose: () => void }) {
  const panels = usePanelStore((s) => s.panels)
  const toggle = usePanelStore((s) => s.toggle)
  const names: Record<string, string> = { 'sim-hud': 'Simulation HUD', 'experiment-data': 'Experiment Data', 'event-log': 'Event Log' }
  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-card border rounded-md shadow-lg p-1 min-w-[160px]" onMouseLeave={onClose}>
      {Object.entries(panels).map(([id, p]) => (
        <button key={id} onClick={() => toggle(id)} className="flex items-center gap-2 w-full text-left text-xs px-2 py-1 rounded hover:bg-accent">
          <span className={p.open ? 'text-green-400' : 'text-muted-foreground'}>{p.open ? '☑' : '☐'}</span>
          {names[id] ?? id}
        </button>
      ))}
    </div>
  )
}

export function Toolbar({ viewportRef }: { viewportRef?: RefObject<HTMLDivElement | null> }) {
  const { status, play, pause, step, fastForward, reset, playAtSpeed } = useConnectionStore(
    useShallow((s) => ({ status: s.status, play: s.play, pause: s.pause, step: s.step, fastForward: s.fastForward, reset: s.reset, playAtSpeed: s.playAtSpeed }))
  )
  const { state, steps, userData } = useExperimentStore(
    useShallow((s) => ({ state: s.state, steps: s.steps, userData: s.userData }))
  )

  const envPreset = useSceneSettingsStore((s) => s.envPreset)
  const setEnvPreset = useSceneSettingsStore((s) => s.setEnvPreset)
  const showFps = useSceneSettingsStore((s) => s.showFps)
  const toggleFps = useSceneSettingsStore((s) => s.toggleFps)
  const showFog = useSceneSettingsStore((s) => s.showFog)
  const toggleFog = useSceneSettingsStore((s) => s.toggleFog)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [panelsOpen, setPanelsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [speed, setSpeed] = useState(1)
  const videoState = useVideoRecordingStore((s) => s.state)
  const videoDuration = useVideoRecordingStore((s) => s.duration)
  const startVideo = useVideoRecordingStore((s) => s.startVideoRecording)
  const stopVideo = useVideoRecordingStore((s) => s.stopVideoRecording)

  const availableScenes = (userData as { available_scenes?: string[] })?.available_scenes
  const currentScene = (userData as { current_scene?: string })?.current_scene

  const isRunning = state === ExperimentState.EXPERIMENT_PLAYING || state === ExperimentState.EXPERIMENT_FAST_FORWARDING
  const label = state.replace('EXPERIMENT_', '').replace(/_/g, ' ')

  const canvasEl = useCanvasRef((s) => s.gl)

  const takeScreenshot = () => {
    if (!canvasEl) return
    canvasEl.render(canvasEl.scene, canvasEl.camera)
    const url = canvasEl.domElement.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `argos-${Date.now()}.png`
    a.click()
  }

  const toggleFullscreen = () => {
    if (!viewportRef?.current) return
    if (!document.fullscreenElement) {
      viewportRef.current.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 h-10 px-3 border-b bg-card">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-xs text-muted-foreground mr-1" data-testid="connection-status">{status}</span>
        <Separator orientation="vertical" className="h-5" />
        <ToolbarButton icon={isRunning ? Pause : Play} label={isRunning ? 'Pause' : `Play (${speed}×)`} active={isRunning} onClick={() => {
          if (isRunning) { pause() } else { playAtSpeed(speed) }
        }} testId="play-btn" />
        <ToolbarButton icon={SkipForward} label="Step" onClick={step} testId="step-btn" />
        <ToolbarButton icon={RotateCcw} label="Reset" onClick={reset} testId="reset-btn" />
        <Select value={String(speed)} onValueChange={(v) => {
          const s = Number(v)
          setSpeed(s)
          if (isRunning) playAtSpeed(s)
        }}>
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 5, 10, 25, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)} className="text-xs">{n}×</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-xs font-mono text-muted-foreground" data-testid="step-counter">{steps}</span>
        <RealTimeRatioBadge />
        <Separator orientation="vertical" className="h-5" />
        <PerspectiveSelector />
        <Separator orientation="vertical" className="h-5" />
        <ToolbarButton icon={Activity} label="Toggle FPS" active={showFps} onClick={toggleFps} />
        <ToolbarButton icon={CloudFog} label="Toggle Fog" active={showFog} onClick={toggleFog} />
        <div className="relative">
          <ToolbarButton icon={PanelTop} label="Panels" active={panelsOpen} onClick={() => setPanelsOpen(!panelsOpen)} />
          {panelsOpen && (
            <PanelsDropdown onClose={() => setPanelsOpen(false)} />
          )}
        </div>
        <ToolbarButton icon={Camera} label="Screenshot" onClick={takeScreenshot} />
        {videoState === 'recording' ? (
          <>
            <ToolbarButton icon={VideoOff} label="Stop Recording" active onClick={stopVideo} />
            <span className="text-[10px] font-mono text-red-500">{videoDuration}s</span>
          </>
        ) : (
          <ToolbarButton icon={Video} label="Record Video" onClick={startVideo} />
        )}
        <ToolbarButton icon={isFullscreen ? Minimize2 : Maximize2} label="Fullscreen" onClick={toggleFullscreen} />
        <ToolbarButton icon={Settings} label="Settings" onClick={() => setSettingsOpen(true)} />
        <div className="ml-auto flex items-center gap-2">
          <Select value={envPreset} onValueChange={(v) => setEnvPreset(v as EnvPreset)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid" className="text-xs">🔲 Grid</SelectItem>
              <SelectItem value="grass" className="text-xs">🌿 Grass</SelectItem>
              <SelectItem value="mountain" className="text-xs">🏜️ Desert</SelectItem>
              <SelectItem value="soccer" className="text-xs">⚽ Soccer</SelectItem>
              <SelectItem value="football" className="text-xs">🏈 Football</SelectItem>
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
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
