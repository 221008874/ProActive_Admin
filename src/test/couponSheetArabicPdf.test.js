import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { Buffer } from 'node:buffer'
import { jsPDF } from 'jspdf'

// The rendered coupon sheet came out with garbled Arabic: mis-joined letters and
// glyphs that were not in the source string. Root cause: the sheet used to
// pre-shape Arabic with arabic-reshaper and pre-order it with bidi-js, then hand
// the *visual* string to jsPDF — which runs its OWN Arabic shaper and its OWN
// Unicode bidi engine on the TTF text path. The engine inverted the visual
// string back to logical order, but the presentation forms passed through its
// shaper untouched, so every word was left scrambled.
//
// The contract now: feed jsPDF logical-order text and let it shape + reorder.
// These tests generate a real PDF and decode the Identity-H text operators
// (GIDs) back through the font's cmap, so the assertion is on what is actually
// written into the document — not on source text.

const source = readFileSync(new URL('../services/couponSheet.js', import.meta.url), 'utf8')
const ttf = readFileSync(new URL('../../public/fonts/ibm-plex-sans-arabic-regular.ttf', import.meta.url))

/** Build a reverse cmap (GID -> codepoint) from the regular-weight TTF. */
function gidToCharMap() {
  const numTables = ttf.readUInt16BE(4)
  let cmapOffset = -1
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16
    if (ttf.toString('latin1', rec, rec + 4) === 'cmap') cmapOffset = ttf.readUInt32BE(rec + 8)
  }
  const numSub = ttf.readUInt16BE(cmapOffset + 2)
  let best = null
  for (let i = 0; i < numSub; i++) {
    const rec = cmapOffset + 4 + i * 8
    const off = ttf.readUInt32BE(rec + 4)
    const format = ttf.readUInt16BE(cmapOffset + off)
    if (format === 12) best = { base: cmapOffset + off, format }
    if (format === 4 && !best) best = { base: cmapOffset + off, format }
  }
  const map = new Map()
  if (best.format === 12) {
    const nGroups = ttf.readUInt32BE(best.base + 12)
    for (let g = 0; g < nGroups; g++) {
      const rec = best.base + 16 + g * 12
      const start = ttf.readUInt32BE(rec)
      const end = ttf.readUInt32BE(rec + 4)
      const startGid = ttf.readUInt32BE(rec + 8)
      for (let c = start; c <= end; c++) map.set(startGid + (c - start), c)
    }
  } else {
    const segX2 = ttf.readUInt16BE(best.base + 6)
    const segCount = segX2 / 2
    const endBase = best.base + 14
    const startBase = endBase + segX2 + 2
    const deltaBase = startBase + segX2
    const rangeBase = deltaBase + segX2
    for (let s = 0; s < segCount; s++) {
      const end = ttf.readUInt16BE(endBase + s * 2)
      const start = ttf.readUInt16BE(startBase + s * 2)
      const delta = ttf.readInt16BE(deltaBase + s * 2)
      const rangeOff = ttf.readUInt16BE(rangeBase + s * 2)
      if (start === 0xffff) continue
      for (let c = start; c <= end; c++) {
        let gid
        if (rangeOff === 0) gid = (c + delta) & 0xffff
        else {
          gid = ttf.readUInt16BE(rangeBase + s * 2 + rangeOff + (c - start) * 2)
          if (gid !== 0) gid = (gid + delta) & 0xffff
        }
        if (gid !== 0) map.set(gid, c)
      }
    }
  }
  return map
}

/** Draw the logical-order strings exactly as the sheet does; return the encoded (visual) text per call. */
function drawAndDecode(strings) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  pdf.addFileToVFS('PlexAr.ttf', ttf.toString('base64'))
  pdf.addFont('PlexAr.ttf', 'PlexAr', 'normal')
  pdf.setFont('PlexAr', 'normal')
  pdf.setFontSize(10)
  strings.forEach((s, i) => pdf.text(s, 20, 20 + 10 * i, { align: 'left' }))

  const raw = Buffer.from(pdf.output('arraybuffer')).toString('latin1')
  const streamMatch = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(raw)
  let content
  try {
    content = inflateSync(Buffer.from(streamMatch[1], 'latin1')).toString('latin1')
  } catch {
    content = Buffer.from(streamMatch[1], 'latin1').toString('latin1')
  }
  const gidToChar = gidToCharMap()
  const encoded = []
  const re = /<([0-9A-Fa-f]+)>\s*Tj/g
  let m
  while ((m = re.exec(content))) {
    let out = ''
    for (let i = 0; i < m[1].length; i += 4) {
      const cp = gidToChar.get(parseInt(m[1].slice(i, i + 4), 16))
      out += cp === undefined ? '?' : String.fromCodePoint(cp)
    }
    encoded.push(out)
  }
  return encoded
}

const isPresentationForm = (ch) => {
  const cp = ch.codePointAt(0)
  return (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff)
}
const isBaseArabic = (ch) => {
  const cp = ch.codePointAt(0)
  return (cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f)
}

describe('source contract: no external Arabic pre-processing', () => {
  it('does not import arabic-reshaper or bidi-js', () => {
    // jsPDF owns shaping + bidi; any external pre-processing is double work
    // that scrambles the glyphs. (The header comment names them on purpose —
    // match the import statements, not the prose.)
    expect(source).not.toMatch(/^import .*arabic-reshaper/m)
    expect(source).not.toMatch(/^import .*bidi-js/m)
    expect(source).not.toMatch(/shapeArabic/)
  })

  it('hands the raw strings to pdf.text', () => {
    expect(source).toContain('pdf.text(subtitle,')
    expect(source).toContain('pdf.text(footerText,')
    expect(source).toContain('pdf.splitTextToSize(note,')
  })
})

describe('jsPDF Arabic pipeline (real PDF generation)', () => {
  it('shapes and visually reorders the page header', () => {
    // Locked to jsPDF's engine output: logical 'أكواد الخصم' comes out as the
    // visual string with 'أكواد' on the right and 'الخصم' on the left.
    expect(drawAndDecode(['أكواد الخصم'])).toEqual(['ﻢﺼﺨﻟﺍ ﺩﺍﻮﻛﺃ'])
  })

  it('reorders the min-order note with its number and unit in RTL visual order', () => {
    // This is the string that rendered garbled: the leading word must be the
    // visual 'ج.م' (the LAST logical word), then the number, then الأدنى then الحد.
    expect(drawAndDecode(['الحد الأدنى 5 ج.م'])).toEqual(['ﻡ.ﺝ 5 ﻰﻧﺩﻷﺍ ﺪﺤﻟﺍ'])
  })

  it('keeps the LTR run intact inside Arabic text', () => {
    const [encoded] = drawAndDecode(['خصم EGP 10'])
    expect(encoded).toEqual('ﻢﺼﺧ EGP 10')
    expect(encoded).toContain('EGP 10')
  })

  it('leaves no unshaped base Arabic letters in the output', () => {
    const strings = [
      'أكواد الخصم',
      'صالح للاستخدام مرة واحدة · امسح الكود عند الطلب',
      'كود الخصم',
      'خصم EGP 10',
      'الحد الأدنى 5 ج.م',
      '5 استخدام'
    ]
    const encoded = drawAndDecode(strings)
    expect(encoded).toHaveLength(strings.length)
    for (const out of encoded) {
      expect(out).not.toContain('?')
      expect([...out].some(isBaseArabic)).toBe(false)
      expect([...out].some(isPresentationForm)).toBe(true)
    }
  })

  it('passes English text through untouched', () => {
    expect(drawAndDecode(['COUPON SHEET'])).toEqual(['COUPON SHEET'])
  })
})

describe('embedded font covers the shaped forms', () => {
  it('the regular TTF maps every presentation form jsPDF emits', () => {
    // A font missing these GIDs would silently substitute wrong glyphs in the
    // viewer — the "letters that are not in the source" symptom. Probes are
    // the exact forms the sheet's strings come out as (checked as cmap values,
    // since the helper builds the GID -> codepoint direction).
    const gidToChar = gidToCharMap()
    const covered = new Set(gidToChar.values())
    const probes = [0xfe8d, 0xfeaa, 0xfedf, 0xfee1, 0xfee7, 0xfea4, 0xfea9, 0xfef0, 0xfef7]
    for (const cp of probes) expect(covered.has(cp)).toBe(true)
  })
})
