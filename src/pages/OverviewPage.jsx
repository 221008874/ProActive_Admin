// Overview — the three numbers that decide what to do next.
//
// Pending orders is a queue to work through, today's total is the day so far,
// and low-stock variants are what will run out. They are in that order because
// that is the order an owner answers them in.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '../services/firebase'
import { Button, EmptyState, ErrorState, PageTitle, Skeleton, StatusPill, formatEGP } from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { NAV, hrefFor } from '../config/nav'
import { orderStatusLabel } from '../services/orderLabels'

// Section links go through the nav table rather than a literal path: the same
// mismatch that sent "Low stock" to the login screen started as a hardcoded URL.
const hrefForKey = (key) => hrefFor(NAV.find((n) => n.key === key))

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function OverviewPage() {
  const { t, lang } = useLanguage()
  const L = label(t, lang)

  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const [pending, recentOrders, products] = await Promise.all([
        getDocs(query(collection(db, 'orders_egp'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'orders_egp'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'products_egp'))
      ])

      // Today's total is computed here rather than read from stats_daily: the
      // rollup is a nightly job, so during the day it would show yesterday.
      const todaysTotal = recentOrders.docs
        .filter((o) => {
          const at = o.data().createdAt?.toMillis?.() ?? 0
          return at >= startOfDay.getTime() && o.data().status !== 'cancelled'
        })
        .reduce((sum, o) => sum + Number(o.data().total ?? 0), 0)

      let low = 0
      for (const p of products.docs) {
        const variants = await getDocs(collection(db, 'products_egp', p.id, 'variants'))
        for (const v of variants.docs) {
          const n = Number(v.data().stock ?? 0)
          if (n > 0 && n <= 2) low++
        }
      }

      setStats({ pending: pending.size, todaysTotal, low })
      setRecent(recentOrders.docs.slice(0, 5).map((d) => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error('Could not load overview:', e)
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, reload])

  return (
    <div className="pa-overview">
      <PageTitle title={t('overview')} />

      {loading && (
        <div className="pa-statgrid" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="pa-statcard" key={i}>
              <Skeleton variant="line" width="50%" height={12} />
              <Skeleton variant="line" width="40%" height={32} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState title={t('error')} onRetry={() => setReload((n) => n + 1)} retryLabel={t('retry')} />
      )}

      {!loading && !error && stats && (
        <>
          <div className="pa-statgrid">
            <StatCard label={t('pendingOrders')} value={String(stats.pending)} to={hrefForKey('orders')} />
            <StatCard label={t('todaysTotal')} value={formatEGP(stats.todaysTotal, lang)} />
            <StatCard label={t('lowStockVariants')} value={String(stats.low)} to={hrefForKey('lowStock')} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            {/* A React Router <Link> navigates on `to`, not `href`. Button
                forwards every extra prop onto the element it renders, so
                `as={Link} href=...` put an href on a Link - which ignored it and
                left both quick actions dead. `to=` is what actually navigates. */}
            <Button as={Link} to={hrefForKey('orders')}>{t('goToOrders')}</Button>
            <Button as={Link} variant="outline" to={hrefForKey('lowStock')}>{t('goToLowStock')}</Button>
          </div>

          <section style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>{t('recentOrders')}</h2>
            {recent.length === 0 ? (
              <EmptyState title={t('noOrders')} />
            ) : (
              <div className="pa-tablebox">
                <div className="pa-table" role="table" aria-label={t('recentOrders')}>
                  <div className="pa-tr pa-tr--head" role="row">
                    <span role="columnheader">{t('orderNumber')}</span>
                    <span role="columnheader">{t('customer')}</span>
                    <span role="columnheader">{t('status')}</span>
                    <span role="columnheader">{t('total')}</span>
                    <span role="columnheader">{t('placed')}</span>
                  </div>
                  {recent.map((o) => (
                    <div className="pa-tr" key={o.id} role="row">
                      <span role="cell"><b className="pa-ltr">{o.orderNumber ?? o.id.slice(-6)}</b></span>
                      <span role="cell">{o.customer?.name}</span>
                      <span role="cell"><StatusPill status={o.status} label={orderStatusLabel(t, o.status)} /></span>
                      <span role="cell"><bdi>{formatEGP(o.total ?? 0, lang)}</bdi></span>
                      <span role="cell" className="pa-subtitle">{when(o.createdAt, lang)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, to }) {
  const content = (
    <>
      <span className="pa-statcard__label">{label}</span>
      <span className="pa-statcard__value">{value}</span>
    </>
  )
  return to
    ? <Link className="pa-statcard" to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</Link>
    : <div className="pa-statcard">{content}</div>
}

function when(ts, lang) {
  const ms = ts?.toMillis ? ts.toMillis() : Number(ts) || 0
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}