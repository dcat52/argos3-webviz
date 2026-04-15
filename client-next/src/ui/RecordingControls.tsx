import { useRef, useCallback } from 'react'
import { useShallow } from 'zustand/shallow'
import { Circle, Square, Play, Pause, Download, Upload, FileUp } from 'lucide-react'
import { useRecordingStore } from '@/stores/recordingStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

function Btn({ icon: Icon, label, onClick, variant, className, testId }: {
  icon: React.ElementType; label: string; onClick: () => void; variant?: 'ghost' | 'default'; className?: string; testId?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant ?? 'ghost'} size="icon" className={`h-6 w-6 ${className ?? ''}`} onClick={onClick} data-testid={testId}>
          <Icon className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom"><p>{label}</p></TooltipContent>
    </Tooltip>
  )
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
    <div
      className="flex items-center gap-1.5 h-7 px-3 border-b bg-card/50"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {state === 'replaying' ? (
        <>
          <Btn icon={playing ? Pause : Play} label={playing ? 'Pause' : 'Play'} onClick={togglePlayPause} />
          <Btn icon={Square} label="Stop Replay" onClick={stopReplay} />
        </>
      ) : (
        <>
          <Btn icon={Play} label="Replay" onClick={startReplay} />
          <Btn icon={Circle} label="Record" onClick={startRecording} className="text-red-500" testId="record-btn" />
        </>
      )}
      <Slider
        value={[frameIndex]}
        min={0}
        max={Math.max(totalFrames - 1, 0)}
        step={1}
        onValueChange={(v) => seekTo(Array.isArray(v) ? v[0] : v)}
        className="w-40"
      />
      <span className="text-[10px] font-mono text-muted-foreground">{frameIndex + 1}/{totalFrames}</span>
      {isArgosrec && argosrecHeader?.created && (
        <span className="text-[10px] text-muted-foreground truncate max-w-32" title={argosrecHeader.created}>
          {new Date(argosrecHeader.created).toLocaleDateString()}
        </span>
      )}
      {argosrecWarnings.length > 0 && (
        <span className="text-[10px] text-yellow-500" title={argosrecWarnings.join('\n')}>⚠</span>
      )}
      <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
        <SelectTrigger className="h-5 w-14 text-[10px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[0.5, 1, 2, 4].map((s) => (
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
