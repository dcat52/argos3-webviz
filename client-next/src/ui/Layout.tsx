import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import { useRef } from 'react'
import { Toolbar } from './Toolbar'
import { Sidebar } from './Sidebar'
import { LogPanel } from './LogPanel'
import { Scene } from '../scene/Scene'
import { RecordingControls } from './RecordingControls'

export function Layout() {
  const viewportRef = useRef<HTMLDivElement>(null)

  const horiz = useDefaultLayout({ id: 'main-horiz' })
  const vert = useDefaultLayout({ id: 'main-vert' })

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Toolbar viewportRef={viewportRef} />
      <RecordingControls />
      <Group orientation="horizontal" defaultLayout={horiz.defaultLayout} onLayoutChanged={horiz.onLayoutChanged}>
        <Panel id="main" defaultSize="75%" minSize="30%">
          <Group orientation="vertical" defaultLayout={vert.defaultLayout} onLayoutChanged={vert.onLayoutChanged}>
            <Panel id="viewport" defaultSize="75%" minSize="20%">
              <div ref={viewportRef} className="relative w-full h-full">
                <Scene />
              </div>
            </Panel>
            <Separator className="h-1 bg-border hover:bg-primary/30 transition-colors cursor-row-resize" />
            <Panel id="logs" defaultSize="25%" minSize="10%">
              <LogPanel />
            </Panel>
          </Group>
        </Panel>
        <Separator className="w-1.5 bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />
        <Panel id="sidebar" defaultSize="25%" minSize="15%" maxSize="60%">
          <Sidebar />
        </Panel>
      </Group>
    </div>
  )
}
