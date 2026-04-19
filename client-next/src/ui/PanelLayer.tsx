import { ExperimentDataPanel } from './panels/ExperimentDataPanel'
import { EventLogPanel } from './panels/EventLogPanel'

export function PanelLayer() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <ExperimentDataPanel />
      <EventLogPanel />
    </div>
  )
}
