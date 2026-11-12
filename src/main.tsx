import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyColorScheme, readColorScheme } from './app/colorScheme.ts'
import './index.css'
import App from './App.tsx'

applyColorScheme(readColorScheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
