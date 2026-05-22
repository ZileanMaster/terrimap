import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import './i18n/index.js'
import App from './App'

// Apply system theme on load before first render
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
if (prefersDark) document.documentElement.classList.add('dark')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
