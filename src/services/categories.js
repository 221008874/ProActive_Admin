// Categories and collections.
//
 // Two small collections with the same bilingual name shape, so they share this
 // module rather than getting two nearly-identical ones. Products reference a
 // category by id and never by name, which is what makes these safe to rename.

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { commitCatalogBatch } from './catalogDirty'

const withId = (d) => ({ id: d.id, ...d.data() })

/* ------------------------------ categories ------------------------------ */

export async function fetchCategories() {
  const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')))
  return snap.docs.map(withId)
}

export async function fetchCategoryTree() {
  const all = await fetchCategories()
  const byParent = new Map()
  for (const c of all) {
    const key = c.parentId ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(c)
  }
  // Roots plus their children, one level deep: deeper nesting is not a thing
  // this catalogue uses and the select would become unusable.
  return (byParent.get(null) ?? []).map((root) => ({ ...root, children: byParent.get(root.id) ?? [] }))
}

// Categories and collections feed the snapshot's structural sections, not just
// product cards, so every write below asks for a full rebuild. See catalogDirty.js.
const FULL_REBUILD = { scope: 'full' }

/**
 * Save a category. An empty id creates it; otherwise the document is merged so
 * an image the owner did not touch is not lost.
 */
export async function saveCategory(id, data) {
  const ref = id ? doc(db, 'categories', id) : doc(collection(db, 'categories'))
  const batch = writeBatch(db)
  batch.set(
    ref,
    {
      name: { ar: data.nameAr ?? data.name?.ar ?? '', en: data.nameEn ?? data.name?.en ?? '' },
      slug: data.slug ?? ref.id,
      parentId: data.parentId || null,
      image: data.image || null,
      order: Number(data.order ?? 0),
      active: data.active !== false,
      ...(id ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )
  await commitCatalogBatch(batch, FULL_REBUILD)
  return ref.id
}

export async function deleteCategory(id) {
  // A category with children cannot be deleted without orphaning them, and a
  // product referencing it would keep a dangling id.
  const [children, products] = await Promise.all([
    getDocs(query(collection(db, 'categories'), where('parentId', '==', id))),
    getDocs(query(collection(db, 'products_egp'), where('categoryId', '==', id)))
  ])
  if (!children.empty) {
    const err = new Error('Category has child categories')
    err.code = 'HAS_CHILDREN'
    throw err
  }
  if (!products.empty) {
    const err = new Error('Category still has products')
    err.code = 'IN_USE'
    err.count = products.size
    throw err
  }
  const batch = writeBatch(db)
  batch.delete(doc(db, 'categories', id))
  await commitCatalogBatch(batch, FULL_REBUILD)
}

/* ----------------------------- collections ------------------------------ */

export async function fetchCollections() {
  const snap = await getDocs(query(collection(db, 'collections'), orderBy('order', 'asc')))
  return snap.docs.map(withId)
}

export async function saveCollection(id, data) {
  const ref = id ? doc(db, 'collections', id) : doc(collection(db, 'collections'))
  const batch = writeBatch(db)
  batch.set(
    ref,
    {
      title: { ar: data.titleAr ?? data.title?.ar ?? '', en: data.titleEn ?? data.title?.en ?? '' },
      slug: data.slug ?? ref.id,
      // A manual list, capped: a collection is a curated shelf, not a query.
      productIds: (data.productIds ?? []).slice(0, 50),
      banner: data.banner || null,
      type: data.type ?? 'tile',
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      order: Number(data.order ?? 0),
      active: data.active !== false,
      ...(id ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )
  await commitCatalogBatch(batch, FULL_REBUILD)
  return ref.id
}

export async function deleteCollection(id) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'collections', id))
  await commitCatalogBatch(batch, FULL_REBUILD)
}

/** Replace a collection's product list in one write, order preserved. */
export async function setCollectionProducts(id, productIds) {
  const batch = writeBatch(db)
  batch.set(
    doc(db, 'collections', id),
    { productIds: productIds.slice(0, 50), updatedAt: serverTimestamp() },
    { merge: true }
  )
  await commitCatalogBatch(batch, FULL_REBUILD)
}

/**
 * Seed the category tree once. Idempotent: existing ids are left alone, so
 * running it against a populated project changes nothing.
 */
export async function ensureBaseCategories(seed = []) {
  const existing = await fetchCategories()
  const have = new Set(existing.map((c) => c.id))
  const batch = writeBatch(db)

  let added = 0
  for (const c of seed) {
    if (have.has(c.id)) continue
    batch.set(doc(db, 'categories', c.id), {
      name: c.name,
      slug: c.slug ?? c.id,
      parentId: c.parentId ?? null,
      order: c.order ?? 0,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    added++
  }

  if (added > 0) {
    await commitCatalogBatch(batch, FULL_REBUILD)
  }
  return added
}