import { createRoot } from 'react-dom/client'
import { App } from './App'
import './stores/features'
import './index.css'

createRoot(document.getElementById('root')!).render(<App />)
