// Categories and collections.
//
// Two small tables sharing a page, because they answer the same question in
// different shapes: what the storefront groups, and what it features. Both are
// bilingual by name, because the same word is read in both languages on the
// same screen.

import { useCallback, useEffect, useState } from 'react'
import {
  Button, Checkbox, EmptyState, ErrorState, Field, IconClose, IconTrash, PageTitle,
  Select, Skeleton, thumb
} from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../ui/overlays'
import {
  fetchCategories, saveCategory, deleteCategory,
  fetchCollections, saveCollection, deleteCollection
} from '../services/categories'
import { fetchAllProducts } from '../services/products'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function CategoriesPage() {
  const { t, lang } = useLanguage()
  const toast = useToast()
  const L = label(t, lang)

  const [categories, setCategories] = useState([])
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)

  const [editingCategory, setEditingCategory] = useState(null)
  const [editingCollection, setEditingCollection] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cats, cols] = await Promise.all([fetchCategories(), fetchCollections()])
      setCategories(cats)
      setCollections(cols)
    } catch (e) {
      console.error('Could not load categories:', e)
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, reload])

  const removeCategory = async (c) => {
    if (!window.confirm(t('deleteCategoryConfirm') ?? 'Delete this category?')) return
    try {
      await deleteCategory(c.id)
      toast.show(L('deleted', 'Category deleted', 'القسم اتمسح'))
      setReload((n) => n + 1)
    } catch (e) {
      // The service refuses to orphan children or products, and says which.
      console.error('Could not delete category:', e)
      toast.show(e?.code === 'HAS_CHILDREN'
        ? L('hasChildren', 'That category has sub-categories.', 'القسم ده فيه أقسام فرعية.')
        : e?.code === 'IN_USE'
          ? L('inUse', `Products still use this category (${e.count}).`, `في منتجات لسه بتستخدم القسم ده (${e.count}).`)
          : e?.message ?? t('error'))
    }
  }

  const removeCollection = async (c) => {
    if (!window.confirm(t('deleteCollectionConfirm') ?? 'Delete this collection?')) return
    try {
      await deleteCollection(c.id)
      toast.show(L('deleted', 'Collection deleted', 'التشكيلة اتمسحت'))
      setReload((n) => n + 1)
    } catch (e) {
      console.error('Could not delete collection:', e)
      toast.show(e?.message ?? t('error'))
    }
  }

  return (
    <div className="pa-collections">
      <PageTitle title={t('categoriesAndCollections')} />

      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="line" height={44} />)}
      </div>}

      {!loading && error && (
        <ErrorState title={t('error')} onRetry={() => setReload((n) => n + 1)} retryLabel={t('retry')} />
      )}

      {!loading && !error && (
        <div className="pa-cols">
          <section className="pa-listcol">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontSize: 18 }}>{t('categories')}</h2>
              <Button size="sm" onClick={() => setEditingCategory({ isNew: true })}>{t('addCategory')}</Button>
            </div>

            {categories.length === 0 ? (
              <EmptyState title={t('noCategories')} />
            ) : (
              <div className="pa-tablebox">
                <div className="pa-table pa-table--cats" role="table" aria-label={t('categories')}>
                  <div className="pa-tr pa-tr--head" role="row">
                    <span role="columnheader">{t('nameEn')}</span>
                    <span role="columnheader">{t('nameAr')}</span>
                    <span role="columnheader">{t('parent')}</span>
                    <span role="columnheader">{t('order')}</span>
                    <span role="columnheader">{t('active')}</span>
                    <span role="columnheader">{t('edit')}</span>
                  </div>
                  {categories.map((c) => (
                    <div className="pa-tr" key={c.id} role="row">
                      <span role="cell">
                        <b>{c.name?.en ?? '—'}</b>
                        <br />
                        <span className="pa-subtitle pa-ltr">{c.slug}</span>
                      </span>
                      <span role="cell">{c.name?.ar ?? '—'}</span>
                      <span role="cell" className="pa-subtitle">{c.parentId ?? t('noParent')}</span>
                      <span role="cell">{c.order ?? 0}</span>
                      <span role="cell">{c.active !== false ? t('yes') : t('no')}</span>
                      <span role="cell" style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="pa-btn pa-btn--sm pa-btn--outline" onClick={() => setEditingCategory(c)}>
                          {t('edit')}
                        </button>
                        <button type="button" className="pa-btn pa-btn--sm pa-btn--outline"
                          aria-label={`${t('delete')} ${c.name?.en ?? c.id}`} onClick={() => removeCategory(c)}>
                          <IconTrash width={16} height={16} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="pa-listcol">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontSize: 18 }}>{t('collections')}</h2>
              <Button size="sm" onClick={() => setEditingCollection({ isNew: true })}>{t('addCollection')}</Button>
            </div>

            {collections.length === 0 ? (
              <EmptyState title={t('noCollections')} />
            ) : (
              <div className="pa-tablebox">
                <div className="pa-table" role="table" aria-label={t('collections')}>
                  <div className="pa-tr pa-tr--head" role="row">
                    <span role="columnheader">{t('nameEn')}</span>
                    <span role="columnheader">{t('nameAr')}</span>
                    <span role="columnheader">{t('items')}</span>
                    <span role="columnheader">{t('active')}</span>
                    <span role="columnheader">{t('edit')}</span>
                  </div>
                  {collections.map((c) => (
                    <div className="pa-tr" key={c.id} role="row">
                      <span role="cell">
                        <b>{c.title?.en ?? '—'}</b>
                        <br />
                        <span className="pa-subtitle pa-ltr">{c.slug}</span>
                      </span>
                      <span role="cell">{c.title?.ar ?? '—'}</span>
                      <span role="cell">{c.productIds?.length ?? 0}</span>
                      <span role="cell">{c.active !== false ? t('yes') : t('no')}</span>
                      <span role="cell" style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="pa-btn pa-btn--sm pa-btn--outline" onClick={() => setEditingCollection(c)}>
                          {t('edit')}
                        </button>
                        <button type="button" className="pa-btn pa-btn--sm pa-btn--outline"
                          aria-label={`${t('delete')} ${c.title?.en ?? c.id}`} onClick={() => removeCollection(c)}>
                          <IconTrash width={16} height={16} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {editingCategory && (
        <CategoryEditor
          category={editingCategory}
          categories={categories}
          L={L}
          onClose={() => setEditingCategory(null)}
          onSaved={() => { setEditingCategory(null); setReload((n) => n + 1) }}
        />
      )}

      {editingCollection && (
        <CollectionEditor
          collection={editingCollection}
          L={L}
          onClose={() => setEditingCollection(null)}
          onSaved={() => { setEditingCollection(null); setReload((n) => n + 1) }}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Panel({ title, L, onClose, onSave, saving, children }) {
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
        <div className="pa-editor__body">{children}</div>
        <footer className="pa-editor__foot">
          <Button variant="outline" onClick={onClose} disabled={saving}>{L('cancel', 'Cancel', 'إلغاء')}</Button>
          <Button onClick={onSave} disabled={saving}>{L('saving', 'Saving…', 'جاري الحفظ…')}</Button>
        </footer>
      </aside>
    </>
  )
}

function CategoryEditor({ category, categories, L, onClose, onSaved }) {
  const { t } = useLanguage()
  const toast = useToast()
  const [nameEn, setNameEn] = useState(category.name?.en ?? '')
  const [nameAr, setNameAr] = useState(category.name?.ar ?? '')
  const [slug, setSlug] = useState(category.slug ?? '')
  const [parentId, setParentId] = useState(category.parentId ?? '')
  const [image, setImage] = useState(category.image ?? '')
  const [order, setOrder] = useState(String(category.order ?? 0))
  const [active, setActive] = useState(category.active !== false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await saveCategory(category.isNew ? null : category.id, { nameEn, nameAr, slug, parentId, image, order: Number(order), active })
      toast.show(t('categorySaved'))
      onSaved()
    } catch (e) {
      console.error('Could not save category:', e)
      toast.show(e?.message ?? t('error'))
      setSaving(false)
    }
  }

  return (
    <Panel title={category.isNew ? t('addCategory') : t('edit')} L={L} onClose={onClose} onSave={save} saving={saving}>
      <div className="pa-editor__row">
        <Field id="ce-en" label={t('nameEn')} admin value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        <Field id="ce-ar" label={t('nameAr')} admin dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
      </div>
      <Field id="ce-slug" label={t('slug')} admin className="pa-ltr" value={slug}
        onChange={(e) => setSlug(e.target.value)}
        hint={L('slugHint', 'Used in links. Generated from the English name when empty.', 'بيتستخدم في الروابط.')} />
      <Select id="ce-parent" label={t('parent')} value={parentId} onChange={(e) => setParentId(e.target.value)}>
        <option value="">{t('noParent')}</option>
        {categories.filter((c) => c.id !== category.id).map((c) => (
          <option key={c.id} value={c.id}>{c.name?.en ?? c.id}</option>
        ))}
      </Select>
      <Field id="ce-img" label={`${t('image')} (${t('optional')})`} admin className="pa-ltr" value={image}
        onChange={(e) => setImage(e.target.value)} />
      <Field id="ce-order" label={t('order')} type="number" admin value={order} onChange={(e) => setOrder(e.target.value)} />
      <Checkbox id="ce-active" label={t('active')} checked={active} onChange={setActive} />
    </Panel>
  )
}

function CollectionEditor({ collection, L, onClose, onSaved }) {
  const { t } = useLanguage()
  const toast = useToast()
  const [titleEn, setTitleEn] = useState(collection.title?.en ?? '')
  const [titleAr, setTitleAr] = useState(collection.title?.ar ?? '')
  const [slug, setSlug] = useState(collection.slug ?? '')
  const [banner, setBanner] = useState(collection.banner ?? '')
  const [order, setOrder] = useState(String(collection.order ?? 0))
  const [active, setActive] = useState(collection.active !== false)
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(() => new Set(collection.productIds ?? []))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetchAllProducts()
      .then((list) => { if (alive) setProducts(list) })
      .catch((e) => console.warn('Could not load products for the collection:', e))
    return () => { alive = false }
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await saveCollection(collection.isNew ? null : collection.id, {
        titleEn, titleAr, slug, banner, order: Number(order), active,
        // A collection is a curated shelf, so the list is capped rather than
        // becoming an unbounded join table.
        productIds: [...selected].slice(0, 50)
      })
      toast.show(t('collectionSaved'))
      onSaved()
    } catch (e) {
      console.error('Could not save collection:', e)
      toast.show(e?.message ?? t('error'))
      setSaving(false)
    }
  }

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 50) next.add(id)
      return next
    })
  }

  return (
    <Panel title={collection.isNew ? t('addCollection') : t('edit')} L={L} onClose={onClose} onSave={save} saving={saving}>
      <div className="pa-editor__row">
        <Field id="co-en" label={t('nameEn')} admin value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        <Field id="co-ar" label={t('nameAr')} admin dir="rtl" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
      </div>
      <Field id="co-slug" label={t('slug')} admin className="pa-ltr" value={slug} onChange={(e) => setSlug(e.target.value)} />
      <Field id="co-banner" label={`${t('banner')} (${t('optional')})`} admin className="pa-ltr" value={banner}
        onChange={(e) => setBanner(e.target.value)} />
      <Field id="co-order" label={t('order')} type="number" admin value={order} onChange={(e) => setOrder(e.target.value)} />
      <Checkbox id="co-active" label={t('active')} checked={active} onChange={setActive} />

      <div>
        <div className="pa-group-title">
          {t('selectProducts')}
          <span className="pa-subtitle" style={{ marginInlineStart: 8, fontWeight: 400 }}>{selected.size} / 50</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
          {products.map((p) => {
            const on = selected.has(p.id)
            return (
              <button key={p.id} type="button" className="pa-productpick" aria-pressed={on}
                onClick={() => toggle(p.id)}>
                <span className="pa-thumb" style={{ width: '100%', height: 60, backgroundImage: p.images?.[0]?.url ? `url(${thumb(p.images[0].url, 120)})` : undefined }} />
                <span>{p.title?.en ?? p.id}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Panel>
  )
}