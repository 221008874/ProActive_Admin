// Order status lifecycle for the admin panel.
//
// The order's own `status` field is now the single source of truth -
// `confirmedPayments_egp` is legacy and is no longer written.

import { doc, collection, getDocs, query, where, orderBy, runTransaction, arrayUnion, increment } from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { canTransition } from "./orderLogic";

export {
  ORDER_STATUSES,
  ALLOWED_TRANSITIONS,
  canTransition,
  isTerminal,
  isStockRestoringStatus,
  mapsUrlFor,
  whatsappUrlFor,
  whatsappTemplateFor
} from "./orderLogic";

const actor = () => auth?.currentUser?.email ?? "admin";

export async function setStatus(orderId, status) {
  const ref = doc(db, "orders_egp", orderId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      const err = new Error("NOT_FOUND");
      err.code = "NOT_FOUND";
      throw err;
    }

    const current = snap.data().status ?? "pending";
    if (!canTransition(current, status)) {
      const err = new Error(`BAD_TRANSITION:${current}->${status}`);
      err.code = "BAD_TRANSITION";
      throw err;
    }

    tx.update(ref, {
      status,
      adminConfirmed: status !== "pending",
      statusHistory: arrayUnion({ status, at: Date.now(), by: actor() })
    });
  });
}

// Cancel / return puts stock and coupon usage back. Idempotent: running it
// twice must not double-credit the stock.
export async function cancelOrder(orderId, newStatus = "cancelled") {
  const ref = doc(db, "orders_egp", orderId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      const err = new Error("NOT_FOUND");
      err.code = "NOT_FOUND";
      throw err;
    }

    const order = snap.data();
    if (["cancelled", "returned"].includes(order.status)) return;

    for (const item of order.items ?? []) {
      // Legacy orders have no variantId; their stock was never per-variant.
      if (!item.variantId) continue;

      tx.update(doc(db, "products_egp", item.productId, "variants", item.variantId), {
        stock: increment(item.qty)
      });
      tx.update(doc(db, "products_egp", item.productId), {
        totalStock: increment(item.qty),
        soldCount: increment(-(item.qty ?? 0))
      });
    }

    if (order.coupon?.code) {
      tx.update(doc(db, "egp_coupons", order.coupon.code), { usedCount: increment(-1) });
    }

    tx.update(ref, {
      status: newStatus,
      adminConfirmed: false,
      statusHistory: arrayUnion({ status: newStatus, at: Date.now(), by: actor() })
    });
  });
}

/**
 * Orders with one status, newest first. `status` accepts an array so the
 * "cancelled and returned" tab can be one read rather than two.
 */
export async function fetchOrdersByStatus(status) {
  const where_ = Array.isArray(status) ? where("status", "in", status) : where("status", "==", status);
  const snap = await getDocs(
    query(collection(db, "orders_egp"), where_, orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Every order, newest first. Used for the status-tab counts, so a count can
 * never disagree with the rows behind it: both come from the same read.
 */
export async function fetchOrders() {
  const snap = await getDocs(query(collection(db, "orders_egp"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Replaces the old pendingOrders filter, which keyed off status + adminConfirmed.
export async function fetchPendingOrders() {
  const snap = await getDocs(
    query(
      collection(db, "orders_egp"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}