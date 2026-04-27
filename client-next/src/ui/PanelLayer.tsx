import { ExperimentDataPanel } from './panels/ExperimentDataPanel'
import { EventLogPanel } from './panels/EventLogPanel'
import { EntityDebugPanel } from './panels/EntityDebugPanel'
import { WatchListPanel } from './panels/WatchListPanel'

export function PanelLayer() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <ExperimentDataPanel />
      <EventLogPanel />
      <EntityDebugPanel />
      <WatchListPanel />
    </div>
  )
}
