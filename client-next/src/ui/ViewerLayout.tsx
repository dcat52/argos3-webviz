import { Scene } from '../scene/Scene'
import { useExperimentStore } from '../stores/experimentStore'
import { useConnectionStore } from '../stores/connectionStore'

export function ViewerLayout() {
  const status = useConnectionStore((s) => s.status)
  const steps = useExperimentStore((s) => s.steps)
  const entityCount = useExperimentStore((s) => s.entities.size)

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-black">
      <div className="relative flex-1">
        <Scene />
      </div>
      <div className="h-6 flex items-center gap-4 px-2 text-xs text-muted-foreground bg-background border-t border-border shrink-0">
        <span className={status === 'connected' ? 'text-green-500' : 'text-red-400'}>
          ● {status}
        </span>
        <span>Step {steps}</span>
        <span>{entityCount} entities</span>
      </div>
    </div>
  )
}
