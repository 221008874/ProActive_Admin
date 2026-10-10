// Pure order-status logic. Kept free of Firebase imports so it is testable.

export const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"];

// Firestore rules cannot enforce this: they cannot read the order's previous
// status. It is enforced here, inside the transaction that writes the change.
export const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: []
};

export function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function isTerminal(status) {
  return (ALLOWED_TRANSITIONS[status] ?? []).length === 0;
}

// Cancelling or returning must give stock and coupon usage back exactly once,
// so re-running is a no-op rather than a double credit.
export function isStockRestoringStatus(status) {
  return status === "cancelled" || status === "returned";
}

export function mapsUrlFor(address) {
  if (!address?.lat || !address?.lng) return null;
  return `https://maps.google.com/?q=${address.lat},${address.lng}`;
}

export function whatsappUrlFor(order, template = "") {
  const phone = String(order?.customer?.phone ?? "").replace(/[^\d]/g, "");
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(template)}`;
}

export function whatsappTemplateFor(order) {
  const number = order?.orderNumber ?? order?.id ?? "";
  const name = order?.customer?.name ?? "";
  const total = order?.total ?? 0;
  return `Hi ${name}, your ProActive order ${number} is confirmed. Total to collect on delivery: ${total} EGP.`;
}