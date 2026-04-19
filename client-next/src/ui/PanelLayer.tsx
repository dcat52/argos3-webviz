import { SimHudPanel } from './panels/SimHudPanel'
import { ExperimentDataPanel } from './panels/ExperimentDataPanel'
import { EventLogPanel } from './panels/EventLogPanel'

export function PanelLayer() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <SimHudPanel />
      <ExperimentDataPanel />
      <EventLogPanel />
    </div>
  )
}
