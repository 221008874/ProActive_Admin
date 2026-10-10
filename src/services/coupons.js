// Coupon writes for the admin panel.
//
// Coupon documents are keyed by the uppercased code, so redemption is a plain
// getDoc instead of a query, and two people cannot generate the same code.

import { doc, collection, writeBatch, serverTimestamp, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";
import { randomCode, normalizeCode, validateCoupon } from "./couponLogic";

export { randomCode, normalizeCode, validateCoupon, couponLabel, MAX_PER_BATCH } from "./couponLogic";

// Returns the generated codes so the caller can feed them into the existing QR
// + A4 PDF sheet export.
export async function bulkGenerate({ count, prefix = "PA", type, value, minOrder = 0, maxUses = 1, expiresAt = null }) {
  const { errors, isValid } = validateCoupon({ count, type, value, minOrder, maxUses, expiresAt });
  if (!isValid) {
    const err = new Error("Invalid coupon");
    err.code = "VALIDATION";
    err.errors = errors;
    throw err;
  }

  const batch = writeBatch(db);
  const codes = [];

  for (let i = 0; i < count; i++) {
    const code = normalizeCode(`${prefix}-${randomCode(6)}`);
    codes.push(code);
    batch.set(doc(db, "egp_coupons", code), {
      code,
      type,
      value: Number(value),
      minOrder: Number(minOrder) || 0,
      maxUses: maxUses === null || maxUses === "" ? null : Number(maxUses),
      usedCount: 0,
      expiresAt: expiresAt ?? null,
      active: true,
      createdAt: serverTimestamp()
    });
  }

  await batch.commit();
  return codes;
}

export async function setCouponActive(code, active) {
  await doc(db, "egp_coupons", normalizeCode(code)).update({ active });
}

export async function updateCoupon(code, changes) {
  const ref = doc(db, "egp_coupons", normalizeCode(code));
  const patch = { ...changes };
  if (patch.value !== undefined) patch.value = Number(patch.value);
  if (patch.maxUses !== undefined && (patch.maxUses === "" || patch.maxUses === null)) {
    patch.maxUses = null;
  }
  await ref.update(patch);
}

export async function deleteCoupon(code) {
  await doc(db, "egp_coupons", normalizeCode(code)).delete();
}

export async function fetchCoupons() {
  const snap = await getDocs(query(collection(db, "egp_coupons"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}