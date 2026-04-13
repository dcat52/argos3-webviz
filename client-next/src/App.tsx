import { useEffect } from 'react'
import { Layout } from './ui/Layout'
import { useConnectionStore } from './stores/connectionStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import './entities/index'

export function App() {
  useEffect(() => {
    useConnectionStore.getState().connect()
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      <Layout />
    </TooltipProvider>
  )
}
