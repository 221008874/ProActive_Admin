import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as ArabicReshaperModule from 'arabic-reshaper'

// `dN.default.reshape is not a function` killed every printed Arabic coupon
// sheet. Two separate defects, both invisible to a type-check because the
// package ships no .d.ts:
//   1. `reshape` never existed — the method is `convertArabic`.
//   2. arabic-reshaper is a UMD bundle using `module.exports`, so the ESM
//      default import may be the exports object or a `{ default }` namespace
//      wrapper depending on the bundler. The call must survive both.
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

  it('resolves the exports object through either interop shape', () => {
    const resolved = ArabicReshaperModule?.convertArabic
      ? ArabicReshaperModule
      : ArabicReshaperModule?.default
    expect(typeof resolved.convertArabic).toBe('function')
  })

  it('calls convertArabic, never the non-existent reshape', () => {
    expect(source).toContain('ArabicReshaper.convertArabic(str)')
    expect(source).not.toMatch(/ArabicReshaper\.reshape/)
  })

  it('normalises the interop shape instead of trusting the default import', () => {
    // A bare `import ArabicReshaper from` is what produced the production crash.
    expect(source).toContain('ArabicReshaperModule?.default')
    expect(source).not.toMatch(/^import ArabicReshaper from/m)
  })

  it('degrades to unshaped text instead of throwing if the module is unusable', () => {
    // shapeArabic is called on the print path; a throw there loses the whole
    // sheet, whereas unshaped Arabic at least prints.
    expect(source).toMatch(/typeof ArabicReshaper\?\.convertArabic !== 'function'/)
  })

  it('produces presentation forms, so Arabic letters actually join', () => {
    const mod = require('arabic-reshaper')
    const out = mod.convertArabic('السلام عليكم')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
    // Reshaped Arabic contains presentation-form codepoints (U+FB50..U+FEFF),
    // which is the whole point of the dependency.
    expect(/[\uFB50-\uFEFF]/u.test(out)).toBe(true)
  })
})