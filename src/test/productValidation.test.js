import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateProduct, validateEditorForm, MAX_VARIANTS } from '../services/productLogic'
import { ar, en } from '../i18n/strings'

// Three defects made "Could not save product" unsolvable for the owner:
//   1. The form body is a long scroll container, so a per-field error could sit
//      far above the fold and the save failed with nothing visible.
//   2. `saveProduct` rejection produced no toast, so the failure was
//      console-only.
//   3. Two service messages ("Add at least one variant", "Too many variants
//      (max 400)") had no i18n entries, and the interpolated one could never be
//      a stable translation key.
const editor = readFileSync(new URL('../pages/ProductEditor.jsx', import.meta.url), 'utf8')
const logic = readFileSync(new URL('../services/productLogic.js', import.meta.url), 'utf8')

const base = { price: 100, compareAtPrice: null, colors: [{ id: 'c1' }], sizes: ['M'], images: [{ url: 'u' }] }
const variants = [{ colorId: 'c1', size: 'M', stock: 1 }]

describe('product validation messages', () => {
  it('every message validateProduct can emit exists in both dictionaries', () => {
    const emitted = new Set()
    // Walk the rules rather than hardcoding, so a new check without a
    // translation fails here.
    for (const [data, vs] of [
      [{}, []],
      [{ ...base, price: 0 }, variants],
      [{ ...base, compareAtPrice: 50 }, variants],
      [{ ...base, colors: [] }, variants],
      [{ ...base, sizes: [] }, variants],
      [{ ...base, images: [] }, variants],
      [base, []],
      [base, new Array(MAX_VARIANTS + 1).fill(variants[0])]
    ]) {
      const { errors } = validateProduct(data, vs)
      for (const msg of Object.values(errors)) emitted.add(msg)
    }

    expect(emitted.size).toBeGreaterThan(0)
    for (const msg of emitted) {
      expect(ar, `missing Arabic translation: ${msg}`).toHaveProperty([msg])
      expect(en, `missing English translation: ${msg}`).toHaveProperty([msg])
    }
  })

  it('keeps the max-variants message a translatable template, not an interpolated string', () => {
    // A baked-in "400" is untranslatable in Arabic word order; `{max}` is not.
    const { errors } = validateProduct(base, new Array(MAX_VARIANTS + 1).fill(variants[0]))
    expect(errors.variants).toContain('{max}')
    expect(errors.variants).not.toContain(String(MAX_VARIANTS))
    expect(logic).toContain('Too many variants (max {max})')
  })

  it('rejects an empty form and a form with no variants', () => {
    expect(validateProduct({}, []).isValid).toBe(false)
    expect(validateProduct(base, []).errors.variants).toBe('Add at least one variant')
  })

  it('accepts a complete product', () => {
    expect(validateProduct(base, variants).isValid).toBe(true)
  })
})

describe('a rejected save is always visible', () => {
  it('renders a summary of every rejected field, not just per-field errors', () => {
    // The per-field messages live wherever the fields are; the summary is the
    // one the owner cannot miss.
    expect(editor).toContain('cannotSaveYet')
    expect(editor).toMatch(/ERROR_FIELDS[\s\S]*summary/)
    expect(editor).toMatch(/summary\.length > 0/)
  })

  it('scrolls the summary into view after a rejected save', () => {
    expect(editor).toMatch(/bodyRef/)
    expect(editor).toMatch(/bodyRef\.current\?\.scrollTo/)
  })

  it('toasts the owner on a validation failure instead of only logging it', () => {
    expect(editor).toMatch(/toast\.show\([\s\S]{0,300}fixFields/)
  })

  it('translates every validation message with the {max} placeholder filled', () => {
    // A raw t(msg) leaves "{max}" literal on screen.
    expect(editor).not.toMatch(/t\(formErrors\./)
    expect(editor).toContain('translateError(t, activeErrors')
  })
})

describe('validateEditorForm: the live pass the panel renders from', () => {
  // The editor holds its values as strings; the live pass must coerce exactly
  // the way saveProductWithStock does, or the list the owner sees while typing
  // disagrees with the list the service enforces on write.
  const form = {
    price: '100',
    compareAtPrice: '',
    colors: [{ id: 'c1' }],
    sizes: ['M'],
    images: [{ url: 'u', primary: true }]
  }

  it('accepts a complete form typed as strings, the way the editor holds it', () => {
    expect(validateEditorForm(form, { c1_M: 3 }).isValid).toBe(true)
  })

  it('rejects an empty price and a compare-at that is not above the price', () => {
    expect(validateEditorForm({ ...form, price: '' }, {}).errors.price).toBe('Price must be greater than zero')
    expect(validateEditorForm({ ...form, compareAtPrice: '50' }, {}).errors.compareAtPrice)
      .toBe('Compare-at price must be greater than the price')
    expect(validateEditorForm({ ...form, compareAtPrice: '500' }, {}).isValid).toBe(true)
  })

  it('derives variants from the colour × size grid, so a grid with no cells is a variant error', () => {
    expect(validateEditorForm(form, {}).errors.variants).toBeUndefined()
    expect(validateEditorForm({ ...form, sizes: [] }, {}).errors.sizes).toBe('Add at least one size')
    expect(validateEditorForm({ ...form, sizes: [] }, {}).errors.variants).toBe('Add at least one variant')
    expect(validateEditorForm({ ...form, colors: [] }, {}).errors.colors).toBe('Add at least one colour')
  })

  it('needs at least one photo', () => {
    expect(validateEditorForm({ ...form, images: [] }, {}).errors.images).toBe('Add at least one image')
  })

  it('sees exactly the same keys the service will enforce on write', () => {
    // If this drifts, the banner lies: either it hides a real blocker or it
    // lists a field the save would have accepted.
    const broken = { ...form, price: '0', colors: [], images: [] }
    const live = validateEditorForm(broken, {}).errors
    const service = validateProduct({
      price: 0, compareAtPrice: null, colors: [], sizes: ['M'], images: []
    }, []).errors
    expect(Object.keys(live).sort()).toEqual(Object.keys(service).sort())
  })
})