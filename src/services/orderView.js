// Order view-model: the one place a stored order becomes a panel row.
//
// Two shapes reach the admin. Server-written orders (the store's /api/placeOrder)
// nest the customer, address and line items; older mobile-app orders are already
// flat. Both have to render, because the bills tab lists them side by side.
//
// A blank "Customer" cell on a fresh order looks like missing data rather than a
// mapping bug, so every field is resolved here and every fallback is explicit.

/** Joins address parts, dropping the ones the customer never filled in. */
function joinAddress(address) {
  if (!address) return null
  const parts = [address.street, address.city, address.governorate].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/**
 * One order to the fields every panel reads.
 *
 * @param {{ id: string, data: () => object }} doc A Firestore document snapshot.
 * @returns {object} A flat view-model, or an empty one for an unreadable order.
 */
export function toOrderView(doc) {
  const d = (doc && typeof doc.data === 'function' ? doc.data() : doc) || {}

  // Server shape, falling back to the legacy flat fields for the same values.
  const customer = d.customer || {}
  const address = d.address || {}

  const customerName = d.customerName ?? customer.name ?? null
  const customerPhone = d.customerPhone ?? customer.phone ?? null
  const customerEmail = d.customerEmail ?? customer.email ?? null
  const customerAddress = d.customerAddress ?? joinAddress(address) ?? null
  const governorate = d.governorate ?? address.governorate ?? address.governorateId ?? null

  // A line is already in view shape when it has a name; otherwise it is a
  // server line and needs mapping.
  const items = (d.items ?? []).map((item) =>
    item && item.name !== undefined
      ? { name: item.name, quantity: item.quantity, price: item.price }
      : { name: item?.title ?? '', quantity: item?.qty ?? 0, price: item?.unitPrice ?? 0 })

  const serverTotalItems = (d.items ?? []).reduce((sum, i) => sum + Number(i?.qty ?? i?.quantity ?? 0), 0)

  return {
    orderId: d.orderNumber ?? d.orderId ?? doc?.id ?? null,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    governorate,
    // The stored total wins; falling back to summing lines would hide a
    // shipping or discount mismatch behind a plausible number.
    totalItems: d.totalItems ?? serverTotalItems,
    totalPrice: d.total ?? d.totalPrice ?? null,
    currency: d.currency ?? 'EGP',
    status: d.status ?? null,
    adminConfirmed: d.adminConfirmed ?? false,
    items,
    createdAt: d.createdAt ?? null,
    paymentMethod: d.paymentMethod ?? null,
    raw: d
  }
}

/** A whole page of documents to view rows, dropping anything unreadable. */
export function toOrderViews(docs) {
  return (docs ?? []).map(toOrderView)
}