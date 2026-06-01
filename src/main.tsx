import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import './i18n/index.js'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary.js'
import { initTelemetry } from './utils/telemetry.js'

// Apply persisted theme on load (before first render) to avoid flash.
try {
  const v = localStorage.getItem('terrimap_theme')
  const theme = v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  if (theme === 'dark') document.documentElement.classList.add('dark')
  else if (theme === 'light') document.documentElement.classList.remove('dark')
  else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', prefersDark)
  }
} catch {
  // ignore storage errors
}

// Install global error + rejection listeners (prevents silent blank screens).
initTelemetry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
