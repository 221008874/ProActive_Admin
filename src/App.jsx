// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'

// Auth Pages
import SignIn from './pages/SignIn'

// Admin Dashboard
import DashboardRouter from './pages/DashboardRouter'

// Dev-only gallery of the design system, dropped from the production bundle by
// the same DEV guard the store app uses. Delete this block and
// src/pages/UiGallery.jsx together.
import UiGallery from './pages/UiGallery'

function App() {
  return (
    // LanguageProvider must wrap AuthProvider: the "not authorised" message the
    // guard renders is translated, so it needs t() before the guard runs.
    <LanguageProvider>
      <AuthProvider>
        <Routes>
          {/* Root route - redirect to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Login route */}
          <Route path="/login" element={<SignIn />} />

          {/* Admin Dashboard Routes */}
          <Route path="/dashboard/*" element={<DashboardRouter />} />

          {/* Dev-only component gallery (absent from production builds) */}
          {import.meta.env.DEV && <Route path="/ui" element={<UiGallery />} />}

          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App