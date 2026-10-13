// Product writes for the fashion model: one product document plus its variant
// subcollection, saved atomically.

import {
  doc,
  collection,
  writeBatch,
  serverTimestamp,
  getDocs,
  getDoc,
  runTransaction,
  increment,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "../services/firebase";
import { loc } from "../ui/format";
import { commitCatalogBatch, markCatalogDirty, scheduleCatalogRebuild } from "./catalogDirty";
import {
  variantIdFor,
  computeDenorm,
  computeDiscountPct,
  validateProduct,
  MAX_VARIANTS
} from "./productLogic";

export {
  variantIdFor,
  computeDenorm,
  computeDiscountPct,
  validateProduct,
  validateEditorForm,
  variantsFromGrid,
  MAX_VARIANTS
} from "./productLogic";

export async function saveProduct(productId, data, variants) {
  const { errors, isValid } = validateProduct(data, variants);
  if (!isValid) {
    const err = new Error("Invalid product");
    err.code = "VALIDATION";
    err.errors = errors;
    throw err;
  }

  const ref = productId
    ? doc(db, "products_egp", productId)
    : doc(collection(db, "products_egp"));

  const batch = writeBatch(db);

  batch.set(
    ref,
    {
      ...data,
      discountPct: computeDiscountPct(data.price, data.compareAtPrice),
      ...computeDenorm(variants),
      updatedAt: serverTimestamp(),
      ...(productId ? {} : { createdAt: serverTimestamp(), soldCount: 0 })
    },
    { merge: true }
  );

  if (productId) {
    const existing = await getDocs(collection(ref, "variants"));
    const keep = new Set(variants.map((v) => variantIdFor(v.colorId, v.size)));
    for (const d of existing.docs) {
      if (!keep.has(d.id)) batch.delete(d.ref);
    }
  }

  for (const v of variants) {
    const id = variantIdFor(v.colorId, v.size);
    batch.set(doc(ref, "variants", id), {
      ...v,
      stock: Number(v.stock) || 0,
      priceOverride: v.priceOverride ?? null,
      active: v.active !== false,
      sku: v.sku || `${ref.id}-${id}`.toUpperCase()
    });
  }

  // The flag rides along in the same batch: if the tab dies between the product
  // write and a second write, the shop must never be left stale silently.
  await commitCatalogBatch(batch);

  return ref.id;
}

// Single-variant stock edit from the Low Stock page.
export async function setVariantStock(productId, variantId, stock) {
  const value = Math.max(0, Math.floor(Number(stock) || 0));
  const productRef = doc(db, "products_egp", productId);
  const variantRef = doc(productRef, "variants", variantId);

  await runTransaction(db, async (tx) => {
    const variantSnap = await tx.get(variantRef);
    if (!variantSnap.exists()) {
      const err = new Error("Variant not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    tx.update(variantRef, { stock: value });
    tx.update(productRef, {
      totalStock: increment(value - (variantSnap.data().stock ?? 0)),
      updatedAt: serverTimestamp()
    });

    markCatalogDirty(tx);
  });

  // A transaction cannot also schedule the publish, so it happens here.
  scheduleCatalogRebuild();
}

// Restores the denormalised colour/size flags after cancellations or imports.
// Those flags are baked into the snapshot's product cards, so the card has to be
// repatched for the storefront to show the restored options.
export async function recomputeProductFlags(productId) {
  const productRef = doc(db, "products_egp", productId);
  const snap = await getDocs(collection(productRef, "variants"));
  const batch = writeBatch(db);
  batch.set(
    productRef,
    { ...computeDenorm(snap.docs.map((d) => ({ ...d.data(), id: d.id }))) },
    { merge: true }
  );
  await commitCatalogBatch(batch);
}

export async function fetchProductForEdit(id) {
  const [productSnap, variantSnap] = await Promise.all([
    getDoc(doc(db, "products_egp", id)),
    getDocs(collection(db, "products_egp", id, "variants"))
  ]);
  if (!productSnap.exists()) return null;
  return { id, ...productSnap.data(), variants: variantSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

// Soft delete: products that have orders must not vanish from history.
export async function archiveProduct(id) {
  const batch = writeBatch(db);
  batch.set(doc(db, "products_egp", id), {
    status: "archived",
    updatedAt: serverTimestamp()
  }, { merge: true });
  // Archiving changes whether the product is collected by the snapshot build at
  // all, so it forces a full rebuild rather than a product-card patch.
  await commitCatalogBatch(batch, { scope: "full" });
}

/**
 * Every product, for the admin table. Not filtered by status: the owner needs
 * to see drafts and archived items to manage them, and the table filters
 * client-side.
 */
export async function fetchAllProducts() {
  const snap = await getDocs(
    query(collection(db, "products_egp"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Save a product and its stock grid in one step.
 *
 * Takes the editor's shape rather than the storage shape, so the caller does
 * not have to know how variants are keyed or denormalised. Validation runs
 * first and throws with a field map, so the panel can point at the field.
 */
export async function saveProductWithStock({ product, stock }) {
  const { id, colors, sizes, ...rest } = product;

  const variants = (colors ?? []).flatMap((c) =>
    (sizes ?? []).map((s) => ({
      colorId: c.id,
      color: loc(c.name, "en") || c.id,
      size: s,
      stock: Number(stock?.[`${c.id}_${s}`] ?? 0),
      priceOverride: null,
      active: true
    }))
  );

  const data = {
    ...rest,
    // An empty slug is generated from the English title, because the storefront
    // resolves /product/<slug> and two products cannot share one.
    slug: (rest.slug || slugify(loc(rest.title, "en"))).toLowerCase(),
    title: rest.title,
    price: Number(rest.price),
    compareAtPrice: rest.compareAtPrice == null ? null : Number(rest.compareAtPrice),
    categoryId: rest.categoryId || null
  };

  return saveProduct(id, data, variants);
}

export function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { loc };

export async function fetchLowStock(max = 2) {
  const snap = await getDocs(collection(db, "variants"));
  return snap.docs
    .filter((d) => Number(d.data().stock) <= max && d.data().active !== false)
    .map((d) => {
      const path = d.ref.path.split("/");
      return { id: d.id, stock: d.data().stock, productId: path[1], ...d.data() };
    });
}