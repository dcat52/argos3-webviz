import { useEffect } from 'react'
import { Layout } from './ui/Layout'
import { useConnectionStore } from './stores/connectionStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { TooltipProvider } from '@/components/ui/tooltip'
import './entities/index'

export function App() {
  useEffect(() => {
    useConnectionStore.getState().connect()
  }, [])

  useKeyboardShortcuts()

  return (
    <TooltipProvider delayDuration={300}>
      <Layout />
    </TooltipProvider>
  )
}
