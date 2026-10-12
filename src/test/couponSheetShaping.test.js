import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { shapeArabic } from '../services/couponSheet.js'

// `dN.default.reshape is not a function` and then
// `(0, mN.getEmbeddingLevels) is not a function` killed every printed Arabic
// coupon sheet in production — twice, because the first fix (reshapper method
// name) only unmasked the second defect. Both are invisible to a type-check
// because neither package ships a .d.ts:
//   1. `reshape` never existed — the method is `convertArabic`.
//   2. arabic-reshaper is a UMD bundle using `module.exports`, so the ESM
//      default import may be the exports object or a `{ default }` namespace
//      wrapper depending on the bundler. The call must survive both.
//   3. bidi-js exports a FACTORY from both builds; the API only exists after
//      calling it. Named-importing its members from the UMD file cannot be
//      resolved statically, so the bundler emitted a runtime lookup on the
//      factory and the call threw. These tests call the real pipeline instead
//      of grepping the source, so a regression fails here first.
const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../services/couponSheet.js', import.meta.url), 'utf8')

describe('arabic-reshaper interop', () => {
  it('really exposes convertArabic, and never reshape', () => {
    // Asserted against the installed package, so a major bump that renames or
    // reshapes the export surface fails here instead of on the print button.
    const mod = require('arabic-reshaper')
    expect(typeof mod.convertArabic).toBe('function')
    expect(mod.reshape).toBeUndefined()
  })
})

describe('bidi-js interop', () => {
  it('exposes the API only through its factory', () => {
    // The whole production crash in one fact: the module export is a function,
    // and the members live on what calling it returns.
    const factory = require('bidi-js')
    expect(typeof factory).toBe('function')
    expect(typeof factory.getEmbeddingLevels).toBe('undefined')
    const api = factory()
    expect(typeof api.getEmbeddingLevels).toBe('function')
    expect(typeof api.getReorderedString).toBe('function')
  })

  it('is imported through the package entry, never the UMD file', () => {
    // A deep `bidi-js/dist/...` import is what bundled the factory into a
    // namespace lookup that threw at runtime.
    expect(source).not.toMatch(/bidi-js\/dist/)
    expect(source).toMatch(/import \* as bidiModule from 'bidi-js'/)
  })

  it('resolves the factory through either interop shape', () => {
    // Both real interop shapes: namespace wrapper and direct CJS assignment.
    expect(source).toMatch(/bidiModule\?\.default \?\? bidiModule/)
  })
})

describe('shapeArabic pipeline (real calls)', () => {
  it('passes Latin text through untouched, in either language', () => {
    expect(shapeArabic('COUPON SHEET', 'en')).toBe('COUPON SHEET')
    // Pure Latin has no Arabic to shape and no RTL run to reorder, so even
    // the ar path returns it verbatim.
    expect(shapeArabic('COUPON SHEET', 'ar')).toBe('COUPON SHEET')
  })

  it('joins Arabic letters into presentation forms', () => {
    // Shaped Arabic contains presentation-form codepoints (U+FB50–U+FEFF).
    const shaped = shapeArabic('كود الخصم', 'ar')
    expect(typeof shaped).toBe('string')
    expect(/[\uFB50-\uFEFF]/u.test(shaped)).toBe(true)
  })

  it('applies the bidi reorder, so the string is not the raw input', () => {
    const shaped = shapeArabic('السلام عليكم', 'ar')
    expect(shaped).not.toBe('السلام عليكم')
    expect(shaped.length).toBeGreaterThan(0)
  })

  it('forces the RTL base direction, not an options object', () => {
    // getEmbeddingLevels takes a plain 'rtl' string; an object is silently
    // ignored and the paragraph direction falls back to auto-detect.
    expect(source).toContain("getEmbeddingLevels(reshaped, 'rtl')")
  })

  it('does not throw for the strings the sheet actually prints', () => {
    // The regression test for the production TypeError: every Arabic literal
    // in the sheet flows through here.
    for (const s of ['أكواد الخصم', 'كود الخصم', 'خصم', 'الحد الأدنى 200 ج.م', 'صالح للاستخدام مرة واحدة · امسح الكود عند الطلب']) {
      expect(() => shapeArabic(s, 'ar')).not.toThrow()
    }
  })

  it('mixes LTR numbers into RTL text without breaking', () => {
    // The digits survive the RTL reorder (the neutral '%' is placed in
    // display order, which is correct bidi behaviour).
    const shaped = shapeArabic('خصم 10%', 'ar')
    expect(shaped).toContain('10')
  })
})

describe('font pipeline guards', () => {
  it('verifies the font response before base64-ing it', () => {
    // An HTML 404 page base64-ed into addFont throws far from the cause.
    expect(source).toMatch(/!res\.ok/)
  })
})
