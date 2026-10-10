// Formatting + i18n helpers shared by every component.
// `loc` is the same helper the migration plan asks for in src/utils/i18n.js — if you
// already created it, delete this copy and import yours instead.

export const loc = (field, lang = "en") =>
  field && typeof field === "object" ? (field[lang] ?? field.en ?? field.ar ?? "") : (field ?? "");

// The design shows "360 EGP". For Arabic I used "ج.م" — change CURRENCY.ar if you prefer "جنيه".
const CURRENCY = { en: "EGP", ar: "ج.م" };

/** formatEGP(360, "en") -> "360 EGP". Wrap the result in <bdi> / .pa-ltr inside Arabic text. */
export function formatEGP(amount, lang = "en") {
  const n = Math.round(Number(amount) || 0);
  return `${n.toLocaleString("en-US")} ${CURRENCY[lang] ?? CURRENCY.en}`;
}

/** discountPct from price + compareAtPrice (same formula as the migration plan). */
export function discountPct(price, compareAtPrice) {
  return compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : 0;
}

/** "Only N left" threshold from the design: shown at 3 or fewer. */
export const LOW_STOCK_AT = 3;

/** Admin stock-grid cell level: 0 = sold out, <=2 = low (matches the Low stock page rule). */
export const stockLevel = (n) => (n <= 0 ? "zero" : n <= 2 ? "low" : "ok");

/** First image of a product, preferring one tagged with the given colour. */
export function pickImage(product, colorId) {
  const imgs = product?.images ?? [];
  return (colorId && imgs.find((i) => i.color === colorId)) || imgs.find((i) => i.isPrimary) || imgs[0] || null;
}

/** Cloudinary delivery transform (migration 6.9): w_400,q_auto,f_auto for thumbnails. */
export function thumb(url, w = 400) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`);
}
