// Product form â€” the admin's main data entry, now on the design system.
//
// The service layer has been fashion-model ready since productLogic.js
// (validateProduct / computeDenorm / variantsFromGrid) and saveProduct()
// accepts a variants array; this form was still writing the old flat chocolate
// shape (name / flavors / piecesPerBox / stock), so the admin could not edit
// the colourأ—size stock the storefront actually reads.
//
// Now it edits the real model: images, colours, sizes and a stock grid that
// produces the variants subcollection the storefront renders.

import { useMemo, useState } from 'react'
import { uploadImage } from '../services/cloudinary'
import { saveProduct, validateProduct } from '../services/products'
import { loc, discountPct } from '../ui'
import { StockGrid, variantsToStock, stockToVariants, thumb } from '../ui'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export default function ProductForm({ product = null, onSuccess, collectionName }) {
  const editing = Boolean(product?.id)

  const [title, setTitle] = useState(() => bi(product?.title, ''))
  const [description, setDescription] = useState(() => bi(product?.description, ''))
  const [price, setPrice] = useState(product?.price ?? '')
  const [compareAtPrice, setCompareAtPrice] = useState(product?.compareAtPrice ?? '')
  const [images, setImages] = useState(() => (product?.images ?? []).map((i) => ({ ...i })))
  const [colors, setColors] = useState(() => product?.colors ?? [])
  const [sizes, setSizes] = useState(() => product?.sizes ?? [...SIZES])
  const [stock, setStock] = useState(() =>
    product?.variants?.length ? variantsToStock(product.variants) : {}
  )
  const [newColor, setNewColor] = useState({ en: '', ar: '', hex: '#000000' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

  const variants = useMemo(
    () => stockToVariants(colors, sizes, stock, product?.variants ?? []),
    [colors, sizes, stock, product]
  )

  const pct = useMemo(
    () => discountPct(Number(price) || 0, Number(compareAtPrice) || 0),
    [price, compareAtPrice]
  )

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }
    setError('')
    setBusy(true)
    try {
      const url = await uploadImage(file)
      setImages((prev) => [
        ...prev,
        { url, isPrimary: prev.length === 0, color: colors[0]?.id ?? null }
      ])
      setNotice('Image uploaded')
      setTimeout(() => setNotice(''), 3000)
    } catch (err) {
      setError('Failed to upload image: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const addColor = () => {
    const en = newColor.en.trim()
    if (!en) return
    const id = slug(en)
    if (colors.some((c) => c.id === id)) return
    setColors((prev) => [...prev, { id, name: { en, ar: newColor.ar.trim() || en }, hex: newColor.hex }])
    setNewColor({ en: '', ar: '', hex: '#000000' })
  }

  const removeColor = (id) => {
    setColors((prev) => prev.filter((c) => c.id !== id))
    // Drop the variant rows for that colour so they are not written back.
    setStock((prev) => {
      const next = { ...prev }
      for (const size of sizes) delete next[`${id}_${size}`]
      return next
    })
  }

  const toggleSize = (size) => {
    setSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...SIZES.filter((s) => [...prev, size].includes(s))]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setErrors({})

    const data = {
      title,
      description,
      price: Number(price) || 0,
      compareAtPrice: compareAtPrice === '' ? null : Number(compareAtPrice) || 0,
      images,
      colors,
      sizes
    }

    const check = validateProduct(data, variants)
    if (!check.isValid) {
      setErrors(check.errors)
      setError(check.errors.variants || check.errors.colors || check.errors.sizes || check.errors.images || 'Please check the form')
      return
    }

    setBusy(true)
    try {
      await saveProduct(product?.id ?? null, data, variants)
      setNotice(editing ? 'Product updated' : 'Product added')
      setTimeout(() => onSuccess?.(), 500)
    } catch (err) {
      if (err?.code === 'VALIDATION') {
        setErrors(err.errors || {})
        setError('Invalid product')
      } else {
        setError(err.message || 'Failed to save product')
      }
      setNotice('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && <div className="pa-error" role="alert">{error}</div>}
      {notice && <div className="pa-ok" role="status">{notice}</div>}
      <div className="pa-subtitle">Saving to <bdi>{collectionName}</bdi></div>

      {/* ---- images ---- */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((img, i) => (
            <div key={i} className="pa-thumb" style={{ position: 'relative', width: 72, height: 88 }}>
              <img
                src={thumb(img.url, 160)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                type="button"
                className="pa-icon-btn"
                aria-label={`Remove image ${i + 1}`}
                style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 28, height: 28, background: 'var(--pa-paper)', borderRadius: '50%', border: '1px solid var(--pa-line)' }}
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
              >
                &#215;
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="pa-btn pa-btn--outline pa-btn--sm" style={{ cursor: 'pointer' }}>
            {busy ? 'Uploadingâ€¦' : 'Upload image'}
            <input type="file" accept="image/*" onChange={handleFileChange} hidden disabled={busy} />
          </label>
          <span className="pa-subtitle">Square, min 600أ—600, under 5 MB</span>
        </div>
      </div>

      {/* ---- copy ---- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <div className="pa-field" style={{ flex: '1 1 260px' }}>
          <label className="pa-label" htmlFor="pf-title-en">Title (English)</label>
          <input id="pf-title-en" className="pa-input pa-input--admin" value={title.en} onChange={(e) => setTitle((p) => ({ ...p, en: e.target.value }))} placeholder="Linen shirt" />
        </div>
        <div className="pa-field" style={{ flex: '1 1 260px' }}>
          <label className="pa-label" htmlFor="pf-title-ar">Title (Arabic)</label>
          <input id="pf-title-ar" className="pa-input pa-input--admin" value={title.ar} onChange={(e) => setTitle((p) => ({ ...p, ar: e.target.value }))} placeholder="ظ‚ظ…ظٹطµ ظƒطھط§ظ†" lang="ar" />
        </div>
      </div>

      <div className="pa-field">
        <label className="pa-label" htmlFor="pf-desc">Description</label>
        <textarea
          id="pf-desc"
          className="pa-input pa-input--admin"
          rows="4"
          value={description.en}
          onChange={(e) => setDescription((p) => ({ ...p, en: e.target.value }))}
          placeholder="Describe the productâ€¦"
        />
      </div>

      {/* ---- money ---- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div className="pa-field" style={{ flex: '1 1 180px' }}>
          <label className="pa-label" htmlFor="pf-price">Price (EGP)</label>
          <input id="pf-price" className="pa-input pa-input--admin" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          {errors.price && <span className="pa-error">{errors.price}</span>}
        </div>
        <div className="pa-field" style={{ flex: '1 1 180px' }}>
          <label className="pa-label" htmlFor="pf-compare">Compare-at price</label>
          <input id="pf-compare" className="pa-input pa-input--admin" type="number" min="0" step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="optional" />
          {errors.compareAtPrice && <span className="pa-error">{errors.compareAtPrice}</span>}
          {pct > 0 && <span className="pa-ok">-{pct}%</span>}
        </div>
      </div>

      {/* ---- colours ---- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="pa-pdp__label">Colours</div>
        {errors.colors && <span className="pa-error">{errors.colors}</span>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {colors.map((c) => (
            <button
              key={c.id}
              type="button"
              className="pa-chip"
              aria-label={`Remove ${loc(c.name, 'en')}`}
              title={`Remove ${loc(c.name, 'en')}`}
              onClick={() => removeColor(c.id)}
            >
              <span className="pa-dot" style={{ '--sw': c.hex }} />
              {loc(c.name, 'en')} &#215;
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="pa-field" style={{ flex: '1 1 160px' }}>
            <label className="pa-label" htmlFor="pf-newcolor-en">New colour</label>
            <input id="pf-newcolor-en" className="pa-input pa-input--admin" value={newColor.en} onChange={(e) => setNewColor((p) => ({ ...p, en: e.target.value }))} placeholder="Black" />
          </div>
          <div className="pa-field" style={{ flex: '1 1 160px' }}>
            <label className="pa-label" htmlFor="pf-newcolor-ar">Arabic name</label>
            <input id="pf-newcolor-ar" className="pa-input pa-input--admin" lang="ar" value={newColor.ar} onChange={(e) => setNewColor((p) => ({ ...p, ar: e.target.value }))} placeholder="ط£ط³ظˆط¯" />
          </div>
          <div className="pa-field" style={{ flex: '0 0 auto' }}>
            <label className="pa-label" htmlFor="pf-newcolor-hex">Swatch</label>
            <input id="pf-newcolor-hex" type="color" className="pa-input pa-input--admin" style={{ width: 56, padding: 4 }} value={newColor.hex} onChange={(e) => setNewColor((p) => ({ ...p, hex: e.target.value }))} />
          </div>
          <button type="button" className="pa-btn pa-btn--outline pa-btn--admin" onClick={addColor}>Add colour</button>
        </div>
      </div>

      {/* ---- sizes ---- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="pa-pdp__label">Sizes</div>
        {errors.sizes && <span className="pa-error">{errors.sizes}</span>}
        <div className="pa-sizes">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={`pa-size ${sizes.includes(s) ? 'pa-size--selected' : ''}`}
              aria-pressed={sizes.includes(s)}
              onClick={() => toggleSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ---- the stock grid ---- */}
      <div className="pa-pdp__label">Stock</div>
      {errors.variants && <span className="pa-error">{errors.variants}</span>}
      <StockGrid
        colors={colors}
        sizes={sizes}
        stock={stock}
        onChange={(id, n) => setStock((prev) => ({ ...prev, [id]: n }))}
        lang="en"
        totalLabel={`${variants.length} variants آ· ${sum(stock)} units`}
      />

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" className="pa-btn pa-btn--outline pa-btn--admin" onClick={() => onSuccess?.()}>Cancel</button>
        <button type="submit" className="pa-btn pa-btn--admin" disabled={busy}>
          {busy ? 'Savingâ€¦' : editing ? 'Update product' : 'Add product'}
        </button>
      </div>
    </form>
  )
}

// Bi-directional field reader/writer: Firestore titles are {ar,en}; the inputs
// are a controlled pair, so the state starts as that same shape.
function bi(field, fallback) {
  if (field && typeof field === 'object') {
    return { en: field.en ?? '', ar: field.ar ?? '' }
  }
  return { en: typeof field === 'string' ? field : fallback, ar: fallback }
}

function sum(stock) {
  return Object.values(stock).reduce((t, n) => t + (Number(n) || 0), 0)
}

