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
  increment
} from "firebase/firestore";
import { db } from "../services/firebase";
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

  await batch.commit();
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
  });
}

// Restores the denormalised colour/size flags after cancellations or imports.
export async function recomputeProductFlags(productId) {
  const productRef = doc(db, "products_egp", productId);
  const snap = await getDocs(collection(productRef, "variants"));
  await productRef.update({ ...computeDenorm(snap.docs.map((d) => ({ ...d.data(), id: d.id }))) });
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
  await doc(db, "products_egp", id).update({
    status: "archived",
    updatedAt: serverTimestamp()
  });
}

export async function fetchLowStock(max = 2) {
  const snap = await getDocs(collection(db, "variants"));
  return snap.docs
    .filter((d) => Number(d.data().stock) <= max && d.data().active !== false)
    .map((d) => {
      const path = d.ref.path.split("/");
      return { id: d.id, stock: d.data().stock, productId: path[1], ...d.data() };
    });
}