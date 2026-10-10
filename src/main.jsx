// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
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
