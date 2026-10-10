// Pure coupon logic. Kept free of Firebase imports so it is testable.

// Ambiguous glyphs (I/O/0/1) are excluded so a code survives being read aloud
// or copied off a printed QR sheet.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const MAX_PER_BATCH = 100;

export function randomCode(length = 6, random = Math.random) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(code) {
  return String(code ?? "").trim().toUpperCase();
}

export function validateCoupon({ count, type, value, minOrder, maxUses } = {}) {
  const errors = {};

  if (!(count >= 1 && count <= MAX_PER_BATCH)) {
    errors.count = `Count must be between 1 and ${MAX_PER_BATCH}`;
  }
  if (type !== "percent" && type !== "fixed") errors.type = "Type must be percent or fixed";
  if (!(Number(value) > 0)) errors.value = "Value must be greater than zero";
  if (type === "percent" && Number(value) > 100) errors.value = "Percent cannot exceed 100";

  if (minOrder !== null && minOrder !== undefined && minOrder !== "" && Number(minOrder) < 0) {
    errors.minOrder = "Minimum order cannot be negative";
  }
  if (maxUses !== null && maxUses !== undefined && maxUses !== "" && Number(maxUses) < 1) {
    errors.maxUses = "Max uses must be at least 1";
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}

// "type" is percent or fixed. Legacy documents have no type and are flat
// amounts - never assume a missing type means percent.
export function couponLabel(coupon, lang = "en") {
  if (!coupon) return "";
  const value = Number(coupon.value ?? 0);
  const body = coupon.type === "percent" ? `${value}%` : `${value} EGP`;
  return lang === "ar" ? `خصم ${body}` : `${body} off`;
}