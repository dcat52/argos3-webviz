import { useEffect, lazy, Suspense } from 'react'
import { Layout } from './ui/Layout'
import { ViewerLayout } from './ui/ViewerLayout'
import { useConnectionStore } from './stores/connectionStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { TooltipProvider } from '@/components/ui/tooltip'
import { APP_MODE, WS_URL } from './lib/params'
import './entities/index'

const Dashboard = lazy(() => import('./dashboard/Dashboard').then((m) => ({ default: m.Dashboard })))

function NormalApp() {
  useKeyboardShortcuts()
  return (
    <TooltipProvider delayDuration={300}>
      <Layout />
    </TooltipProvider>
  )
}

export function App() {
  useEffect(() => {
    if (APP_MODE !== 'dashboard') {
      useConnectionStore.getState().connect(WS_URL ?? undefined)
    }
  }, [])

  if (APP_MODE === 'viewer') return <ViewerLayout />
  if (APP_MODE === 'dashboard') return <Suspense fallback={null}><Dashboard /></Suspense>
  return <NormalApp />
}
