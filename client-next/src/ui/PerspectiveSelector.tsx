import { Box, Eye, Compass, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCameraStore, type CameraPreset } from '@/stores/cameraStore'

const presets: { value: CameraPreset; icon: React.ElementType; label: string }[] = [
  { value: 'isometric', icon: Box, label: 'Isometric' },
  { value: 'top', icon: Eye, label: 'Top' },
  { value: 'side', icon: Compass, label: 'Side' },
  { value: 'follow', icon: UserRound, label: 'Follow' },
]

export function PerspectiveSelector() {
  const preset = useCameraStore((s) => s.preset)
  const setPreset = useCameraStore((s) => s.setPreset)

  return (
    <div className="flex items-center gap-0.5">
      {presets.map(({ value, icon: Icon, label }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <Button
              variant={preset === value ? 'default' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setPreset(value)}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>{label}</p></TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
