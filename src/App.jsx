// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'

// Auth Pages
import SignIn from './pages/SignIn'

// Admin Dashboard
import { RequireAdmin, AdminLayout, MorePage } from './pages/AdminShell'
import OverviewPage from './pages/OverviewPage'
import ProductsPage from './pages/ProductsPage'
import OrdersPage from './pages/OrdersPage'
import BillsPage from './pages/BillsPage'
import CouponsPage from './pages/CouponsPage'
import OperationsPage from './pages/OperationsPage'
import LowStockPage from './pages/LowStockPage'
import CategoriesPage from './pages/CategoriesPage'

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

          {/* The dashboard is one layout with nested sections. Every section is
              behind the admin claim because the guard sits on the layout. */}
          <Route path="/dashboard" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<Navigate to="/dashboard/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="bills" element={<BillsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="coupons" element={<CouponsPage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="low-stock" element={<LowStockPage />} />
            <Route path="more" element={<MorePage />} />
          </Route>

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
