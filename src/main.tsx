import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import './i18n/index.js'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary.js'
import { initTelemetry } from './utils/telemetry.js'

// Apply system theme on load before first render
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
if (prefersDark) document.documentElement.classList.add('dark')

// Install global error + rejection listeners (prevents silent blank screens).
initTelemetry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
