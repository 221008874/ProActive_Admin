// The printable A4 coupon sheet.
//
// Six tiles per sheet, each scannable. The QR encodes the store's own coupon
// URL so a printed card is a link back into the storefront — which is the
// point of printing them rather than sending a PDF.
//
// The old sheet branded a different business and pointed at a domain this
// store does not own, so a scanned code led nowhere. Both are fixed here: the
// origin comes from the page, and the brand is ProActive.

import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

const A4 = { w: 210, h: 297 }
const COLS = 2
const ROWS = 3
const PER_PAGE = COLS * ROWS

const PAD = 11
const GAP = 6

// Two columns by three rows fills an A4 with generous, cuttable margins.
const CARD_W = (A4.w - PAD * 2 - GAP) / COLS
const CARD_H = (A4.h - PAD * 2 - GAP * (ROWS - 1)) / ROWS

export async function couponSheetPdf(coupons = [], lang = 'en', origin = window.location.origin) {
  if (coupons.length === 0) return

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pages = Math.ceil(coupons.length / PER_PAGE)

  for (let p = 0; p < pages; p++) {
    if (p > 0) pdf.addPage()

    text(pdf, 'PROACTIVE', 16, A4.w / 2, PAD + 4, { align: 'center', bold: true })
    text(pdf, lang === 'ar' ? 'أكواد الخصم' : 'COUPON SHEET', 10, A4.w / 2, PAD + 10, { align: 'center' })
    text(pdf, `${p + 1} / ${pages}`, 9, A4.w - PAD, PAD + 4, { align: 'right' })
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

    text(
      pdf,
      lang === 'ar'
        ? 'صالح للاستخدام مرة واحدة · امسح الكود عند الطلب'
        : 'Single use · non-transferable · scan at checkout',
      8, A4.w / 2, A4.h - 6, { align: 'center' }
    )
  }

  pdf.save(`coupons-${new Date().toISOString().slice(0, 10)}.pdf`)
}

/* -------------------------------------------------------------------------- */

async function drawTile(pdf, coupon, x, y, w, h, lang, origin) {
  const r = 3
  pdf.setDrawColor(18)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(x, y, w, h, r, r, 'S')

  // The code is the one thing that must be unmissable, so it owns the middle.
  text(pdf, lang === 'ar' ? 'كود الخصم' : 'COUPON CODE', 8, x + w / 2, y + 12, { align: 'center' })
  text(pdf, coupon.code, 18, x + w / 2, y + 26, { align: 'center', bold: true, mono: true })

  const off = coupon.type === 'percent'
    ? `${coupon.value}% ${lang === 'ar' ? 'خصم' : 'off'}`
    : `${coupon.value} EGP ${lang === 'ar' ? 'خصم' : 'off'}`
  text(pdf, off, 13, x + w / 2, y + 36, { align: 'center', bold: true })

  const notes = []
  if (coupon.minOrder > 0) notes.push(lang === 'ar' ? `حد أدنى ${coupon.minOrder} جنيه` : `Min ${coupon.minOrder} EGP`)
  if (coupon.maxUses) notes.push(lang === 'ar' ? `${coupon.maxUses} استخدام` : `${coupon.maxUses} use${coupon.maxUses > 1 ? 's' : ''}`)
  if (coupon.expiresAt) {
    const d = coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : new Date(coupon.expiresAt)
    notes.push(lang === 'ar' ? `حتى ${d.toLocaleDateString('ar-EG')}` : `Until ${d.toLocaleDateString('en-GB')}`)
  }
  if (notes.length) {
    text(pdf, notes.join(' · '), 8, x + w / 2, y + 44, { align: 'center' })
  }

  // The QR is what makes the printed card worth anything.
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

function text(pdf, str, size, x, y, { align = 'left', bold = false, mono = false } = {}) {
  pdf.setFont(mono || !bold ? 'courier' : 'helvetica', bold ? 'bold' : 'normal')
  pdf.setFontSize(size)
  pdf.setTextColor(18)
  pdf.text(String(str ?? ''), x, y, { align })
}

export default couponSheetPdf