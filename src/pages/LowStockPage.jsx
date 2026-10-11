// Low stock — the variants that are about to run out.
//
// Stock that is already zero is not shown: the storefront already refuses those
// lines, and burying the ones that can still be bought under sold-out rows is
// how a restock gets forgotten.
//
// Each row edits one variant's stock directly, because the common case is
// "we have six more, put them in", not "open the product and find the grid".

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import {
  Button, EmptyState, ErrorState, PageTitle, Skeleton, StatusPill, StepperField, loc, thumb
} from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../ui/overlays'
import { setVariantStock } from '../services/products'

const LOW_AT = 2

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function LowStockPage() {
  const { t, lang } = useLanguage()
  const toast = useToast()
  const L = label(t, lang)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const products = await getDocs(collection(db, 'products_egp'))

      // Firestore cannot count across a subcollection without a collection-group
      // index, and the catalogue is small, so this is N reads and always correct.
      const out = []
      for (const p of products.docs) {
        const product = p.data()
        if (product.status === 'archived') continue

        const variants = await getDocs(collection(db, 'products_egp', p.id, 'variants'))
        for (const v of variants.docs) {
          const data = v.data()
          const stock = Number(data.stock ?? 0)
          // Sold out is a different problem (someone needs to decide whether
          // to reorder), so this page is only for what can still be bought.
          if (stock > 0 && stock <= LOW_AT) {
            out.push({
              productId: p.id,
              variantId: v.id,
              title: product.title,
              image: product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url,
              colorId: data.colorId,
              color: data.color,
              size: data.size,
              stock,
              totalStock: Number(product.totalStock ?? 0)
            })
          }
        }
      }

      // Lowest first: the variant most at risk of running out is the one that
      // needs restocking today.
      out.sort((a, b) => a.stock - b.stock)
      setRows(out)
    } catch (e) {
      console.error('Could not load low stock:', e)
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, reload])

  const adjust = async (row, value) => {
    const previous = row.stock
    // Optimistic: the stepper must feel immediate, and a failed write is
    // reverted so the number on screen is never a lie.
    setRows((prev) => prev.map((r) =>
      (r.productId === row.productId && r.variantId === row.variantId)
        ? { ...r, stock: value }
        : r))
    try {
      await setVariantStock(row.productId, row.variantId, value)
      // A row that just reached zero leaves the list; one that came back in
      // from zero is picked up by the next load.
      setRows((prev) => prev.filter((r) => !(r.productId === row.productId && r.variantId === row.variantId && value <= 0)))
    } catch (e) {
      console.error('Could not adjust stock:', e)
      setRows((prev) => prev.map((r) =>
        (r.productId === row.productId && r.variantId === row.variantId)
          ? { ...r, stock: previous }
          : r))
      toast.show(e?.message ?? t('error'))
    }
  }

  const grouped = useMemo(() => rows.slice(0, 60), [rows])

  return (
    <div className="pa-lowstock">
      <PageTitle
        title={t('lowStock')}
        subtitle={L('lowStockSubtitle', 'Every variant with two or fewer left', 'كل قطعة متبقية ٢ أو أقل')}
      />

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="line" height={52} />)}
        </div>
      )}

      {!loading && error && (
        <ErrorState title={t('error')} onRetry={() => setReload((n) => n + 1)} retryLabel={t('retry')} />
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title={t('noLowStock')}
          body={L('noLowStockBody', 'Every variant has more than two in stock.', 'كل قطعة فيها أكتر من اتنين.')}
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="pa-lowstock__list">
            {grouped.map((row) => (
              <div className="pa-lowstockrow" key={`${row.productId}/${row.variantId}`}>
                <span className="pa-thumb" style={row.image ? { backgroundImage: `url(${thumb(row.image, 120)})` } : undefined} aria-hidden="true" />
                <span style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{loc(row.title, lang)}</span>
                  <span className="pa-subtitle">
                    {loc(row.color ?? row.colorId, lang)} · {row.size}
                  </span>
                </span>
                <StatusPill
                  status={row.stock === 0 ? 'cancelled' : 'pending'}
                  label={row.stock === 0 ? t('soldOut') : L('lowN', `Low · ${row.stock} left`, `منخفض · باقي ${row.stock}`)}
                />
                <StepperField
                  value={row.stock}
                  onChange={(v) => adjust(row, v)}
                  labels={{ dec: `${t('decrease')} ${row.size}`, inc: `${t('increase')} ${row.size}` }}
                />
                <Link className="pa-btn pa-btn--sm pa-btn--outline" to="/dashboard/products">
                  {t('edit')}
                </Link>
              </div>
            ))}
          </div>
          {rows.length > grouped.length && (
            <p className="pa-subtitle" style={{ marginTop: 12 }}>
              {L('showingFirst', 'Showing the 60 lowest of {n}', 'بنعرض ٦٠ الأقل من {n}')
                .replace('{n}', rows.length)}
            </p>
          )}
        </>
      )}
    </div>
  )
}