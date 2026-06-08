import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import './i18n/index.js'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary.js'
import { initTelemetry } from './utils/telemetry.js'

// ?p d?ng theme s?m ?? l?u ngay khi t?i v? tr?nh nh?y giao di?n.
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
  // b? qua l?i l?u tr?
}

// G?n listener l?i to?n c?c v? rejection ?? tr?nh m?n h?nh tr?ng im l?ng.
initTelemetry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
