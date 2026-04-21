import { useRef, useCallback, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { Circle, Square, Play, Pause, Download, Upload, FileUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRecordingStore } from '@/stores/recordingStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

function Btn({ icon: Icon, label, onClick, variant, className, testId, disabled }: {
  icon: React.ElementType; label: string; onClick: () => void; variant?: 'ghost' | 'default'; className?: string; testId?: string; disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant ?? 'ghost'} size="icon" className={`h-6 w-6 ${className ?? ''}`} onClick={onClick} data-testid={testId} disabled={disabled}>
          <Icon className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom"><p>{label}</p></TooltipContent>
    </Tooltip>
  )
}

function TimelineTooltip({ totalFrames, sliderRef, everyNSteps }: {
  totalFrames: number; sliderRef: React.RefObject<HTMLDivElement | null>; everyNSteps?: number
}) {
  const [hover, setHover] = useState<{ frame: number; x: number } | null>(null)

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = sliderRef.current
    if (!el || totalFrames <= 1) return
    const rect = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const frame = Math.round(pct * (totalFrames - 1))
    setHover({ frame, x: e.clientX - rect.left })
  }, [totalFrames, sliderRef])

  const onLeave = useCallback(() => setHover(null), [])

  return {
    onMove,
    onLeave,
    tooltip: hover !== null ? (
      <div
        className="absolute -top-7 pointer-events-none bg-popover text-popover-foreground border rounded px-1.5 py-0.5 text-[10px] font-mono whitespace-nowrap z-50"
        style={{ left: hover.x, transform: 'translateX(-50%)' }}
      >
        Frame {hover.frame + 1}{everyNSteps ? ` · Step ${hover.frame * everyNSteps}` : ''}
      </div>
    ) : null,
  }
}

export function RecordingControls() {
  const { state, totalFrames, frameIndex, speed, playing, isArgosrec, argosrecHeader, argosrecWarnings,
    startRecording, stopRecording, downloadRecording, loadRecording, loadArgosrecFile,
    startReplay, stopReplay, togglePlayPause, setSpeed, seekTo } =
    useRecordingStore(useShallow((s) => ({
      state: s.state, totalFrames: s.totalFrames, frameIndex: s.frameIndex, speed: s.speed, playing: s.playing,
      isArgosrec: s.isArgosrec, argosrecHeader: s.argosrecHeader, argosrecWarnings: s.argosrecWarnings,
      startRecording: s.startRecording, stopRecording: s.stopRecording, downloadRecording: s.downloadRecording,
      loadRecording: s.loadRecording, loadArgosrecFile: s.loadArgosrecFile,
      startReplay: s.startReplay, stopReplay: s.stopReplay,
      togglePlayPause: s.togglePlayPause, setSpeed: s.setSpeed, seekTo: s.seekTo,
    })))
  const fileRef = useRef<HTMLInputElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  const everyNSteps = argosrecHeader?.every_n_steps

  const handleFile = useCallback((file: File) => {
    if (file.name.endsWith('.argosrec') || file.name.endsWith('.argosrec.gz')) {
      loadArgosrecFile(file)
    } else {
      file.text().then((json) => { loadRecording(json); startReplay() })
    }
  }, [loadArgosrecFile, loadRecording, startReplay])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  if (state === 'idle' && totalFrames === 0) {
    return (
      <div
        className="flex items-center gap-1 h-7 px-3 border-b bg-card/50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <Btn icon={Circle} label="Record" onClick={startRecording} className="text-red-500" testId="record-btn" />
        <Btn icon={Upload} label="Load Recording" onClick={() => fileRef.current?.click()} />
        <input ref={fileRef} type="file" accept=".json,.argosrec,.gz" className="hidden" onChange={handleFileInput} />
        <span className="text-[10px] text-muted-foreground ml-1">Record / Load / Drop .argosrec</span>
      </div>
    )
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-1 h-7 px-3 border-b bg-red-500/10">
        <Btn icon={Square} label="Stop Recording" onClick={stopRecording} className="text-red-500" testId="stop-record-btn" />
        <span className="text-[10px] text-red-400 font-mono ml-1" data-testid="frame-count">⏺ {totalFrames} frames</span>
      </div>
    )
  }

  // idle with frames or replaying
  return (
    <ReplayBar
      state={state} playing={playing} frameIndex={frameIndex} totalFrames={totalFrames}
      speed={speed} isArgosrec={isArgosrec} argosrecHeader={argosrecHeader}
      argosrecWarnings={argosrecWarnings} everyNSteps={everyNSteps}
      togglePlayPause={togglePlayPause} stopReplay={stopReplay} startReplay={startReplay}
      startRecording={startRecording} seekTo={seekTo} setSpeed={setSpeed}
      downloadRecording={downloadRecording} fileRef={fileRef} sliderRef={sliderRef}
      handleDrop={handleDrop} handleDragOver={handleDragOver} handleFileInput={handleFileInput}
    />
  )
}

function ReplayBar({ state, playing, frameIndex, totalFrames, speed, isArgosrec, argosrecHeader,
  argosrecWarnings, everyNSteps, togglePlayPause, stopReplay, startReplay, startRecording,
  seekTo, setSpeed, downloadRecording, fileRef, sliderRef, handleDrop, handleDragOver, handleFileInput,
}: {
  state: RecordingState; playing: boolean; frameIndex: number; totalFrames: number
  speed: number; isArgosrec: boolean; argosrecHeader: import('@/protocol/argosrecParser').ArgosrecHeader | null
  argosrecWarnings: string[]; everyNSteps?: number
  togglePlayPause: () => void; stopReplay: () => void; startReplay: () => void
  startRecording: () => void; seekTo: (idx: number) => void; setSpeed: (s: number) => void
  downloadRecording: () => void; fileRef: React.RefObject<HTMLInputElement | null>
  sliderRef: React.RefObject<HTMLDivElement | null>
  handleDrop: (e: React.DragEvent) => void; handleDragOver: (e: React.DragEvent) => void
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const { onMove, onLeave, tooltip } = TimelineTooltip({ totalFrames, sliderRef, everyNSteps })

  return (
    <div
      className="flex items-center gap-1.5 h-7 px-3 border-b bg-card/50"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {state === 'replaying' ? (
        <>
          <Btn icon={ChevronLeft} label="Previous frame" onClick={() => seekTo(frameIndex - 1)} disabled={frameIndex <= 0} testId="frame-back-btn" />
          <Btn icon={playing ? Pause : Play} label={playing ? 'Pause' : 'Play'} onClick={togglePlayPause} testId="play-pause-btn" />
          <Btn icon={ChevronRight} label="Next frame" onClick={() => seekTo(frameIndex + 1)} disabled={frameIndex >= totalFrames - 1} testId="frame-fwd-btn" />
          <Btn icon={Square} label="Stop Replay" onClick={stopReplay} />
        </>
      ) : (
        <>
          <Btn icon={Play} label="Replay" onClick={startReplay} />
          <Btn icon={Circle} label="Record" onClick={startRecording} className="text-red-500" testId="record-btn" />
        </>
      )}
      <div ref={sliderRef} className="relative flex-1 min-w-0" onMouseMove={onMove} onMouseLeave={onLeave}>
        {tooltip}
        <Slider
          value={[frameIndex]}
          min={0}
          max={Math.max(totalFrames - 1, 0)}
          step={1}
          onValueChange={(v) => seekTo(Array.isArray(v) ? v[0] : v)}
          className="w-full"
          data-testid="timeline-slider"
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap" data-testid="frame-display">
        {frameIndex + 1}/{totalFrames}
        {everyNSteps ? ` · Step ${frameIndex * everyNSteps}` : ''}
      </span>
      {isArgosrec && argosrecHeader?.created && (
        <span className="text-[10px] text-muted-foreground truncate max-w-32" title={argosrecHeader.created}>
          {new Date(argosrecHeader.created).toLocaleDateString()}
        </span>
      )}
      {argosrecWarnings.length > 0 && (
        <span className="text-[10px] text-yellow-500" title={argosrecWarnings.join('\n')}>⚠</span>
      )}
      <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
        <SelectTrigger className="h-5 w-14 text-[10px]" data-testid="speed-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[0.5, 1, 2, 4, 8, 16].map((s) => (
            <SelectItem key={s} value={String(s)} className="text-[10px]">{s}x</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isArgosrec && <Btn icon={Download} label="Download" onClick={downloadRecording} />}
      <Btn icon={FileUp} label="Load File" onClick={() => fileRef.current?.click()} />
      <input ref={fileRef} type="file" accept=".json,.argosrec,.gz" className="hidden" onChange={handleFileInput} />
    </div>
  )
}

type RecordingState = 'idle' | 'recording' | 'replaying'
