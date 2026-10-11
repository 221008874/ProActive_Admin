// The admin shell and the guard.
//
// Both live here because they are one decision: who may see this, and what
// wraps them while they are looking at it.
//
// The claim check is at the layout rather than on individual routes, so a
// section added later is protected by default instead of protected by whoever
// remembered to add a guard. Nav items are real router links into nested
// routes — that is what the previous shell got wrong: the props were never
// passed to it, so the sidebar could not move at all.

import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { AdminShell, OfflineBanner } from '../ui'
import { NAV, PHONE_TABS } from '../config/nav'
import { IconBag, IconMenu, IconPlus, IconShop } from '../ui'

/** Badges for the sidebar: pending orders and low-stock variants. */
function useNavBadges() {
  const [badges, setBadges] = useState({ pendingOrders: 0, lowStockVariants: 0 })
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const orders = await getDocs(query(collection(db, 'orders_egp'), where('status', '==', 'pending')))

        // Low stock walks each product's variants subcollection. There is no
        // cross-subcollection count without a collection-group index, and the
        // product count is small enough that N reads are fine.
        let low = 0
        const products = await getDocs(collection(db, 'products_egp'))
        for (const p of products.docs) {
          const variants = await getDocs(collection(db, 'products_egp', p.id, 'variants'))
          for (const v of variants.docs) {
            const stock = Number(v.data().stock ?? 0)
            if (stock > 0 && stock <= 2) low++
          }
        }

        if (alive) {
          setBadges({ pendingOrders: orders.size, lowStockVariants: low })
          setFailed(false)
        }
      } catch (e) {
        // A failed badge read must not stop the owner using the panel: the
        // badge is a convenience and every page recounts what it needs.
        console.error('Could not load nav badges:', e)
        if (alive) setFailed(true)
      }
    })()
    return () => { alive = false }
  }, [])

  return { badges, failed }
}

/**
 * RequireAdmin.
 *
 * Signed out goes to the login screen. Signed in without the admin claim is
 * signed out and told why — the usual cause is that setAdmin.mjs was never run
 * for that account, which is fixable and says so.
 */
export function RequireAdmin({ children }) {
  const { currentUser, isAdmin, status } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()

  if (status === 'loading') return null
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (!isAdmin) {
    return (
      <main className="pa-container" style={{ paddingBlock: 64, maxWidth: 520 }}>
        <div className="pa-block" role="alert">
          <h1 style={{ fontSize: 22 }}>{t('notAuthorizedTitle')}</h1>
          <p className="pa-subtitle">{t('notAuthorizedBody')}</p>
          <div className="pa-callout pa-callout--error">
            <bdi className="pa-ltr">{currentUser.email}</bdi>
          </div>
          <button type="button" className="pa-btn" onClick={() => signOut(auth)}>
            {t('signOut')}
          </button>
          <p className="pa-subtitle" style={{ marginTop: 8 }}>
            {t('notAuthorizedFix')}
          </p>
        </div>
      </main>
    )
  }

  return children
}

/** The four phone tabs: the sections an owner touches on a delivery run. */
const PHONE_ICONS = { orders: IconBag, products: IconShop, coupons: IconPlus, more: IconMenu }

export function AdminLayout() {
  const { currentUser } = useAuth()
  const { t } = useLanguage()
  const { badges, failed } = useNavBadges()
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])

  const items = NAV.map((n) => ({
    ...n,
    label: t(n.labelKey),
    href: `/dashboard/${n.key}`,
    badge: n.badge ? badges[n.badge] : undefined
  }))

  const phoneItems = PHONE_TABS.map((key) => {
    if (key === 'more') return { key, label: t('more'), href: '/dashboard/more', Icon: PHONE_ICONS.more }
    const item = items.find((i) => i.key === key)
    return item ? { ...item, Icon: PHONE_ICONS[key] } : null
  }).filter(Boolean)

  return (
    <AdminShell
      items={items}
      phoneItems={phoneItems}
      email={currentUser?.email}
      onSignOut={() => signOut(auth)}
      labels={{ signOut: t('signOut'), brand: t('admin') }}
    >
      {/* Offline: writes will fail, so say so before the owner types a form. */}
      {offline && <OfflineBanner message={t('offline') ?? 'You are offline.'} />}
      {failed && (
        <div className="pa-subtitle" style={{ padding: '8px 16px 0' }}>
          {t('badgesFailed') ?? 'Live counts could not be loaded; every page recounts what it needs.'}
        </div>
      )}
      <Outlet />
    </AdminShell>
  )
}

/** "More": the sections a phone hides behind its fourth tab. */
export function MorePage() {
  const { t } = useLanguage()
  const hidden = NAV.filter((n) => !PHONE_TABS.includes(n.key))

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>{t('more')}</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hidden.map((n) => (
          <NavLink key={n.key} to={`/dashboard/${n.key}`} className="pa-drawer__row">
            {t(n.labelKey)}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
