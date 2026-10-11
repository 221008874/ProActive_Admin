// The admin shell's navigation.
//
// A pure description: tab ids, the route segment each one lives at, and the
// dictionary key its label comes from, translated where the nav is built. Kept
// out of DashboardRouter so the routes and the sidebar cannot disagree about
// what the sections are.
//
// `path` is separate from `key` on purpose. `key` is an identifier and is free
// to be camelCase; `path` is a URL segment and is kebab-case. Reusing the one
// for the other meant the sidebar linked to /dashboard/lowStock while the route
// was /dashboard/low-stock, which matched nothing and fell through to the
// catch-all — sending the owner to the login screen instead of the low-stock
// page. App.jsx builds its routes from this same list, so the two cannot drift
// apart again.

export const NAV = [
  { key: 'overview', path: 'overview', labelKey: 'overview' },
  { key: 'products', path: 'products', labelKey: 'products' },
  { key: 'orders', path: 'orders', labelKey: 'orders', badge: 'pendingOrders', badgeTone: 'sale' },
  { key: 'bills', path: 'bills', labelKey: 'bills' },
  { key: 'categories', path: 'categories', labelKey: 'categoriesAndCollections' },
  { key: 'coupons', path: 'coupons', labelKey: 'coupons' },
  { key: 'operations', path: 'operations', labelKey: 'operations' },
  { key: 'lowStock', path: 'low-stock', labelKey: 'lowStock', badge: 'lowStockVariants', badgeTone: 'low' }
]

// The phone bottom bar shows four; the rest are reachable from the sidebar on
// wider screens and from the "More" entry on a phone.
export const PHONE_TABS = ['orders', 'products', 'coupons', 'more']

export const DASHBOARD_ROOT = '/dashboard'

export const hrefFor = (nav) => `${DASHBOARD_ROOT}/${nav.path}`

export const navKeyFor = (key) => NAV.find((n) => n.key === key)?.labelKey ?? key