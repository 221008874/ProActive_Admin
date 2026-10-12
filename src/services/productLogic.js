// Pure product logic for the fashion model. Kept free of any Firebase import so
// it can be unit tested without initializing an app.

export function variantIdFor(colorId, size) {
  return `${colorId}_${size}`;
}

// Denormalised fields the storefront filters on, recomputed from the variants on
// every save so they cannot drift. totalStock counts every active variant even
// when it is at zero, so a "back in stock soon" product still counts as a
// valid combination.
export function computeDenorm(variants) {
  const list = Array.isArray(variants) ? variants : [];
  const purchasable = list.filter((v) => v.active !== false && Number(v.stock) > 0);

  return {
    totalStock: list.reduce((sum, v) => sum + (v.active === false ? 0 : Number(v.stock) || 0), 0),
    availableColors: [...new Set(purchasable.map((v) => v.colorId))],
    availableSizes: [...new Set(purchasable.map((v) => v.size))]
  };
}

export function computeDiscountPct(price, compareAtPrice) {
  const p = Number(price);
  const c = Number(compareAtPrice);

  if (!Number.isFinite(p) || !Number.isFinite(c)) return 0;
  if (c <= 0 || c <= p) return 0;

  return Math.round((1 - p / c) * 100);
}

// A stock grid of 10 colours x 10 sizes is 100 variants; the cap leaves plenty
// of room under the 500-operation write-batch limit while catching a
// mis-built grid before it silently truncates.
export const MAX_VARIANTS = 400;

export function validateProduct(data = {}, variants = []) {
  const errors = {};

  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) errors.price = "Price must be greater than zero";

  const compareAt = data.compareAtPrice;
  if (compareAt !== null && compareAt !== undefined && compareAt !== "") {
    const c = Number(compareAt);
    if (!Number.isFinite(c) || c <= price) {
      errors.compareAtPrice = "Compare-at price must be greater than the price";
    }
  }

  if (!Array.isArray(data.colors) || data.colors.length === 0) errors.colors = "Add at least one colour";
  if (!Array.isArray(data.sizes) || data.sizes.length === 0) errors.sizes = "Add at least one size";
  if (!Array.isArray(data.images) || data.images.length === 0) errors.images = "Add at least one image";
  if (!Array.isArray(variants) || variants.length === 0) errors.variants = "Add at least one variant";
  if (Array.isArray(variants) && variants.length > MAX_VARIANTS) {
    // A placeholder rather than an interpolated string, so the message stays a
    // stable i18n key and the editor can fill `{max}` from MAX_VARIANTS.
    errors.variants = "Too many variants (max {max})";
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}

// Turns a colour x size grid into the flat variant array the batch writes.
export function variantsFromGrid(colors, sizes, stockByKey = {}) {
  const out = [];
  for (const color of colors ?? []) {
    const colorId = typeof color === "string" ? color : color.id;
    for (const size of sizes ?? []) {
      const key = variantIdFor(colorId, size);
      out.push({
        colorId,
        color: typeof color === "string" ? null : color.name?.en ?? colorId,
        size,
        stock: Number(stockByKey[key] ?? 0) || 0,
        priceOverride: null,
        active: true
      });
    }
  }
  return out;
}