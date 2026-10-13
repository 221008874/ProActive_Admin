import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateProduct } from '../services/productLogic'

// `saveProductWithStock` is the only path from the editor to Firestore, and it
// used to build a document WITHOUT the colours and sizes it had just consumed:
// it destructured them off the editor payload to make the variant grid, never
// put them back, and then `saveProduct` -> `validateProduct` - which requires
// both - rejected every save with "Add at least one colour" and "Add at least
// one size", whatever the owner actually picked.
//
// The consequences the owner saw: nothing could be saved, and the failure had
// no visible cause (the editor's live pass owns those two keys, so the service's
// error was dropped and only a "Fix 2 field(s)" toast remained).
//
// This rebuilds the exact shape the service builds - the two functions under
// test are pure, so no Firestore is involved.

const productsSource = readFileSync(new URL('../services/products.js', import.meta.url), 'utf8')

/** The editor payload for a product an owner would consider complete. */
const validProduct = () => ({
  id: null,
  title: { ar: 'قميص', en: 'Shirt' },
  description: { ar: 'وصف', en: 'Desc' },
  slug: '',
  categoryId: 'cat1',
  status: 'active',
  price: 450,
  compareAtPrice: null,
  material: null,
  care: [],
  images: [{ url: 'https://example.test/y.jpg', isPrimary: true }],
  colors: [{ id: 'red', name: { ar: 'أحمر', en: 'Red' }, hex: '#f00' }],
  sizes: ['M'],
  isNew: false,
  isFeatured: false
})

const slugify = (text) =>
  String(text ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * Mirrors saveProductWithStock's data/variants construction. Kept in step with
 * the source by the source-shape assertions at the bottom of this file, so a
 * change to the service that reintroduces the bug fails here rather than in
 * production.
 */
function buildSaveShape(product, stock = { red_M: 3 }) {
  const { colors, sizes, ...rest } = product
  const variants = (colors ?? []).flatMap((c) =>
    (sizes ?? []).map((s) => ({
      colorId: c.id,
      color: c.name?.en ?? c.id,
      size: s,
      stock: Number(stock?.[`${c.id}_${s}`] ?? 0),
      priceOverride: null,
      active: true
    }))
  )
  const data = {
    ...rest,
    colors: colors ?? [],
    sizes: sizes ?? [],
    slug: (rest.slug || slugify(rest.title?.en ?? '')).toLowerCase(),
    title: rest.title,
    price: Number(rest.price),
    compareAtPrice: rest.compareAtPrice == null ? null : Number(rest.compareAtPrice),
    categoryId: rest.categoryId || null
  }
  return { data, variants }
}

describe('a complete editor form produces a saveable document', () => {
  it('passes the same validation the service enforces', () => {
    const { data, variants } = buildSaveShape(validProduct())
    const { errors, isValid } = validateProduct(data, variants)

    expect(errors.colors, 'colours were dropped from the document').toBeUndefined()
    expect(errors.sizes, 'sizes were dropped from the document').toBeUndefined()
    expect(isValid, `a fully filled form was rejected: ${JSON.stringify(errors)}`).toBe(true)
  })

  it('carries colours and sizes on the document, not only into the grid', () => {
    const { data } = buildSaveShape(validProduct())
    expect(data.colors).toHaveLength(1)
    expect(data.sizes).toEqual(['M'])
  })

  it('still rejects a form that genuinely has no colour or size', () => {
    // The fix must not become a way to bypass validation.
    const noColour = buildSaveShape({ ...validProduct(), colors: [] })
    expect(validateProduct(noColour.data, noColour.variants).errors.colors).toBe('Add at least one colour')

    const noSize = buildSaveShape({ ...validProduct(), sizes: [] })
    expect(validateProduct(noSize.data, noSize.variants).errors.sizes).toBe('Add at least one size')
  })

  it('rejects a price of zero and a compare-at below it', () => {
    const free = buildSaveShape({ ...validProduct(), price: 0 })
    expect(validateProduct(free.data, free.variants).errors.price).toBe('Price must be greater than zero')

    const badCompare = buildSaveShape({ ...validProduct(), compareAtPrice: 100 })
    expect(validateProduct(badCompare.data, badCompare.variants).errors.compareAtPrice)
      .toBe('Compare-at price must be greater than the price')
  })

  it('requires a photo, so a product with no image is still refused', () => {
    const noImage = buildSaveShape({ ...validProduct(), images: [] })
    expect(validateProduct(noImage.data, noImage.variants).errors.images).toBe('Add at least one image')
  })

  it('builds one variant per colour x size, with the stock from the grid', () => {
    const { variants } = buildSaveShape(
      { ...validProduct(), colors: [validProduct().colors[0], { id: 'blue', name: { en: 'Blue' }, hex: '#00f' }], sizes: ['S', 'M'] },
      { red_S: 1, red_M: 2, blue_S: 3, blue_M: 0 }
    )
    expect(variants).toHaveLength(4)
    expect(variants.map((v) => `${v.colorId}_${v.size}:${v.stock}`).sort()).toEqual([
      'blue_M:0', 'blue_S:3', 'red_M:2', 'red_S:1'
    ])
  })

  it('generates a slug from the English title when the owner leaves it empty', () => {
    const { data } = buildSaveShape(validProduct())
    expect(data.slug).toBe('shirt')
  })

  it('keeps the status the owner chose, which is what publishes a product', () => {
    for (const status of ['active', 'draft', 'archived']) {
      const { data } = buildSaveShape({ ...validProduct(), status })
      expect(data.status).toBe(status)
    }
  })

  it('keeps the category assignment, including clearing it', () => {
    expect(buildSaveShape(validProduct()).data.categoryId).toBe('cat1')
    expect(buildSaveShape({ ...validProduct(), categoryId: '' }).data.categoryId).toBeNull()
  })
})

describe('the service source still builds the save shape this test mirrors', () => {
  // If someone refactors saveProductWithStock, this test must be updated rather
  // than left asserting a shape the code no longer produces.
  it('restores colors and sizes into the document', () => {
    const body = productsSource.match(/export async function saveProductWithStock[\s\S]*?\n}/)?.[0] ?? ''
    expect(body, 'saveProductWithStock not found').not.toBe('')
    expect(body).toMatch(/colors:\s*variantColors/)
    expect(body).toMatch(/sizes:\s*variantSizes/)
  })
})