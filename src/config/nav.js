// The admin shell's navigation.
//
// A pure description: tab ids and the dictionary key each one's label comes
// from, translated where the nav is built. Kept out of DashboardRouter so the
// routes (added in the same pass) and the sidebar cannot disagree about what
// the sections are.

export const NAV = [
  { key: 'overview', labelKey: 'overview' },
  { key: 'products', labelKey: 'products' },
  { key: 'orders', labelKey: 'orders', badge: 'pendingOrders', badgeTone: 'sale' },
  { key: 'bills', labelKey: 'bills' },
  { key: 'categories', labelKey: 'categoriesAndCollections' },
  { key: 'coupons', labelKey: 'coupons' },
  { key: 'operations', labelKey: 'operations' },
  { key: 'lowStock', labelKey: 'lowStock', badge: 'lowStockVariants', badgeTone: 'low' }
]

// The phone bottom bar shows four; the rest are reachable from the sidebar on
// wider screens and from the "More" entry on a phone.
export const PHONE_TABS = ['orders', 'products', 'coupons', 'more']

export const navKeyFor = (key) => NAV.find((n) => n.key === key)?.labelKey ?? key
