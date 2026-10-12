import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { reactErrorHooks, startErrorTracking } from './errorTracking'

createRoot(document.getElementById('root'), reactErrorHooks).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// After the first render is under way, so the crash-report library never
// delays the page appearing.
startErrorTracking()
