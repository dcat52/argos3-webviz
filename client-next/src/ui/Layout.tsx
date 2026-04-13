import { Panel, Group as PanelGroup, Separator } from 'react-resizable-panels'
import { Toolbar } from './Toolbar'
import { Sidebar } from './Sidebar'
import { LogPanel } from './LogPanel'
import { Scene } from '../scene/Scene'

function ResizeHandle({ direction }: { direction: 'horizontal' | 'vertical' }) {
  return (
    <Separator
      className={`${
        direction === 'horizontal' ? 'w-1' : 'h-1'
      } bg-white/5 hover:bg-blue-500/40 transition-colors`}
    />
  )
}

export function Layout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Toolbar />
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={75} min={40}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={75} min={30}>
              <div className="relative w-full h-full">
                <Scene />
              </div>
            </Panel>
            <ResizeHandle direction="vertical" />
            <Panel defaultSize={25} min={10}>
              <LogPanel />
            </Panel>
          </PanelGroup>
        </Panel>
        <ResizeHandle direction="horizontal" />
        <Panel defaultSize={25} min={15}>
          <Sidebar />
        </Panel>
      </PanelGroup>
    </div>
  )
}
