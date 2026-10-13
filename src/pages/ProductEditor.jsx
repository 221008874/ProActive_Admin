// Product editor.
//
// An overlay panel rather than a page: editing is a context switch the owner
// expects to come back from, and the stock grid is only useful beside the
// table it was opened from.
//
// The stock grid is the heart of it. It writes one variant document per
// colour × size, so "red, M has 3" is a fact in the database rather than a
// number derived somewhere in the UI.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button, Checkbox, ColorDot, ErrorState, Field, IconClose, IconPlus, IconTrash,
  Select, Skeleton, StockGrid, thumb, loc
} from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../ui/overlays'
import {
  fetchProductForEdit, saveProductWithStock, archiveProduct, computeDiscountPct, MAX_VARIANTS,
  validateEditorForm
} from '../services/products'
import { uploadImage } from '../services/cloudinary'

// Canonical size order — "2XL" is an alias for "XXL" and is normalised on load/save.
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']

// The order the summary lists problems in: identity, then money, then the grid.
// A field label per validation key, so the summary can say *where* to look
// rather than only *what* is wrong.
const ERROR_FIELDS = [
  { key: 'title', label: { en: 'Name', ar: 'الاسم' } },
  { key: 'slug', label: { en: 'Slug', ar: 'الرابط' } },
  { key: 'categoryId', label: { en: 'Category', ar: 'القسم' } },
  { key: 'price', label: { en: 'Price', ar: 'السعر' } },
  { key: 'compareAtPrice', label: { en: 'Compare-at price', ar: 'السعر قبل الخصم' } },
  { key: 'colors', label: { en: 'Colours', ar: 'الألوان' } },
  { key: 'sizes', label: { en: 'Sizes', ar: 'المقاسات' } },
  { key: 'variants', label: { en: 'Variants', ar: 'التراكيب' } },
  { key: 'images', label: { en: 'Photos', ar: 'الصور' } }
]

// The keys the live validation pass can decide from the form state. They are
// listed explicitly (rather than taken from the current error map) because the
// merge below has to know which fields the live pass has an *opinion* about —
// including the ones it currently considers fine, which is precisely what lets
// a stale "choose at least one colour" be dropped.
const LIVE_KEYS = ['price', 'compareAtPrice', 'colors', 'sizes', 'images', 'variants']

/** Translate a service validation message, filling the `{max}` placeholder. */
function translateError(t, message) {
  return t(message, { max: MAX_VARIANTS })
}

/** Normalise legacy "2XL" → "XXL" in a size array. */
function normaliseSizes(arr) {
  return (arr ?? []).map((s) => (s === '2XL' ? 'XXL' : s))
}

export default function ProductEditor({ productId, copyFrom, categories, L, onClose, onSaved }) {
  const { t, lang } = useLanguage()
  const toast = useToast()

  const [loading, setLoading] = useState(Boolean(productId || copyFrom))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  // Track which fields have been touched to only show validation after interaction
  const [touched, setTouched] = useState({})
  // Once the owner has pressed Save, service-level validation errors must show
  // regardless of whether that field was ever touched. Without this, a gate that
  // consulted only `touched` and `saving` was already false by render time
  // (setFormErrors in the catch and setSaving(false) in the finally are batched
  // together), so "Invalid product" appeared in the console and nowhere on screen.
  const [submitted, setSubmitted] = useState(false)
  // The body is a long scroll container: a per-field error can sit far above the
  // fold, so a failure the owner cannot see is a failure they cannot fix. This
  // ref lets the summary banner be scrolled into view after a rejected save.
  const bodyRef = useRef(null)

  const [title, setTitle] = useState({ ar: '', en: '' })
  const [description, setDescription] = useState({ ar: '', en: '' })
  const [slug, setSlug] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('active')
  const [price, setPrice] = useState('')
  const [compareAt, setCompareAt] = useState('')
  const [material, setMaterial] = useState('')
  const [care, setCare] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [featured, setFeatured] = useState(false)

  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [images, setImages] = useState([])
  const [stock, setStock] = useState({})
  const [uploading, setUploading] = useState(false)

  const sourceId = productId ?? copyFrom

  useEffect(() => {
    if (!sourceId) { setLoading(false); return }

    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const p = await fetchProductForEdit(sourceId)
        if (!alive) return
        if (!p) { setError(new Error('NOT_FOUND')); return }

        setTitle(p.title ?? { ar: '', en: '' })
        setDescription(p.description ?? { ar: '', en: '' })
        // A copy can never keep the original's slug: two products sharing one
        // makes the storefront's /product?slug= lookup ambiguous.
        setSlug(copyFrom ? `${p.slug ?? ''}-copy` : p.slug ?? '')
        setCategoryId(p.categoryId ?? '')
        // A copy starts as a draft, so a half-built duplicate is never live.
        setStatus(copyFrom ? 'draft' : p.status ?? 'active')
        setPrice(p.price == null ? '' : String(p.price))
        setCompareAt(p.compareAtPrice == null ? '' : String(p.compareAtPrice))
        setMaterial(p.material ?? '')
        setCare(Array.isArray(p.care) ? p.care.join(', ') : p.care ?? '')
        setShowNew(!!p.isNew)
        setFeatured(!!p.isFeatured)
        setColors(p.colors ?? [])
        setSizes(normaliseSizes(p.sizes ?? []))
        setImages((p.images ?? []).map((i) => ({ ...i, primary: !!i.isPrimary })))
        setStock(Object.fromEntries((p.variants ?? []).map((v) => [`${v.colorId}_${v.size}`, Number(v.stock ?? 0)])))
      } catch (e) {
        console.error('Could not load product for editing:', e)
        if (alive) setError(e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [sourceId, copyFrom])

  const discount = useMemo(
    () => computeDiscountPct(Number(price) || 0, Number(compareAt) || 0),
    [price, compareAt]
  )

  const totalStock = useMemo(
    () => Object.values(stock).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [stock]
  )

  // Live validation of what is on screen right now.
  //
  // The summary used to render a verbatim copy of the errors from the last
  // rejected save, so a field the owner had already repaired stayed listed:
  // "choose at least one colour" while the colour chip sat right above it,
  // with no way to tell whether pressing Save again would now work. This memo
  // re-derives the very list the service enforces — same grid, same coercions,
  // see validateEditorForm — from the current state, on every change.
  const liveErrors = useMemo(
    () => validateEditorForm({ price, compareAtPrice: compareAt, colors, sizes, images }, stock).errors,
    [price, compareAt, colors, sizes, images, stock]
  )

  // What the panel renders: the live list, plus any service error the live pass
  // cannot decide (a failed write surfaces as `_form`, which has no live
  // rule). A live-decided field the owner has since fixed disappears from here
  // immediately, so the banner can never ask them to fix something twice.
  const activeErrors = useMemo(() => {
    const merged = { ...liveErrors }
    for (const [key, message] of Object.entries(formErrors)) {
      if (LIVE_KEYS.includes(key)) continue
      merged[key] = message
    }
    return merged
  }, [liveErrors, formErrors])

  // Every validation message, paired with the label of the field it belongs to,
  // in a stable order. Driven off the live list so it can only ever say what is
  // currently wrong.
  const summary = useMemo(
    () => ERROR_FIELDS
      .filter(({ key }) => activeErrors[key])
      .map(({ key, label }) => ({ key, label: loc(label, lang), message: translateError(t, activeErrors[key]) })),
    [activeErrors, lang, t]
  )

  const save = async () => {
    // Mark all fields as touched on save attempt so validation shows
    setTouched({
      title: true,
      slug: true,
      categoryId: true,
      price: true,
      compareAt: true,
      colors: true,
      sizes: true,
      images: true,
      description: true,
      material: true,
      care: true
    })
    setSaving(true)
    setSubmitted(true)
    setFormErrors({})
    try {
      const id = await saveProductWithStock({
        product: {
          id: productId ?? null,
          title,
          description: description.ar || description.en ? description : null,
          slug,
          categoryId,
          status,
          price: Number(price),
          compareAtPrice: compareAt === '' ? null : Number(compareAt),
          material: material || null,
          care: care ? care.split(',').map((c) => c.trim()).filter(Boolean) : [],
          images: images.map(({ primary, ...rest }) => ({ ...rest, isPrimary: !!primary })),
          colors,
          sizes,
          isNew: showNew,
          isFeatured: featured
        },
        stock
      })
      toast.show(t('productSaved') ?? 'Product saved')
      onSaved?.(id)
    } catch (e) {
      console.error('Could not save product:', e)
      // The service throws a validation error carrying a field map, so the
      // owner is told which field to fix rather than just that it failed.
      if (e?.code === 'VALIDATION' && e.errors) {
        setFormErrors(e.errors)
        // The count is the union of what the live pass sees and what the
        // service rejected, minus the form-level error, because that is exactly
        // the list the summary is about to render.
        const count = new Set([
          ...Object.keys(liveErrors),
          ...Object.keys(e.errors)
        ].filter((k) => k !== '_form')).size
        // The per-field messages are rendered where the fields are, which for a
        // long form means off-screen. Surface the count in a toast so a failed
        // save is never a console-only event, and pull the summary into view.
        toast.show(
          L('fixFields', 'Fix {count} field(s) to save this product.', 'ظبط {count} حقل عشان تحفظ المنتج.').replace('{count}', count),
          { duration: 6000 }
        )
        requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' }))
      } else {
        setFormErrors({ _form: e?.message ?? String(e) })
      }
    } finally {
      setSaving(false)
    }
  }

  const archive = async () => {
    if (!productId) return
    if (!window.confirm(t('archiveProductConfirm') ?? 'Archive this product?')) return
    try {
      await archiveProduct(productId)
      onSaved?.(productId)
    } catch (e) {
      console.error('Could not archive product:', e)
      setFormErrors({ _form: e?.message ?? String(e) })
    }
  }

  if (loading) {
    return (
      <EditorShell title={t('editProduct')} L={L} onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Skeleton variant="line" width="60%" height={26} />
          <Skeleton variant="line" width="40%" />
          <Skeleton count={6} />
        </div>
      </EditorShell>
    )
  }

  if (error) {
    return (
      <EditorShell title={t('editProduct')} L={L} onClose={onClose}>
        <ErrorState
          title={L('loadFailed', 'Could not load this product', 'تحميل المنتج فشل')}
          body={L('maybeDeleted', 'It may have been deleted.', 'يمكن يكون اتمسح.')}
          onRetry={onClose}
          retryLabel={L('close', 'Close', 'إغلاق')}
        />
      </EditorShell>
    )
  }

return (
    <EditorShell
      title={productId ? t('editProduct') : t('addProduct')}
      L={L}
      onClose={onClose}
      bodyRef={bodyRef}
      footer={
        <>
          {productId && (
            <Button variant="danger" onClick={archive} disabled={saving}>{t('archiveProduct')}</Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? L('saving', 'Saving…', 'جاري الحفظ…') : t('save')}
          </Button>
        </>
      }
    >
      {activeErrors._form && (
        <div className="pa-callout pa-callout--error" role="alert"><bdi className="pa-ltr">{activeErrors._form}</bdi></div>
      )}

      {/* Summary of everything currently wrong, in one block. The per-field
          messages stay where the fields are; this is the one the owner is
          guaranteed to see, because it sits at the top of the scroll area. */}
      {submitted && summary.length > 0 && (
        <div className="pa-callout pa-callout--error" role="alert">
          <b>{L('cannotSaveYet', 'Cannot save yet', 'لسه مش قادر تحفظ')}</b>
          <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
            {summary.map((s) => (
              <li key={s.key}>
                <b>{s.label}</b>{' — '}{s.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="pa-editor__section">
        <div className="pa-editor__row">
          <Field id="e-title-en" label={t('nameEn')} value={title.en}
            onChange={(e) => setTitle((p) => ({ ...p, en: e.target.value }))}
            onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
            error={activeErrors.title && (touched.title || submitted) ? (translateError(t, activeErrors.title)) : undefined} />
          <Field id="e-title-ar" label={t('nameAr')} value={title.ar} dir="rtl"
            onChange={(e) => setTitle((p) => ({ ...p, ar: e.target.value }))}
            onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
            error={activeErrors.title && (touched.title || submitted) ? (translateError(t, activeErrors.title)) : undefined} />
        </div>
        <div className="pa-editor__row">
          <Field id="e-slug" label={`${t('slug')} (${t('optional')})`} value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, slug: true }))}
            error={activeErrors.slug && (touched.slug || submitted) ? (translateError(t, activeErrors.slug)) : undefined}
            hint={L('slugHint', 'Used in links. Generated from the English title when empty.', 'بيتستخدم في الروابط. بيتولد من الاسم الإنجليزي لو فاضي.')} />
          <Select id="e-status" label={t('status')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">{t('active')}</option>
            <option value="draft">{t('draft')}</option>
            <option value="archived">{t('archived')}</option>
          </Select>
        </div>
        <Select id="e-category" label={t('category')} value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, categoryId: true }))}
          error={activeErrors.categoryId && (touched.categoryId || submitted) ? (translateError(t, activeErrors.categoryId)) : undefined}>
          <option value="">{L('noCategory', 'No category', 'بدون قسم')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{loc(c.name, lang)}</option>
          ))}
        </Select>
        <Field id="e-desc-en" label={`${t('description')} (EN)`} value={description.en}
          onChange={(e) => setDescription((p) => ({ ...p, en: e.target.value }))}
          onBlur={() => setTouched((prev) => ({ ...prev, description: true }))}
          error={activeErrors.description && (touched.description || submitted) ? (translateError(t, activeErrors.description)) : undefined} />
        <Field id="e-desc-ar" label={`${t('description')} (AR)`} value={description.ar} dir="rtl"
          onChange={(e) => setDescription((p) => ({ ...p, ar: e.target.value }))}
          onBlur={() => setTouched((prev) => ({ ...prev, description: true }))}
          error={activeErrors.description && (touched.description || submitted) ? (translateError(t, activeErrors.description)) : undefined} />
      </section>

      <section className="pa-editor__section">
        <div className="pa-editor__row">
          <Field id="e-price" label={t('price')} type="number" min="0" step="0.01" value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
            error={activeErrors.price && (touched.price || submitted) ? (translateError(t, activeErrors.price)) : undefined} />
          <Field id="e-compare" label={t('compareAtPrice')} type="number" min="0" step="0.01" value={compareAt}
            onChange={(e) => setCompareAt(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, compareAt: true }))}
            error={activeErrors.compareAtPrice && (touched.compareAt || submitted) ? (translateError(t, activeErrors.compareAtPrice)) : undefined}
            hint={L('compareHint', 'The old price, if this piece is on sale.', 'السعر القديم، لو القطعة عليها خصم.')} />
        </div>
        {/* The number the storefront will actually show, before it is saved. */}
        {discount > 0 && (
          <div className="pa-callout">
            {L('discountPreview', 'Shown as', 'هيظهر كـ')}{' '}
            <b style={{ color: 'var(--pa-sale)' }}>-{discount}%</b>
          </div>
        )}
        <div className="pa-editor__row">
          <Field id="e-material" label={`${t('material')} (${t('optional')})`} value={material}
            onChange={(e) => setMaterial(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, material: true }))}
            error={activeErrors.material && (touched.material || submitted) ? (translateError(t, activeErrors.material)) : undefined} />
          <Field id="e-care" label={`${t('care')} (${t('optional')})`} value={care}
            onChange={(e) => setCare(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, care: true }))}
            error={activeErrors.care && (touched.care || submitted) ? (translateError(t, activeErrors.care)) : undefined}
            hint={L('careHint', 'Comma separated, e.g. machine wash cold, do not bleach', 'مفصولة بفاصلة')} />
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Checkbox id="e-new" label={t('showNewBadge')} checked={showNew} onChange={setShowNew} />
          <Checkbox id="e-featured" label={t('featured')} checked={featured} onChange={setFeatured} />
        </div>
      </section>

      <section className="pa-editor__section">
        <div className="pa-group-title">{t('colors')}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {colors.map((c) => (
            <span key={c.id} className="pa-colorchip">
              <ColorDot color={c} lang={lang} selected={false} />
              <span>{loc(c.name, lang)}</span>
              <button type="button" aria-label={`${t('remove')} ${loc(c.name, lang)}`}
                onClick={() => {
                  setColors((prev) => prev.filter((x) => x.id !== c.id))
                  // Stock for a removed colour has no column left to live in.
                  setStock((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`${c.id}_`))))
                }}>
                <IconClose width={16} height={16} />
              </button>
            </span>
          ))}
          <ColorAdder onAdd={(c) => setColors((prev) => [...prev, c])} taken={colors.map((c) => c.id)} L={L} />
        </div>
        {activeErrors.colors && (touched.colors || submitted) && <div className="pa-error">{translateError(t, activeErrors.colors)}</div>}
      </section>

      <section className="pa-editor__section">
        <div className="pa-group-title">{t('sizes')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SIZE_OPTIONS.map((s) => (
            <button key={s} type="button" className="pa-size" aria-pressed={sizes.includes(s)}
              onClick={() => setSizes((prev) => {
                const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                // Keep sizes in canonical order
                return next.sort((a, b) => SIZE_OPTIONS.indexOf(a) - SIZE_OPTIONS.indexOf(b))
              })}
              onBlur={() => setTouched((prev) => ({ ...prev, sizes: true }))}>
              {s}
            </button>
          ))}
        </div>
        {activeErrors.sizes && (touched.sizes || submitted) && <div className="pa-error">{translateError(t, activeErrors.sizes)}</div>}
      </section>

      <section className="pa-editor__section">
        <div className="pa-group-title">
          {t('stockByColorAndSize')}
          <span className="pa-subtitle" style={{ marginInlineStart: 8, fontWeight: 400 }}>
            {L('stockTotalLabel', 'Total {total} · 0 = sold out', 'الإجمالي {total} · 0 = نفذت').replace('{total}', totalStock)}
          </span>
        </div>
        {colors.length === 0 || sizes.length === 0 ? (
          <p className="pa-subtitle">
            {L('needColorSize', 'Add at least one colour and one size to enter stock.', 'ضيف لون واحد ومقاس واحد عشان تدخل المخزون.')}
          </p>
        ) : (
          <StockGrid
            colors={colors}
            sizes={sizes}
            stock={stock}
            lang={lang}
            onChange={(variantId, value) =>
              setStock((prev) => ({ ...prev, [variantId]: Math.max(0, Math.floor(Number(value) || 0)) }))}
          />
        )}
      </section>

      <section className="pa-editor__section">
        <div className="pa-group-title">{t('photos')}</div>
        <div className="pa-photogrid">
          {images.map((img, i) => (
            <div key={img.url ?? i} className={`pa-phototile ${img.primary ? 'is-primary' : ''}`}>
              <img src={thumb(img.url, 200)} alt="" loading="lazy" />
              <span className="pa-phototile__dot" style={{ '--sw': colors.find((c) => c.id === img.color)?.hex ?? '#121212' }} />
              <button type="button" className="pa-phototile__primary" aria-pressed={!!img.primary}
                aria-label={`${t('primaryPhoto')} ${i + 1}`}
                onClick={() => setImages((prev) => prev.map((x, j) => ({ ...x, primary: j === i })))}>
                {i + 1}
              </button>
              <button type="button" className="pa-phototile__remove" aria-label={t('remove')}
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}>
                <IconTrash width={16} height={16} />
              </button>
            </div>
          ))}
          <PhotoUploader
            busy={uploading}
            L={L}
            onUpload={async (file) => {
              setUploading(true)
              try {
                const url = await uploadImage(file)
                setImages((prev) => [...prev, {
                  url,
                  primary: prev.length === 0,
                  color: colors[0]?.id ?? null
                }])
              } catch (e) {
                console.error('Upload failed:', e)
                setFormErrors({ _form: t('uploadFailed') ?? 'Upload failed' })
              } finally {
                setUploading(false)
              }
            }}
          />
        </div>
        {activeErrors.images && (touched.images || submitted) && <div className="pa-error">{translateError(t, activeErrors.images)}</div>}
      </section>

      {/* The service can reject the whole form on the variant list ("add at least
          one variant"). Nothing in the body renders that key, so it used to be
          the one validation error with no on-screen home at all. */}
      {activeErrors.variants && submitted && (
        <div className="pa-callout pa-callout--error" role="alert">
          {translateError(t, activeErrors.variants)}
        </div>
      )}
    </EditorShell>
  )
}

/* -------------------------------------------------------------------------- */

/** The panel chrome: a sticky ink header, a scrolling body, a sticky footer. */
function EditorShell({ title, L, onClose, footer, bodyRef, children }) {
  return (
    <>
      <div className="pa-sheet-backdrop" onClick={onClose} />
      <aside className="pa-editor" role="dialog" aria-modal="true" aria-label={title}>
        <header className="pa-editor__head">
          <h2>{title}</h2>
          <button type="button" className="pa-icon-btn" style={{ width: 44, height: 44 }}
            aria-label={L('close', 'Close', 'إغلاق')} onClick={onClose}>
            <IconClose width={22} height={22} />
          </button>
        </header>
        <div className="pa-editor__body" ref={bodyRef}>{children}</div>
        {footer && <footer className="pa-editor__foot">{footer}</footer>}
      </aside>
    </>
  )
}

function ColorAdder({ onAdd, taken, L }) {
  const [open, setOpen] = useState(false)
  const [en, setEn] = useState('')
  const [ar, setAr] = useState('')
  const [hex, setHex] = useState('#121212')

  const id = en.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const duplicate = Boolean(id) && taken.includes(id)

  const add = () => {
    if (!en.trim() || !id || duplicate) return
    onAdd({ id, name: { ar: ar.trim() || en.trim(), en: en.trim() }, hex })
    setEn(''); setAr(''); setHex('#121212'); setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="pa-dashedchip" onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {L('addColor', 'Colour', 'لون')}
      </button>
    )
  }

  return (
    <span className="pa-coloradder">
      <Field id="ca-en" label={L('colorNameEn', 'Colour (EN)', 'اللون (إنجليزي)')} admin value={en}
        onChange={(e) => setEn(e.target.value)} />
      <Field id="ca-ar" label={L('colorNameAr', 'Colour (AR)', 'اللون (عربي)')} admin dir="rtl" value={ar}
        onChange={(e) => setAr(e.target.value)} />
      <Field id="ca-hex" label={L('colorHex', 'Hex', 'كود اللون')} admin value={hex}
        onChange={(e) => setHex(e.target.value)} />
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" onClick={add} disabled={!en.trim() || !id || duplicate}>
          {L('add', 'Add', 'إضافة')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          {L('cancel', 'Cancel', 'إلغاء')}
        </Button>
      </span>
      {duplicate && <span className="pa-error">{L('colorTaken', 'A colour with that name exists.', 'في لون بنفس الاسم.')}</span>}
    </span>
  )
}

function PhotoUploader({ busy, onUpload, L }) {
  const inputRef = useRef(null)

  return (
    <>
      <button type="button" className="pa-phototile pa-phototile--dashed" disabled={busy}
        onClick={() => inputRef.current?.click()}>
        {busy ? L('uploading', 'Uploading…', 'جاري الرفع…') : `+ ${L('addPhoto', 'Photo', 'صورة')}`}
      </button>
      {/* One input, many files: the picker is one click but each file uploads
          on its own, so one failure does not lose the rest. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="pa-sr"
        onChange={(e) => {
          for (const file of Array.from(e.target.files ?? [])) onUpload(file)
          e.target.value = ''
        }}
      />
    </>
  )
}