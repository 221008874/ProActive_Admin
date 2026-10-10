// One-off migration: existing products/coupons/orders -> the fashion data model.
//
//   node scripts/migrate.mjs --dry     preview only, writes nothing
//   node scripts/migrate.mjs           apply
//
// Credentials come from SERVICE_ACCOUNT (path to the key JSON), kept outside
// the repo. The script is ADDITIVE: it merges new fields and leaves the old ones
// in place, so the current apps keep working until you switch them over.
//
// Two corrections to the original plan are applied here and marked CORRECTION.

import fs from "node:fs";
import * as admin from "firebase-admin";

const keyPath = process.env.SERVICE_ACCOUNT;
if (!keyPath) {
  console.error("Set SERVICE_ACCOUNT to the path of your service account key JSON.");
  process.exit(1);
}
if (!fs.existsSync(keyPath)) {
  console.error(`Service account file not found: ${keyPath}`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) });
const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

const DRY = process.argv.includes("--dry");

// Wrap a plain value into a bilingual {ar, en} object without destroying one.
const asLoc = (v) => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return { ar: v.ar ?? v.en ?? "", en: v.en ?? v.ar ?? "" };
  }
  if (v === null || v === undefined) return { ar: "", en: "" };
  const s = String(v);
  return { ar: s, en: s };
};

const DEFAULT_VARIANT = {
  colorId: "default",
  color: "Default",
  size: "ONE",
  sku: null,
  stock: 0,
  priceOverride: null,
  active: true
};

async function migrateProducts() {
  const snap = await db.collection("products_egp").get();
  console.log(`\nproducts_egp: ${snap.size} document(s)`);

  for (const d of snap.docs) {
    const p = d.data();

    if (p.status && Array.isArray(p.sizes) && p.colors) {
      console.log(`  skip (already migrated) ${d.id}`);
      continue;
    }

    // !! ADJUST: map these to the real field names in your product docs !!
    const name = p.title ?? p.name;
    const price = Number(p.price ?? 0);
    const stock = Number(p.stock ?? p.quantity ?? 0);
    const image = p.image ?? p.imageUrl ?? p.imageURL ?? p.images?.[0] ?? null;
    const compareAt = p.compareAtPrice ?? p.oldPrice ?? p.originalPrice ?? null;

    const categoryId = p.categoryId ?? p.category ?? "uncategorized";

    const update = {
      title: asLoc(name),
      description: asLoc(p.description ?? ""),
      slug: String(p.slug ?? d.id).toLowerCase(),
      categoryId,
      categoryPath: Array.isArray(p.categoryPath) && p.categoryPath.length
        ? p.categoryPath
        : [p.gender ?? "unisex", categoryId],
      gender: p.gender ?? "unisex",
      brand: p.brand ?? "ProActive",
      tags: Array.isArray(p.tags) ? p.tags : [],
      price,
      compareAtPrice: compareAt === null ? null : Number(compareAt),
      discountPct: compareAt && Number(compareAt) > price
        ? Math.round((1 - price / Number(compareAt)) * 100)
        : 0,
      images: image
        ? [{ url: image, publicId: p.publicId ?? null, color: "default", isPrimary: true }]
        : [],
      colors: [{ id: "default", name: { ar: "افتراضي", en: "Default" }, hex: "#999999" }],
      sizes: ["ONE"],
      sizeGuideId: null,
      totalStock: stock,
      availableColors: stock > 0 ? ["default"] : [],
      availableSizes: stock > 0 ? ["ONE"] : [],
      isNew: p.isNew ?? false,
      isFeatured: p.isFeatured ?? false,
      soldCount: Number(p.soldCount ?? 0),
      status: p.status ?? "active",
      updatedAt: serverTimestamp,
      createdAt: p.createdAt ?? serverTimestamp
    };

    const variant = { ...DEFAULT_VARIANT, sku: p.sku ?? d.id, stock };

    console.log(`  ${DRY ? "would migrate" : "migrate"} ${d.id}  stock=${stock} price=${price}`);
    if (!DRY) {
      const batch = db.batch();
      batch.set(d.ref, update, { merge: true });
      batch.set(d.ref.collection("variants").doc("default_ONE"), variant);
      await batch.commit();
    }
  }
}

async function migrateCoupons() {
  const snap = await db.collection("egp_coupons").get();
  console.log(`\negp_coupons: ${snap.size} document(s)`);

  for (const d of snap.docs) {
    const c = d.data();
    const code = String(c.code ?? d.id).trim().toUpperCase();
    if (!code) {
      console.log(`  !! ${d.id} has no code - skipped, fix manually`);
      continue;
    }
    if (d.id === code && c.type) {
      console.log(`  skip (already migrated) ${d.id}`);
      continue;
    }

    // CORRECTION 2: existing coupons are a flat amount, so they migrate as
    // "fixed". Defaulting to "percent" here would silently turn a
    // "10 EGP off" coupon into "10% off".
    const type = c.type ?? "fixed";
    const value = Number(c.value ?? c.amount ?? c.discount ?? 0);

    console.log(`  ${DRY ? "would write" : "write"} ${d.id} -> egp_coupons/${code}  type=${type} value=${value}`);
    if (!DRY) {
      await db.collection("egp_coupons").doc(code).set(
        {
          code,
          type,
          value,
          minOrder: Number(c.minOrder ?? 0),
          maxUses: c.maxUses ?? null,
          usedCount: Number(c.usedCount ?? 0),
          expiresAt: c.expiresAt ?? null,
          // the current admin writes isActive; the new model uses active
          active: c.active ?? c.isActive ?? true,
          createdAt: c.createdAt ?? serverTimestamp
        },
        { merge: true }
      );
      // The old random-ID doc is intentionally left in place. Delete it by
      // hand once the new storefront has been verified.
    }
  }
}

async function migrateOrders() {
  const snap = await db.collection("orders_egp").get();
  console.log(`\norders_egp: ${snap.size} document(s)`);

  for (const d of snap.docs) {
    const o = d.data();
    const status =
      o.adminConfirmed && o.status === "pending" ? "confirmed" : o.status ?? "pending";

    if (Array.isArray(o.statusHistory) && o.status === status) {
      console.log(`  skip (already migrated) ${d.id}`);
      continue;
    }

    console.log(`  ${DRY ? "would set" : "set"} ${d.id} -> status=${status}`);
    if (!DRY) {
      await d.ref.set(
        {
          status,
          adminConfirmed: status !== "pending",
          statusHistory: o.statusHistory ?? [{ status, at: Date.now(), by: "migration" }]
        },
        { merge: true }
      );
    }
  }
}

async function migrateSettings() {
  const ref = db.doc("egp_settings/general");
  const snap = await ref.get();
  const current = snap.exists ? snap.data() : {};
  // The storefront previously hardcoded 800; capture whatever the admin set.
  const freeShippingThreshold = Number(current.freeShippingThreshold ?? 800);

  console.log(`\negp_settings/general: freeShippingThreshold=${freeShippingThreshold}`);
  if (DRY) return;
  await ref.set(
    {
      freeShippingThreshold,
      currency: current.currency ?? "EGP",
      storeName: current.storeName ?? "ProActive",
      whatsapp: current.whatsapp ?? null
    },
    { merge: true }
  );
}

async function seedCategories() {
  const cats = [
    { id: "women", name: { ar: "نساء", en: "Women" }, parentId: null, order: 1 },
    { id: "men", name: { ar: "رجال", en: "Men" }, parentId: null, order: 2 },
    { id: "kids", name: { ar: "أطفال", en: "Kids" }, parentId: null, order: 3 },
    { id: "uncategorized", name: { ar: "أخرى", en: "Other" }, parentId: null, order: 99 }
  ];

  console.log(`\ncategories: ${cats.length} to seed`);
  for (const c of cats) {
    console.log(`  ${DRY ? "would seed" : "seed"} ${c.id}`);
    if (!DRY) {
      await db.collection("categories").doc(c.id).set(
        { slug: c.id, image: null, active: true, ...c },
        { merge: true }
      );
    }
  }
}

console.log(DRY ? "=== DRY RUN - nothing will be written ===" : "=== APPLYING ===");
await seedCategories();
await migrateProducts();
await migrateCoupons();
await migrateOrders();
await migrateSettings();
console.log(DRY ? "\ndry run complete. Review the output above." : "\ndone.");
process.exit(0);