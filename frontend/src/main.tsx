import '@fontsource/playfair-display/latin-400.css'
import '@fontsource/playfair-display/latin-500.css'
import '@fontsource/playfair-display/latin-600.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/playfair-display/latin-400-italic.css'
import '@fontsource/rethink-sans/latin-400.css'
import '@fontsource/rethink-sans/latin-500.css'
import '@fontsource/rethink-sans/latin-600.css'
import '@fontsource/rethink-sans/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/roboto-mono/latin-400.css'
import './styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Aplikasi } from './app/Aplikasi'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Aplikasi />
  </StrictMode>,
)
