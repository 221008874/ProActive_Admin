// Products — the table and its search.
//
// A product is a parent document plus one variant per colour × size, so the
// editor's centre of gravity is the stock grid (ProductEditor). Everything else
// here is about finding the right one to edit.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button, EmptyState, ErrorState, IconPlus, IconSearch, PageTitle, Select, Skeleton,
  StatusPill, formatEGP, loc, thumb
} from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../ui/overlays'
import { fetchAllProducts } from '../services/products'
import { fetchCategories } from '../services/categories'
import ProductEditor from './ProductEditor'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

const PAGE_SIZE = 25

export default function ProductsPage() {
  const { t, lang } = useLanguage()
  const toast = useToast()
  const L = label(t, lang)

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, cats] = await Promise.all([
        fetchAllProducts(),
        fetchCategories().catch(() => [])
      ])
      setProducts(list)
      setCategories(cats)
    } catch (e) {
      console.error('Could not load products:', e)
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, reload])

  // Search matches the localized title, the SKU on the product itself and the
  // slug, because that is what an owner remembers a product by.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (status !== 'all' && (p.status ?? 'active') !== status) return false
      if (!q) return true
      const hay = [loc(p.title, lang), loc(p.title, lang === 'ar' ? 'en' : 'ar'), p.slug ?? '']
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [products, query, status, lang])

  const sorted = useMemo(() => filtered.slice().sort((a, b) => {
    const at = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0
    const bt = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0
    return bt - at
  }), [filtered])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const shown = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  const lowStockCount = useMemo(
    () => products.filter((p) => p.totalStock > 0 && p.totalStock <= 5).length,
    [products]
  )

  const onSaved = () => {
    setEditing(null)
    setReload((n) => n + 1)
    toast.show(t('productSaved') ?? 'Product saved')
  }

  return (
    <div className="pa-admin-products">
      <PageTitle
        title={t('products')}
        subtitle={L('productsSummary', `{n} products · {m} with low stock`, `{n} منتج · {m} مخزون منخفض`)
          .replace('{n}', products.length)
          .replace('{m}', lowStockCount)}
        actions={
          <>
            <div className="pa-field" style={{ minWidth: 200 }}>
              <label className="pa-sr" htmlFor="p-search">{t('search')}</label>
              <div className="pa-searchbox">
                <IconSearch width={18} height={18} />
                <input
                  id="p-search"
                  className="pa-input pa-input--admin"
                  type="search"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(0) }}
                  placeholder={t('search')}
                />
              </div>
            </div>
            <Select
              id="p-status"
              className="pa-field"
              admin
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(0) }}
              aria-label={t('status')}
            >
              <option value="all">{t('all')}</option>
              <option value="active">{t('active')}</option>
              <option value="draft">{t('draft')}</option>
              <option value="archived">{t('archived')}</option>
            </Select>
            <Button onClick={() => setEditing({ isNew: true })}>
              <IconPlus width={18} height={18} />
              {t('addProduct')}
            </Button>
          </>
        }
      />

      {loading && <ProductsTableSkeleton />}

      {!loading && error && (
        <ErrorState
          title={L('loadFailed', 'Could not load products', 'تحميل المنتجات فشل')}
          body={L('checkConnection', 'Check your connection and try again.', 'راجع الاتصال وجرب تاني.')}
          onRetry={() => setReload((n) => n + 1)}
          retryLabel={L('retry', 'Try again', 'جرب تاني')}
        />
      )}

      {!loading && !error && sorted.length === 0 && (
        <EmptyState
          title={L('noProducts', 'No products', 'مفيش منتجات')}
          body={L('noProductsBody', query ? 'Nothing matched your search.' : 'Add the first product to see it here.', '')}
          actionLabel={query ? L('clearSearch', 'Clear search', 'امسح البحث') : t('addProduct')}
          onAction={() => (query ? setQuery('') : setEditing({ isNew: true }))}
        />
      )}

      {!loading && !error && sorted.length > 0 && (
        <>
          {/* The table scrolls inside its own box rather than the page, so a
              wide table never introduces a horizontal page scroll. */}
          <div className="pa-tablebox">
            <div className="pa-table" role="table" aria-label={t('products')}>
              <div className="pa-tr pa-tr--head" role="row">
                <span className="pa-sr" role="columnheader">{t('image')}</span>
                <span role="columnheader">{t('productTitle')}</span>
                <span role="columnheader">{t('category')}</span>
                <span role="columnheader">{t('price')}</span>
                <span role="columnheader">{t('stock')}</span>
                <span role="columnheader">{t('status')}</span>
                <span role="columnheader">{t('edit')}</span>
              </div>

              {shown.map((p) => {
                const total = Number(p.totalStock ?? 0)
                const category = categories.find((c) => c.id === p.categoryId)
                const img = p.images?.find((i) => i.isPrimary)?.url ?? p.images?.[0]?.url
                return (
                  <div key={p.id} className={`pa-tr ${editing?.id === p.id ? 'pa-tr--selected' : ''}`} role="row">
                    <span className="pa-thumb" style={img ? { backgroundImage: `url(${thumb(img, 120)})` } : undefined} aria-hidden="true" />
                    <span role="cell">
                      <b>{loc(p.title, lang)}</b>
                      <br />
                      <span className="pa-subtitle pa-ltr">{p.sku ?? p.id}</span>
                    </span>
                    <span role="cell">{category ? loc(category.name, lang) : '—'}</span>
                    <span role="cell">
                      <bdi>{formatEGP(p.price ?? 0, lang)}</bdi>
                      {p.compareAtPrice > p.price && (
                        <>
                          <br />
                          <s className="pa-subtitle">{formatEGP(p.compareAtPrice, lang)}</s>
                        </>
                      )}
                    </span>
                    <span role="cell" className={total <= 0 ? 'pa-error' : total <= 5 ? 'pa-stock-hint' : 'pa-ok'}>
                      {total <= 0 ? t('soldOut') : total <= 5 ? L('lowN', `Low · ${total} left`, `منخفض · باقي ${total}`) : L('inStockN', `${total} in stock`, `${total} متاح`)}
                    </span>
                    <span role="cell"><StatusPill status={p.status ?? 'active'} label={t(p.status ?? 'active')} /></span>
                    <span role="cell" style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="pa-btn pa-btn--sm pa-btn--outline"
                        onClick={() => setEditing({ id: p.id })}>
                        {t('edit')}
                      </button>
                      <button type="button" className="pa-btn pa-btn--sm pa-btn--outline"
                        onClick={() => setEditing({ id: p.id, copy: true })}>
                        {t('copyProduct')}
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pa-admin-pager">
            <span className="pa-subtitle">
              {L('showingRange', 'Showing {from}–{to} of {total}', 'عرض {from}–{to} من {total}')
                .replace('{from}', current * PAGE_SIZE + 1)
                .replace('{to}', Math.min(sorted.length, (current + 1) * PAGE_SIZE))
                .replace('{total}', sorted.length)}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
                {L('prev', 'Previous', 'السابق')}
              </Button>
              <Button size="sm" variant="outline" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
                {L('next', 'Next', 'التالي')}
              </Button>
            </span>
          </div>
        </>
      )}

      {editing && (
        <ProductEditor
          productId={editing.copy ? null : editing.id}
          copyFrom={editing.copy ? editing.id : null}
          categories={categories}
          L={L}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

// A table-shaped placeholder: the header and column widths are already correct
// when the rows land, so nothing shifts underneath the owner.
function ProductsTableSkeleton() {
  return (
    <div className="pa-tablebox" aria-hidden="true">
      <div className="pa-table">
        <div className="pa-tr pa-tr--head">
          <span /><span /><span /><span /><span /><span /><span />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div className="pa-tr" key={i}>
            <Skeleton style={{ width: 52, height: 64 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton variant="line" width="70%" />
              <Skeleton variant="line" width="40%" />
            </span>
            <Skeleton variant="line" width="60%" />
            <Skeleton variant="line" width="50%" />
            <Skeleton variant="line" width="45%" />
            <Skeleton variant="line" width="60%" />
            <Skeleton variant="line" width="70%" />
          </div>
        ))}
      </div>
    </div>
  )
}
