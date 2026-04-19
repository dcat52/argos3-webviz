import { useExperimentStore } from '@/stores/experimentStore'
import { FloatingPanel } from '../FloatingPanel'

export function SimHudPanel() {
  const steps = useExperimentStore((s) => s.steps)
  const state = useExperimentStore((s) => s.state)
  const count = useExperimentStore((s) => s.entities.size)
  const ratio = useExperimentStore((s) => s.realTimeRatio)

  return (
    <FloatingPanel id="sim-hud" title="Simulation" defaultPosition={{ pin: 'bottom-right' }} closable={false}>
      <Row label="State" value={state.replace('EXPERIMENT_', '').replace(/_/g, ' ')} />
      <Row label="Step" value={String(steps)} />
      <Row label="Entities" value={String(count)} />
      {ratio > 0 && <Row label="RT Ratio" value={`${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×`} />}
    </FloatingPanel>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
