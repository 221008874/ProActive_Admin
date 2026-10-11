// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { DASHBOARD_ROOT, NAV, hrefFor } from './config/nav'

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

// One table drives both the sidebar and the routes below: NAV says which
// sections exist and what path each lives at, and this map says which component
// renders it. Adding a section therefore means one entry in NAV and one here —
// a nav item with no route cannot happen, so it cannot land the owner on the
// catch-all (which redirects to the login screen).
const SECTION_PAGES = {
  overview: OverviewPage,
  products: ProductsPage,
  orders: OrdersPage,
  bills: BillsPage,
  categories: CategoriesPage,
  coupons: CouponsPage,
  operations: OperationsPage,
  lowStock: LowStockPage
}

function App() {
  return (
    // LanguageProvider must wrap AuthProvider: the "not authorised" message the
    // guard renders is translated, so it needs t() before the guard runs.
    <LanguageProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </LanguageProvider>
  )
}

// Split from App so the route table can be rendered against a known session: the
// provider above renders nothing until the async claim read settles, which is
// correct for the app and useless for a test that wants to know which component a
// given URL resolves to.
export function AppRoutes() {
  return (
    <Routes>
      {/* Root route - redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Login route */}
      <Route path="/login" element={<SignIn />} />

      {/* The dashboard is one layout with nested sections. Every section is
          behind the admin claim because the guard sits on the layout. */}
      <Route path={DASHBOARD_ROOT} element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<Navigate to={hrefFor(NAV[0])} replace />} />
        {NAV.map((n) => {
          const Page = SECTION_PAGES[n.key]
          if (!Page) {
            console.error(`Admin section "${n.key}" is in NAV with no page component`)
            return null
          }
          return <Route key={n.key} path={n.path} element={<Page />} />
        })}
        <Route path="more" element={<MorePage />} />
      </Route>

      {/* Dev-only component gallery (absent from production builds) */}
      {import.meta.env.DEV && <Route path="/ui" element={<UiGallery />} />}

      {/* Catch all - redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
