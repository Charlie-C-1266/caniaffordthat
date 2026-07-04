import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { CalculatorProvider } from './state/CalculatorProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CalculatorProvider>
      <App />
    </CalculatorProvider>
    <SpeedInsights />
    <Analytics />
  </StrictMode>,
)
