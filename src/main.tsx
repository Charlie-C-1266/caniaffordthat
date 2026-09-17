import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import { App } from './App.tsx'
import { CalculatorProvider } from './state/CalculatorProvider.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// The non-null assertion is safe: index.html (this entry's HTML shell) always
// contains a `<div id="root">` for Vite/React to mount into.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Above the provider too: hydrating state from a shared link's query
        params happens in the provider's initializer, so a crash there must
        also land in the fallback rather than a blank page. */}
    <ErrorBoundary>
      <CalculatorProvider>
        <App />
      </CalculatorProvider>
    </ErrorBoundary>
    <SpeedInsights />
    <Analytics />
  </StrictMode>,
)
