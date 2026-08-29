import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './app/App'
import { AppProvider } from './context/AppProvider'
import { initializeDatabase } from './data/db/init'

registerSW({ immediate: true })

initializeDatabase().catch((error) => {
  console.error('Failed to initialize database:', error)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
