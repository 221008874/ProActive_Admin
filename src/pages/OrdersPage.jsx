// Orders — the queue an owner works through.
//
// One table per status tab, one detail panel, and the transitions the order
// lifecycle actually allows. The buttons come from a single table keyed by
// status, so a new status is a data change rather than a new branch in the JSX.
//
// Cancelling is the one action with consequences: it puts stock and coupon use
// back. It is behind a confirmation that says so, because it is not obviously
// undoable to the person clicking.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button, EmptyState, ErrorState, IconPhone, PageTitle, Select, Skeleton, StatusPill,
  formatEGP, loc, thumb
} from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../ui/overlays'
import { setStatus, cancelOrder, fetchOrders, fetchOrdersByStatus } from '../services/orders'
import { packingSlipPdf } from '../services/packingSlip'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

/** The lifecycle, as data. `actions` are the buttons shown for that status. */
const FLOW = {
  pending: ['confirm'],
  confirmed: ['ship'],
  shipped: ['deliver', 'return'],
  delivered: [],
  cancelled: [],
  returned: []
}

const STATUS_TABS = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

const RANGES = ['today', 'last7Days', 'thisMonth', 'all']

export default function OrdersPage() {
  const { t, lang } = useLanguage()
  const toast = useToast()
  const L = label(t, lang)

  const [tab, setTab] = useState('pending')
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [range, setRange] = useState('today')
  const [reload, setReload] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Counts come from the same fetch as the list, so a tab count can never
      // disagree with the rows behind it.
      const [list, all] = await Promise.all([
        // Cancelled and returned share a tab, so they are one query.
        tab === 'cancelled' ? fetchOrdersByStatus(['cancelled', 'returned']) : fetchOrdersByStatus(tab),
        fetchOrders()
      ])
      setOrders(list)
      setCounts(all.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1
        return acc
      }, {}))
    } catch (e) {
      console.error('Could not load orders:', e)
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load, reload])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const since = rangeSince(range)
    return orders.filter((o) => {
      if (since && toMillis(o.createdAt) < since) return false
      if (!q) return true
      const hay = [o.orderNumber ?? o.id, o.customer?.phone, o.customer?.name]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [orders, query, range])

  const act = async (order, action) => {
    setBusy(true)
    try {
      if (action === 'cancel') {
        if (!window.confirm(t('cancelOrderConfirm') ?? 'Cancel this order? Stock and coupon use are restored.')) {
          setBusy(false)
          return
        }
        await cancelOrder(order.id, 'cancelled')
        toast.show(t('orderCancelled') ?? 'Order cancelled')
      } else {
        const next = { confirm: 'confirmed', ship: 'shipped', deliver: 'delivered', return: 'returned' }[action]
        await setStatus(order.id, next)
        toast.show(t(`status_${next}`) ?? `Marked ${next}`)
      }
      setSelected(null)
      setReload((n) => n + 1)
    } catch (e) {
      // A rejected transition is almost always "someone else moved it first";
      // the message says so rather than showing a raw Firestore error.
      console.error('Order action failed:', e)
      toast.show(e?.code === 'BAD_TRANSITION'
        ? (t('actionFailed') ?? 'That order already moved on')
        : (e?.message ?? t('actionFailed')))
      setReload((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pa-orders">
      <PageTitle
        title={t('orders')}
        subtitle={L('ordersSummary', '{n} in this queue', '{n} في القائمة دي').replace('{n}', filtered.length)}
        actions={
          <>
            <Select id="o-range" className="pa-field" admin value={range}
              onChange={(e) => setRange(e.target.value)} aria-label={t('dateRange')}>
              {RANGES.map((r) => <option key={r} value={r}>{t(r === 'all' ? 'all' : r)}</option>)}
            </Select>
            <div className="pa-field" style={{ minWidth: 220 }}>
              <label className="pa-sr" htmlFor="o-search">{t('searchByOrderOrPhone')}</label>
              <div className="pa-searchbox">
                <input id="o-search" className="pa-input pa-input--admin" type="search"
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('searchByOrderOrPhone')} />
              </div>
            </div>
          </>
        }
      />

      {/* Status tabs: the active one underlined in ink, each with its count. */}
      <div className="pa-statustabs" role="tablist" aria-label={t('status')}>
        {STATUS_TABS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={tab === s}
            className="pa-statustab" onClick={() => { setTab(s); setSelected(null) }}>
            {t(`status_${s}`)}
            {counts[s] ? <span className="pa-statustab__count">{counts[s]}</span> : null}
          </button>
        ))}
      </div>

      {loading && <OrdersTableSkeleton />}

      {!loading && error && (
        <ErrorState title={t('error')} onRetry={() => setReload((n) => n + 1)} retryLabel={t('retry')} />
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState title={t('noOrders')} body={L('noOrdersBody', 'Nothing in this queue right now.', 'القائمة دي فاضية دلوقتي.')} />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="pa-orders__split">
          <div className="pa-tablebox">
            <div className="pa-table" role="table" aria-label={t('orders')}>
              <div className="pa-tr pa-tr--head" role="row">
                <span role="columnheader">{t('orderNumber')}</span>
                <span role="columnheader">{t('customer')}</span>
                <span role="columnheader">{t('governorate')}</span>
                <span role="columnheader">{t('items')}</span>
                <span role="columnheader">{t('total')}</span>
                <span role="columnheader">{t('placed')}</span>
              </div>
              {filtered.map((o) => (
                <div key={o.id} className={`pa-tr ${selected?.id === o.id ? 'pa-tr--selected' : ''}`}
                  role="row" onClick={() => setSelected(o)}>
                  <span role="cell"><b className="pa-ltr">{o.orderNumber ?? o.id.slice(-6)}</b></span>
                  <span role="cell">
                    {o.customer?.name}
                    <br />
                    <span className="pa-subtitle pa-ltr">{maskPhone(o.customer?.phone)}</span>
                  </span>
                  <span role="cell">{loc(o.address?.governorate, lang) || o.address?.governorate || '—'}</span>
                  <span role="cell">{o.items?.length ?? 0}</span>
                  <span role="cell"><bdi>{formatEGP(o.total ?? 0, lang)}</bdi></span>
                  <span role="cell" className="pa-subtitle">{when(o.createdAt, lang)}</span>
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <OrderDetail order={selected} busy={busy} lang={lang} onAction={act}
              onClose={() => setSelected(null)} />
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function OrderDetail({ order, busy, lang, onAction, onClose }) {
  const { t } = useLanguage()
  const actions = FLOW[order.status] ?? []

  const mapsHref = order.address?.lat && order.address?.lng
    ? `https://maps.google.com/?q=${order.address.lat},${order.address.lng}`
    : null

  return (
    <aside className="pa-orderdetail" aria-label={t('orderDetails')}>
      <header className="pa-orderdetail__head">
        <div>
          <b className="pa-ltr" style={{ fontSize: 18 }}>{order.orderNumber ?? order.id}</b>
          <StatusPill status={order.status} label={t(`status_${order.status}`)} />
        </div>
        <button type="button" className="pa-icon-btn" style={{ width: 44, height: 44 }}
          aria-label={t('close')} onClick={onClose}>
          ×
        </button>
      </header>

      <div className="pa-orderdetail__body">
        <section className="pa-block" style={{ border: 0 }}>
          <div className="pa-group-title">{t('customer')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b>{order.customer?.name}</b>
            <a className="pa-ltr" href={`tel:${order.customer?.phone}`}>{order.customer?.phone}</a>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="pa-btn pa-btn--outline pa-btn--compact" href={`tel:${order.customer?.phone}`}>
              <IconPhone width={16} height={16} />
              {t('call')}
            </a>
            <a className="pa-btn pa-btn--outline pa-btn--compact"
              href={whatsappHref(order.customer?.phone, loc(order.items?.[0]?.title, lang) ?? 'your order')}>
              {t('whatsapp')}
            </a>
          </div>
        </section>

        <section className="pa-block" style={{ border: 0 }}>
          <div className="pa-group-title">{t('deliverTo')}</div>
          <address style={{ fontStyle: 'normal', fontSize: 14, lineHeight: 1.5 }}>
            {[order.address?.street, order.address?.building, order.address?.city]
              .filter(Boolean).join(', ')}
            <br />
            {loc(order.address?.governorate, lang) || order.address?.governorate}
          </address>
          {mapsHref && (
            <a className="pa-btn pa-btn--outline pa-btn--compact" href={mapsHref}
              target="_blank" rel="noreferrer noopener">
              {t('mapsLink')}
            </a>
          )}
        </section>

        <section className="pa-block" style={{ border: 0 }}>
          <div className="pa-group-title">{t('items')}</div>
          {order.items?.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 10, alignItems: 'center' }}>
              <span className="pa-thumb" style={{ flex: '0 0 44px', width: 44, height: 58, backgroundImage: item.image ? `url(${thumb(item.image, 100)})` : undefined }} aria-hidden="true" />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{loc(item.title ?? item.name, lang)}</span>
                <span className="pa-subtitle">
                  {[item.color, item.size, item.sku].filter(Boolean).join(' · ')} · ×{item.qty ?? item.quantity ?? 1}
                </span>
              </span>
              <bdi>{formatEGP((item.unitPrice ?? item.price ?? 0) * (item.qty ?? item.quantity ?? 1), lang)}</bdi>
            </div>
          ))}
        </section>

        <section className="pa-block" style={{ border: 0 }}>
          <div className="pa-summary__row"><span>{t('subtotal')}</span><bdi>{formatEGP(order.subtotal ?? 0, lang)}</bdi></div>
          {order.discount > 0 && (
            <div className="pa-summary__row"><span>{t('coupon')}</span><bdi>-{formatEGP(order.discount, lang)}</bdi></div>
          )}
          <div className="pa-summary__row"><span>{t('shipping')}</span><bdi>{formatEGP(order.shippingCost ?? 0, lang)}</bdi></div>
          <div className="pa-summary__row pa-summary__row--total">
            <span>{t('collectOnDelivery')}</span>
            <bdi>{formatEGP(order.total ?? 0, lang)}</bdi>
          </div>
        </section>

        <section className="pa-block" style={{ border: 0 }}>
          <div className="pa-group-title">{t('history')}</div>
          {order.statusHistory?.length
            ? order.statusHistory.map((h, i) => (
              <div key={i} className="pa-subtitle" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{t(`status_${h.status}`) ?? h.status}</span>
                <span className="pa-ltr">{when(h.at, lang)}</span>
              </div>
            ))
            : <span className="pa-subtitle">{t('noStatusHistory')}</span>}
        </section>
      </div>

      <footer className="pa-orderdetail__foot">
        <Button variant="outline" block onClick={() => packingSlipPdf(order, lang)} disabled={busy}>
          {t('printPackingSlip')}
        </Button>
        {actions.map((a) => (
          <Button key={a} block disabled={busy} onClick={() => onAction(order, a)}>
            {t(`action_${a}`)}
          </Button>
        ))}
        {/* Cancel is offered wherever the order still holds stock. */}
        {!['cancelled', 'returned', 'delivered'].includes(order.status) && (
          <Button variant="danger" block disabled={busy} onClick={() => onAction(order, 'cancel')}>
            {t('cancelOrder')}
          </Button>
        )}
      </footer>
    </aside>
  )
}

/* -------------------------------------------------------------------------- */

function OrdersTableSkeleton() {
  return (
    <div className="pa-tablebox" aria-hidden="true">
      <div className="pa-table">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="pa-tr" key={i}>
            <Skeleton variant="line" width="70%" />
            <Skeleton variant="line" width="90%" />
            <Skeleton variant="line" width="60%" />
            <Skeleton variant="line" width="30%" />
            <Skeleton variant="line" width="60%" />
            <Skeleton variant="line" width="70%" />
          </div>
        ))}
      </div>
    </div>
  )
}

const toMillis = (ts) => (ts?.toMillis ? ts.toMillis() : Number(ts) || 0)

function rangeSince(range) {
  const now = Date.now()
  if (range === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  if (range === 'last7Days') return now - 7 * 24 * 60 * 60 * 1000
  if (range === 'thisMonth') {
    const d = new Date(now)
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  }
  return 0
}

function when(ts, lang) {
  const ms = toMillis(ts)
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

/** Masked in the table; full in the detail panel, where it is actionable. */
function maskPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 6) return phone ?? ''
  return `${digits.slice(0, 4)}•••${digits.slice(-3)}`
}

function whatsappHref(phone, itemName) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  const text = encodeURIComponent(`Hello, about your order: ${itemName}`)
  return `https://wa.me/20${digits.startsWith('0') ? digits.slice(1) : digits}?text=${text}`
}