import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './app/App'
import { AppProvider } from './context/AppProvider'
import { AuthProvider } from './context/AuthProvider'
import { initializeDatabase } from './data/db/init'

registerSW({ immediate: true })

initializeDatabase().catch((error) => {
  console.error('Failed to initialize database:', error)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppProvider>
  </StrictMode>,
)

const splash = document.getElementById('splash')
if (splash) {
  requestAnimationFrame(() => {
    splash.classList.add('splash-hidden')
    window.setTimeout(() => splash.remove(), 400)
  })
}
