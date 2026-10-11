// Packing slip — A5, printed and stuck in the bag.
//
// Not an invoice: the courier collects cash, so the one thing this must get
// right is the amount to collect and where to take it. Everything else is
// there to make sure the right items go in the right bag.
//
// Legacy orders (placed before the fashion migration) have no variantId and
// therefore no colour or size. They still print: the slip renders a dash
// rather than silently dropping the line, because a missing size must be
// noticed by the person packing, not discovered at the door.

import { jsPDF } from 'jspdf'
import { loadCairoFontB64 } from '../utils/arabicFont'

const A5 = { w: 148, h: 210 }
const MARGIN = 10

export async function packingSlipPdf(order, lang = 'en') {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
  const W = A5.w

  // Arabic needs a font that shapes it; without one the address prints as
  // disconnected letters, which a courier cannot read.
  let cairoB64 = null
  try {
    cairoB64 = await loadCairoFontB64()
    pdf.addFileToVFS('Cairo.ttf', cairoB64)
    pdf.addFont('Cairo.ttf', 'Cairo', 'normal')
  } catch {
    // Keep the English layout rather than failing the print.
  }

  const text = (str, { size = 9, x = MARGIN, y, align = 'left', bold = false } = {}) => {
    const s = String(str ?? '')
    const arabic = /[\u0600-\u06FF]/.test(s) && cairoB64
    pdf.setFont(arabic ? 'Cairo' : 'helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    // Right-aligned Arabic reads correctly; left-aligned English does too.
    pdf.text(s, x, y, { align: arabic ? 'right' : align })
  }

  let y = 14

  text('PROACTIVE', { size: 16, x: W / 2, y, align: 'center', bold: true })
  y += 6
  text(lang === 'ar' ? 'إيصال الشحن' : 'PACKING SLIP', { size: 10, x: W / 2, y, align: 'center' })
  y += 3
  pdf.setLineWidth(0.4)
  pdf.line(MARGIN, y, W - MARGIN, y)
  y += 7

  // The two facts the courier acts on, printed largest.
  text(`Order: ${order.orderNumber ?? order.id}`, { size: 11, y, bold: true })
  y += 6
  text(`Phone: ${order.customer?.phone ?? '—'}`, { size: 10, y })
  y += 6

  const name = order.customer?.name ?? '—'
  text(name, { size: 10, y, bold: true })
  y += 5
  const address = [order.address?.street, order.address?.building, order.address?.city]
    .filter(Boolean).join(', ')
  text(address || '—', { size: 9, y })
  y += 4.5
  text(order.address?.governorateText ?? order.address?.governorate ?? '—', { size: 9, y })
  y += 8

  // Items
  text('Items', { size: 10, y, bold: true })
  y += 5
  for (const item of order.items ?? []) {
    if (y > A5.h - 40) { pdf.addPage('a5'); y = 14 }

    const title = item.title?.en || item.title?.ar || item.name || 'Item'
    text(title, { size: 9, y })
    y += 4

    // A missing colour/size is printed as a dash on purpose: the packer needs
    // to see that something is unstated, not see it omitted.
    const variant = [
      item.color ?? '—',
      item.size ?? '—',
      item.sku ?? null,
      `x${item.qty ?? item.quantity ?? 1}`
    ].filter(Boolean).join('  ')

    text(variant, { size: 8, x: MARGIN + 3, y })
    y += 4.5
  }

  y += 2
  pdf.line(MARGIN, y, W - MARGIN, y)
  y += 7

  const money = (n) => `${Number(n ?? 0).toFixed(2)} EGP`
  text(`Subtotal: ${money(order.subtotal)}`, { size: 9, x: W - MARGIN, y, align: 'right' })
  y += 5
  text(`Shipping: ${money(order.shippingCost)}`, { size: 9, x: W - MARGIN, y, align: 'right' })
  y += 6
  text('COLLECT ON DELIVERY', { size: 10, x: W / 2, y, align: 'center', bold: true })
  y += 6
  text(money(order.total), { size: 18, x: W / 2, y, align: 'center', bold: true })

  pdf.save(`packing-slip-${order.orderNumber ?? order.id}.pdf`)
}

export default packingSlipPdf