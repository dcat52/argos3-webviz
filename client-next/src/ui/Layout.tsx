import { Toolbar } from './Toolbar'
import { Sidebar } from './Sidebar'
import { LogPanel } from './LogPanel'
import { Scene } from '../scene/Scene'
import { Separator } from '@/components/ui/separator'

export function Layout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-[3] relative min-h-0">
            <Scene />
          </div>
          <div className="flex-1 min-h-[120px]">
            <LogPanel />
          </div>
        </div>
        <Separator orientation="vertical" />
        <div className="w-72 overflow-hidden">
          <Sidebar />
        </div>
      </div>
    </div>
  )
}
