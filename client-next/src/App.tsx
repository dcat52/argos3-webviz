import { useEffect } from 'react'
import { Layout } from './ui/Layout'
import { useConnectionStore } from './stores/connectionStore'
import './entities/index' // side-effect: register entity renderers

export function App() {
  useEffect(() => {
    useConnectionStore.getState().connect()
  }, [])

  return <Layout />
}
