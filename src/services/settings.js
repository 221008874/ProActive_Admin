// Store settings: the one general document, and the per-governorate table.
//
// Both are written by the admin and read by the storefront, so they share this
// module's idea of their shape rather than each side guessing.
//
// Settings writes merge rather than replace, so adding a field later cannot
// wipe the ones already there.

import {
  collection,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase'

const withId = (d) => ({ id: d.id, ...d.data() })

/* ------------------------------- general -------------------------------- */

export async function fetchSettings() {
  const snap = await getDoc(doc(db, 'egp_settings', 'general'))
  return snap.exists() ? snap.data() : {}
}

/** Merge a patch into egp_settings/general. Returns the document as saved. */
export async function saveSettings(patch) {
  const ref = doc(db, 'egp_settings', 'general')
  await setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true })
  const snap = await getDoc(ref)
  return snap.data()
}

/* ----------------------------- governorates ----------------------------- */

// Sorted by document id rather than by a data field: `order` is optional on
// documents written before it existed, and an orderBy on a missing field drops
// the whole row from the result.
const allGovernorates = () =>
  query(collection(db, 'egp_governorate_costs'), orderBy(FieldPath.documentId()))

export async function fetchGovernorates() {
  const snap = await getDocs(allGovernorates())
  return snap.docs.map(withId)
}

export async function saveGovernorate(id, patch) {
  const ref = doc(db, 'egp_governorate_costs', id)
  const data = {
    cost: Number(patch.cost ?? 0),
    minOrder: Number(patch.minOrder ?? 0),
    active: patch.active !== false,
    updatedAt: serverTimestamp()
  }
  if (patch.name) data.name = patch.name
  await setDoc(ref, data, { merge: true })
  const snap = await getDoc(ref)
  return snap.data()
}

/**
 * Seed the 27 governorates from the static reference.
 *
 * Idempotent and additive: an existing document keeps its cost, minimum and
 * active flag, so running this against a configured store changes nothing.
 * It only fills in the ids that are missing.
 */
export async function ensureGovernorates(seed = []) {
  const snap = await getDocs(allGovernorates())
  const existing = new Map(snap.docs.map((d) => [d.id, d.data()]))

  const batch = writeBatch(db)
  let added = 0

  for (const g of seed) {
    const current = existing.get(g.id)
    if (current) {
      // A governorate that exists but never got a name still needs one.
      if (!current.name && g.name) {
        batch.set(doc(db, 'egp_governorate_costs', g.id), { name: g.name }, { merge: true })
        added++
      }
      continue
    }
    batch.set(doc(db, 'egp_governorate_costs', g.id), {
      name: g.name,
      cost: g.defaultCost ?? 60,
      minOrder: 0,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    added++
  }

  if (added > 0) await batch.commit()
  return added
}