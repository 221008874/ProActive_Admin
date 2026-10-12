// The printable A4 coupon sheet.
//
// Six tiles per sheet, each scannable. The QR encodes the store's own coupon
// URL so a printed card is a link back into the storefront — which is the
// point of printing them rather than sending a PDF.
//
// The old sheet branded a different business and pointed at a domain this
// store does not own, so a scanned code led nowhere. Both are fixed here: the
// origin comes from the page, and the brand is ProActive.
//
// Arabic text is shaped with arabic-reshaper + bidi-js and rendered with
// IBM Plex Sans Arabic (embedded TTF). Codes, numbers and EGP stay LTR.

import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import * as ArabicReshaperModule from 'arabic-reshaper'
import { getEmbeddingLevels, getReorderedString } from 'bidi-js/dist/bidi.js'

// arabic-reshaper is a 2013 UMD bundle that assigns its object to
// `module.exports`, so depending on the bundler the ESM default import can be
// the exports object or a `{ default: exports }` namespace wrapper. Unwrap both,
// because the alternative is a runtime TypeError on every printed coupon sheet.
// (It also has no `reshape` — the method has always been `convertArabic`.)
const ArabicReshaper = ArabicReshaperModule?.convertArabic
  ? ArabicReshaperModule
  : ArabicReshaperModule?.default

const A4 = { w: 210, h: 297 }
const COLS = 2
const ROWS = 3
const PER_PAGE = COLS * ROWS

const PAD = 11
const GAP = 6

// Two columns by three rows fills an A4 with generous, cuttable margins.
const CARD_W = (A4.w - PAD * 2 - GAP) / COLS
const CARD_H = (A4.h - PAD * 2 - GAP * (ROWS - 1)) / ROWS

// Tile inner width for text wrapping (mm)
const TILE_INNER_W = CARD_W - 8

// Arabic font embedding state
let arabicFontLoaded = false

async function ensureArabicFont(pdf) {
  if (arabicFontLoaded) return
  try {
    // IBM Plex Sans Arabic Regular and Bold are available via @fontsource
    // We fetch them as base64 TTF from the fontsource package
    const [regularRes, boldRes] = await Promise.all([
      fetch('/fonts/ibm-plex-sans-arabic-regular.ttf'),
      fetch('/fonts/ibm-plex-sans-arabic-bold.ttf')
    ])
    const [regularBuf, boldBuf] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer()
    ])
    const toB64 = (buf) => btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''))
    pdf.addFileToVFS('PlexAr.ttf', toB64(regularBuf))
    pdf.addFont('PlexAr.ttf', 'PlexAr', 'normal')
    pdf.addFileToVFS('PlexAr-Bold.ttf', toB64(boldBuf))
    pdf.addFont('PlexAr-Bold.ttf', 'PlexAr', 'bold')
    arabicFontLoaded = true
  } catch {
    // Fallback: font loading failed, Arabic will use default font (may not render correctly)
    console.warn('Could not load Arabic font for PDF')
  }
}

/**
 * Shape Arabic text for RTL display in jsPDF.
 * Codes, numbers, EGP, and Latin text remain LTR.
 */
function shapeArabic(str, lang) {
  if (lang !== 'ar') return str
  if (typeof ArabicReshaper?.convertArabic !== 'function') {
    // Without the shaper the PDF still renders, just with disconnected Arabic
    // letters. A coupon sheet with wrong glyphs beats no coupon sheet.
    console.warn('arabic-reshaper unavailable; Arabic will not be shaped correctly')
    return str
  }
  // convertArabic joins letters; bidi-js handles RTL ordering.
  const reshaped = ArabicReshaper.convertArabic(str)
  const levels = getEmbeddingLevels(reshaped, { rtl: true })
  return getReorderedString(reshaped, levels)
}

/**
 * Draw wrapped text centered, returning the Y after the last line.
 */
function drawWrappedCenter(pdf, lines, fontSize, x, y, lineHeight = 5) {
  for (const line of lines) {
    pdf.text(line, x, y, { align: 'center' })
    y += lineHeight
  }
  return y
}

export async function couponSheetPdf(coupons = [], lang = 'en', origin = window.location.origin) {
  if (coupons.length === 0) return

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await ensureArabicFont(pdf)

  const pages = Math.ceil(coupons.length / PER_PAGE)

  for (let p = 0; p < pages; p++) {
    if (p > 0) pdf.addPage()

    // Page header
    const headerFont = lang === 'ar' ? 'PlexAr' : 'helvetica'
    pdf.setFont(headerFont, 'bold')
    pdf.setFontSize(16)
    pdf.setTextColor(18)
    pdf.text('PROACTIVE', A4.w / 2, PAD + 4, { align: 'center' })

    pdf.setFont(headerFont, 'normal')
    pdf.setFontSize(10)
    const subtitle = lang === 'ar' ? 'أكواد الخصم' : 'COUPON SHEET'
    pdf.text(shapeArabic(subtitle, lang), A4.w / 2, PAD + 10, { align: 'center' })

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(`${p + 1} / ${pages}`, A4.w - PAD, PAD + 4, { align: 'right' })

    pdf.setLineWidth(0.5)
    pdf.line(PAD, PAD + 14, A4.w - PAD, PAD + 14)

    const slice = coupons.slice(p * PER_PAGE, (p + 1) * PER_PAGE)
    for (let i = 0; i < slice.length; i++) {
      const coupon = slice[i]
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const x = PAD + col * (CARD_W + GAP)
      const y = PAD + 18 + row * (CARD_H + GAP)

      await drawTile(pdf, coupon, x, y, CARD_W, CARD_H, lang, origin)
    }

    // Footer
    pdf.setFont(headerFont, 'normal')
    pdf.setFontSize(8)
    const footerText = lang === 'ar'
      ? 'صالح للاستخدام مرة واحدة · امسح الكود عند الطلب'
      : 'Single use · non-transferable · scan at checkout'
    pdf.text(shapeArabic(footerText, lang), A4.w / 2, A4.h - 6, { align: 'center' })
  }

  pdf.save(`coupons-${new Date().toISOString().slice(0, 10)}.pdf`)
}

/* -------------------------------------------------------------------------- */

async function drawTile(pdf, coupon, x, y, w, h, lang, origin) {
  const r = 3
  pdf.setDrawColor(18)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(x, y, w, h, r, r, 'S')

  const tileCenterX = x + w / 2
  const isArabic = lang === 'ar'
  const fontName = isArabic ? 'PlexAr' : 'helvetica'

  // Helper to draw text with proper font
  const drawText = (str, size, xPos, yPos, options = {}) => {
    const { align = 'left', bold = false } = options
    pdf.setFont(fontName, bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(18)
    const shaped = shapeArabic(str, lang)
    pdf.text(shaped, xPos, yPos, { align })
  }

  // "COUPON CODE" label
  drawText(isArabic ? 'كود الخصم' : 'COUPON CODE', 8, tileCenterX, y + 12, { align: 'center' })

  // The code itself (always LTR, monospace)
  pdf.setFont('courier', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(18)
  pdf.text(coupon.code, tileCenterX, y + 26, { align: 'center' })

  // Discount line: "10% خصم" or "10 EGP خصم" / "10% off" / "10 EGP off"
  // The number and unit stay LTR, the word "خصم"/"off" follows language
  const discountLabel = isArabic ? 'خصم' : 'off'
  let discountText
  if (coupon.type === 'percent') {
    discountText = `${coupon.value}% ${discountLabel}`
  } else {
    discountText = `${coupon.value} EGP ${discountLabel}`
  }
  drawText(discountText, 13, tileCenterX, y + 36, { align: 'center', bold: true })

  // Notes: min order, max uses, expiry — max 3 short lines, wrapped
  const notes = []
  if (coupon.minOrder > 0) {
    notes.push(isArabic ? `الحد الأدنى ${coupon.minOrder} ج.م` : `Min ${coupon.minOrder} EGP`)
  }
  if (coupon.maxUses) {
    notes.push(isArabic ? `${coupon.maxUses} استخدام` : `${coupon.maxUses} use${coupon.maxUses > 1 ? 's' : ''}`)
  }
  if (coupon.expiresAt) {
    const d = coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : new Date(coupon.expiresAt)
    notes.push(isArabic ? `صالح حتى ${d.toLocaleDateString('ar-EG')}` : `Until ${d.toLocaleDateString('en-GB')}`)
  }

  if (notes.length) {
    let noteY = y + 44
    const noteFontSize = 8
    const lineHeight = 4.5

    for (const note of notes.slice(0, 3)) {
      // Wrap each note to tile inner width
      pdf.setFont(fontName, 'normal')
      pdf.setFontSize(noteFontSize)
      const lines = pdf.splitTextToSize(shapeArabic(note, lang), TILE_INNER_W)
      const lineArray = Array.isArray(lines) ? lines : [lines]
      noteY = drawWrappedCenter(pdf, lineArray, noteFontSize, tileCenterX, noteY, lineHeight)
    }
  }

  // QR code
  const url = `${origin}/coupon/${coupon.code}`
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 1,
      color: { dark: '#121212', light: '#FFFFFF' },
      errorCorrectionLevel: 'H'
    })
    const size = 26
    pdf.addImage(dataUrl, 'PNG', x + w / 2 - size / 2, y + h - size - 6, size, size)
  } catch {
    // A QR that fails to render must not lose the sheet: the code is printed.
  }
}

export default couponSheetPdf