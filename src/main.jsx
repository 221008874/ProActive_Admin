// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Self-hosted design fonts. Same families and weights the store app loads and
// tokens.css declares; the admin had no font loading at all before this, so it
// rendered in the browser default.
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'

// Layer order matters: tokens -> base -> components. components.css must come
// last so a .pa-* rule wins against an equal-specificity base rule.
import './tokens.css'
import './styles/components.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>  {/* MUST be here */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
