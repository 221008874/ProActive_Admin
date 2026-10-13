import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { computeDenorm } from '../services/productLogic'

// The denormalised fields the storefront actually filters on.
//
// `totalStock` is the number the admin shows. `availableColors` and
// `availableSizes` are what the shopper can pick: useCatalog filters the colour
// and size facets with them, and commerce.jsx renders the swatches from them.
// They are derived from variants that are BOTH active AND in stock - a variant
// at zero contributes its stock (zero) but not its colour or size.
//
// Two writers moved stock without recomputing them: setVariantStock (the Low
// Stock page) and cancelOrder (a restock). Both nudged totalStock and walked
// away, so a variant zeroed from the Low Stock page kept its size selectable on
// the shop floor, and a restocked order kept returning to it only after a full
// rebuild.

const variant = (colorId, size, stock, extra = {}) => ({ colorId, size, stock, ...extra })

describe('computeDenorm drives the storefront facets', () => {
  it('omits a zero-stock variant from the facets but counts it in totalStock', () => {
    const d = computeDenorm([
      variant('red', 'M', 0),
      variant('red', 'L', 5)
    ])

    expect(d.totalStock).toBe(5)
    expect(d.availableColors).toEqual(['red'])
    // This is the regression: M used to stay selectable forever.
    expect(d.availableSizes).toEqual(['L'])
    expect(d.availableSizes).not.toContain('M')
  })

  it('omits an inactive variant from both the count and the facets', () => {
    const d = computeDenorm([
      variant('red', 'M', 5),
      variant('blue', 'M', 5, { active: false })
    ])

    expect(d.totalStock).toBe(5)
    expect(d.availableColors).toEqual(['red'])
  })

  it('returns empty facets when every variant is out of stock', () => {
    const d = computeDenorm([variant('red', 'M', 0), variant('blue', 'L', 0)])

    expect(d.totalStock).toBe(0)
    expect(d.availableColors).toEqual([])
    expect(d.availableSizes).toEqual([])
  })

  it('keeps one entry per colour/size however many variants repeat it', () => {
    const d = computeDenorm([
      variant('red', 'M', 2),
      variant('red', 'M', 3),
      variant('red', 'L', 1)
    ])

    expect(d.totalStock).toBe(6)
    expect(d.availableColors).toEqual(['red'])
    expect(d.availableSizes).toEqual(['M', 'L'])
  })

  it('reads a missing stock field as zero', () => {
    // The same NaN trap that let a stockless variant be sold.
    const d = computeDenorm([{ colorId: 'red', size: 'M', active: true }])
    expect(d.totalStock).toBe(0)
    expect(d.availableSizes).toEqual([])
  })
})

describe('both stock writers use it', () => {
  // The fix is only real if the writers actually call computeDenorm; these two
  // assertions are the guard against a future edit that reverts to a bare
  // increment on totalStock.
  const stockService = readFileSync(new URL('../services/products.js', import.meta.url), 'utf8')
  const ordersService = readFileSync(new URL('../services/orders.js', import.meta.url), 'utf8')

  it('setVariantStock recomputes the flags, not just totalStock', () => {
    const body = stockService.match(/export async function setVariantStock[\s\S]*?\n\}/)?.[0] ?? ''
    expect(body, 'setVariantStock not found').not.toBe('')
    expect(body).toContain('computeDenorm')
    expect(body).toMatch(/availableColors/)
    expect(body).toMatch(/availableSizes/)
  })

  it('cancelOrder recomputes the flags for every restocked product', () => {
    const body = ordersService.match(/export async function cancelOrder[\s\S]*?\n\}/)?.[0] ?? ''
    expect(body, 'cancelOrder not found').not.toBe('')
    expect(body).toContain('computeDenorm')
    expect(body).toMatch(/availableColors/)
    // And it must publish: the flag is what tells the Store to rebuild.
    expect(body).toContain('commitCatalogBatch')
  })
})