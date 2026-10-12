import { describe, it, expect } from 'vitest'
import {
  variantIdFor,
  computeDenorm,
  computeDiscountPct,
  validateProduct,
  variantsFromGrid,
  MAX_VARIANTS
} from '../services/productLogic'
import {
  ORDER_STATUSES,
  ALLOWED_TRANSITIONS,
  canTransition,
  isTerminal,
  isStockRestoringStatus,
  mapsUrlFor,
  whatsappUrlFor,
  whatsappTemplateFor
} from '../services/orderLogic'
import {
  randomCode,
  normalizeCode,
  validateCoupon,
  couponLabel,
  MAX_PER_BATCH
} from '../services/couponLogic'

describe('productLogic - variant ids', () => {
  it('joins colour and size with an underscore', () => {
    expect(variantIdFor('red', 'M')).toBe('red_M')
  })
})

describe('productLogic - computeDenorm', () => {
  it('sums stock across active variants', () => {
    const result = computeDenorm([
      { colorId: 'red', size: 'M', stock: 5, active: true },
      { colorId: 'red', size: 'L', stock: 3, active: true },
      { colorId: 'black', size: 'M', stock: 2, active: true }
    ])
    expect(result.totalStock).toBe(10)
  })

  it('excludes inactive variants from the total', () => {
    const result = computeDenorm([
      { colorId: 'red', size: 'M', stock: 5, active: true },
      { colorId: 'black', size: 'M', stock: 99, active: false }
    ])
    expect(result.totalStock).toBe(5)
  })

  it('treats a missing active flag as active', () => {
    expect(computeDenorm([{ colorId: 'red', size: 'M', stock: 4 }]).totalStock).toBe(4)
  })

  it('lists only colours and sizes that are actually purchasable', () => {
    const result = computeDenorm([
      { colorId: 'red', size: 'M', stock: 5, active: true },
      { colorId: 'red', size: 'L', stock: 0, active: true },
      { colorId: 'black', size: 'M', stock: 0, active: true }
    ])
    expect(result.availableColors).toEqual(['red'])
    expect(result.availableSizes).toEqual(['M'])
  })

  it('handles an empty or invalid list', () => {
    expect(computeDenorm([])).toEqual({ totalStock: 0, availableColors: [], availableSizes: [] })
    expect(computeDenorm(null).totalStock).toBe(0)
  })
})

describe('productLogic - computeDiscountPct', () => {
  it('computes the percentage off', () => {
    expect(computeDiscountPct(450, 600)).toBe(25)
  })

  it('returns zero without a valid compare-at price', () => {
    expect(computeDiscountPct(450, null)).toBe(0)
    expect(computeDiscountPct(450, 400)).toBe(0)
    expect(computeDiscountPct(450, 450)).toBe(0)
    expect(computeDiscountPct(450, 0)).toBe(0)
  })

  it('handles non-numeric input', () => {
    expect(computeDiscountPct('abc', 600)).toBe(0)
    expect(computeDiscountPct(450, 'abc')).toBe(0)
  })
})

describe('productLogic - validateProduct', () => {
  const ok = {
    price: 450,
    colors: [{ id: 'red' }],
    sizes: ['M'],
    images: [{ url: 'x' }]
  }
  const variants = [{ colorId: 'red', size: 'M', stock: 1 }]

  it('accepts a complete product', () => {
    expect(validateProduct(ok, variants).isValid).toBe(true)
  })

  it('rejects a non-positive price', () => {
    expect(validateProduct({ ...ok, price: 0 }, variants).errors.price).toBeTruthy()
    expect(validateProduct({ ...ok, price: -5 }, variants).errors.price).toBeTruthy()
  })

  it('rejects a compare-at price that is not above the price', () => {
    expect(validateProduct({ ...ok, compareAtPrice: 400 }, variants).errors.compareAtPrice).toBeTruthy()
    expect(validateProduct({ ...ok, compareAtPrice: 600 }, variants).isValid).toBe(true)
  })

  it('allows an empty compare-at price', () => {
    expect(validateProduct({ ...ok, compareAtPrice: '' }, variants).errors.compareAtPrice).toBeUndefined()
  })

  it('requires colours, sizes, images and variants', () => {
    const { errors, isValid } = validateProduct({ price: 450 }, [])
    expect(isValid).toBe(false)
    expect(Object.keys(errors).sort()).toEqual(['colors', 'images', 'sizes', 'variants'])
  })

  it('rejects an oversized variant grid', () => {
    const many = Array.from({ length: MAX_VARIANTS + 1 }, () => variants[0])
    // The cap is left as a {max} placeholder so the message stays a translatable
    // key; the editor fills it from MAX_VARIANTS via translateError.
    expect(validateProduct(ok, many).errors.variants).toBe('Too many variants (max {max})')
  })
})

describe('productLogic - variantsFromGrid', () => {
  it('builds one variant per colour x size', () => {
    const out = variantsFromGrid(
      [{ id: 'red', name: { en: 'Red' } }, { id: 'black', name: { en: 'Black' } }],
      ['S', 'M', 'L']
    )
    expect(out).toHaveLength(6)
    expect(out[0]).toMatchObject({ colorId: 'red', color: 'Red', size: 'S', stock: 0 })
  })

  it('reads stock from the supplied map', () => {
    const out = variantsFromGrid(['red'], ['M'], { red_M: 7 })
    expect(out[0].stock).toBe(7)
  })

  it('defaults missing stock to zero', () => {
    expect(variantsFromGrid(['red'], ['M'])[0].stock).toBe(0)
  })

  it('handles no colours or sizes', () => {
    expect(variantsFromGrid([], [])).toEqual([])
  })
})

describe('orderLogic - status transitions', () => {
  it('allows only the documented moves', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true)
    expect(canTransition('confirmed', 'shipped')).toBe(true)
    expect(canTransition('shipped', 'delivered')).toBe(true)
    expect(canTransition('shipped', 'returned')).toBe(true)
    expect(canTransition('delivered', 'returned')).toBe(true)
  })

  it('rejects skipping steps', () => {
    expect(canTransition('pending', 'shipped')).toBe(false)
    expect(canTransition('pending', 'delivered')).toBe(false)
    expect(canTransition('confirmed', 'delivered')).toBe(false)
  })

  it('treats cancelled and returned as terminal', () => {
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
    expect(canTransition('returned', 'delivered')).toBe(false)
    expect(isTerminal('cancelled')).toBe(true)
    expect(isTerminal('delivered')).toBe(false)
  })

  it('rejects an unknown source status', () => {
    expect(canTransition('nonsense', 'confirmed')).toBe(false)
  })

  it('knows which statuses put stock back', () => {
    expect(isStockRestoringStatus('cancelled')).toBe(true)
    expect(isStockRestoringStatus('returned')).toBe(true)
    expect(isStockRestoringStatus('shipped')).toBe(false)
  })

  it('covers every status in the transition map', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort())
  })

  it('has no moves leaving a terminal state', () => {
    for (const s of ['cancelled', 'returned']) {
      expect(ALLOWED_TRANSITIONS[s]).toEqual([])
    }
  })
})

describe('orderLogic - contact links', () => {
  it('builds a maps link from coordinates', () => {
    expect(mapsUrlFor({ lat: 30.04, lng: 31.23 })).toBe('https://maps.google.com/?q=30.04,31.23')
  })

  it('returns null without coordinates', () => {
    expect(mapsUrlFor({})).toBeNull()
    expect(mapsUrlFor(null)).toBeNull()
  })

  it('builds a whatsapp link with the phone stripped of formatting', () => {
    expect(whatsappUrlFor({ customer: { phone: '+20 100 000 0000' } }, 'hi')).toBe(
      'https://wa.me/201000000000?text=hi'
    )
  })

  it('returns null without a phone', () => {
    expect(whatsappUrlFor({ customer: {} })).toBeNull()
    expect(whatsappUrlFor(null)).toBeNull()
  })

  it('mentions the order number and the amount to collect', () => {
    const text = whatsappTemplateFor({
      orderNumber: 'PA-ABC123',
      customer: { name: 'Jane' },
      total: 750
    })
    expect(text).toContain('PA-ABC123')
    expect(text).toContain('750 EGP')
  })
})

describe('couponLogic', () => {
  it('generates codes without ambiguous characters', () => {
    const sample = Array.from({ length: 300 }, () => randomCode(8)).join('')
    expect(sample).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/)
    expect(sample).not.toMatch(/[IO01]/)
  })

  it('normalises codes to upper case and trims', () => {
    expect(normalizeCode('  pa-abc123 ')).toBe('PA-ABC123')
    expect(normalizeCode(null)).toBe('')
  })

  it('validates a well-formed coupon', () => {
    expect(validateCoupon({ count: 10, type: 'percent', value: 25 }).isValid).toBe(true)
    expect(validateCoupon({ count: 1, type: 'fixed', value: 50 }).isValid).toBe(true)
  })

  it('enforces the batch cap', () => {
    expect(validateCoupon({ count: 0, type: 'fixed', value: 10 }).errors.count).toBeTruthy()
    expect(validateCoupon({ count: MAX_PER_BATCH + 1, type: 'fixed', value: 10 }).errors.count).toBeTruthy()
    expect(validateCoupon({ count: MAX_PER_BATCH, type: 'fixed', value: 10 }).isValid).toBe(true)
  })

  it('requires a known type and a positive value', () => {
    expect(validateCoupon({ count: 1, type: 'money', value: 10 }).errors.type).toBeTruthy()
    expect(validateCoupon({ count: 1, type: 'fixed', value: 0 }).errors.value).toBeTruthy()
  })

  it('caps a percent coupon at 100', () => {
    expect(validateCoupon({ count: 1, type: 'percent', value: 101 }).errors.value).toBeTruthy()
    expect(validateCoupon({ count: 1, type: 'percent', value: 100 }).isValid).toBe(true)
    expect(validateCoupon({ count: 1, type: 'fixed', value: 5000 }).isValid).toBe(true)
  })

  it('rejects a negative minimum order or a maxUses below one', () => {
    expect(validateCoupon({ count: 1, type: 'fixed', value: 10, minOrder: -1 }).errors.minOrder).toBeTruthy()
    expect(validateCoupon({ count: 1, type: 'fixed', value: 10, maxUses: 0 }).errors.maxUses).toBeTruthy()
  })

  it('treats an empty maxUses as unlimited', () => {
    expect(validateCoupon({ count: 1, type: 'fixed', value: 10, maxUses: '' }).isValid).toBe(true)
  })

  it('labels a coupon by type, treating a missing type as fixed', () => {
    expect(couponLabel({ value: 50, type: 'fixed' })).toBe('50 EGP off')
    expect(couponLabel({ value: 25, type: 'percent' })).toBe('25% off')
    expect(couponLabel({ value: 50 })).toBe('50 EGP off')
    expect(couponLabel(null)).toBe('')
  })
})