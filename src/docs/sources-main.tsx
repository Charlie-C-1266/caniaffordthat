import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import '../index.css'
import { SourcesPage } from './SourcesPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SourcesPage />
    <SpeedInsights />
    <Analytics />
  </StrictMode>,
)
