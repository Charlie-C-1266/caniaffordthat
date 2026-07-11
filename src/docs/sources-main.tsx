import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import '../index.css'
import { SourcesPage } from './SourcesPage'

// The non-null assertion is safe: index.html (this entry's HTML shell) always
// contains a `<div id="root">` for Vite/React to mount into.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SourcesPage />
    <SpeedInsights />
    <Analytics />
  </StrictMode>,
)
