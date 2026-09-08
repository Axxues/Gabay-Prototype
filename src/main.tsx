import React from 'react'
import ReactDOM from 'react-dom/client'
import { LMSProvider } from './context/LMSContext'
import { AppContent } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LMSProvider>
      <AppContent />
    </LMSProvider>
  </React.StrictMode>,
)
