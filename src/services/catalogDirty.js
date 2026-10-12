// Marking the storefront catalogue snapshot as stale, and publishing it.
//
// The storefront reads /api/catalog, which serves a pre-built snapshot instead of
// querying Firestore per visitor. The Store rebuilds that snapshot when
// egp_settings/catalog.dirty is true (Store: server/_core/catalogCore.js,
// refreshSnapshotIfStale), so an Admin write that never sets the flag leaves the
// shop serving old data until the nightly cron happens to run.
//
// Setting the flag is not enough on its own, and the reason is worth writing
// down. The Store's cheap path, rebuildShardsPartial, can only repatch PRODUCT
// cards: it selects products whose updatedAt moved since the last build, and
// when none moved it clears the flag as a no-op. A category, collection,
// settings or governorate edit moves no product, so the flag would be cleared
// and the change would never reach the shop - silently. So every write here does
// two things:
//
//   1. sets the flag durably, in the same batch/transaction as the data. This is
//      the safety net: it survives a closed tab, and it is what the Store's
//      nightly cron (server/cron/catalog.js) will act on.
//
//   2. asks the Store to publish now, via POST /api/admin/catalog/rebuild,
//      debounced so a burst of edits costs one rebuild rather than one each.
//
// (2) is best-effort and never fails the save. The write already committed; the
// owner must not see an error because publishing was slow or the Store API is
// not configured. When (2) fails the flag from (1) still guarantees the change
// ships on the next cron run.
//
// Coupon documents are deliberately absent: they are not collected by the
// Store's snapshot build, so flagging them only buys a rebuild that cannot
// publish the change. See coupons.js.

import { doc } from 'firebase/firestore'
import { db } from './firebase'
import { storeApi } from './storeApi'
import { rebuildCatalog } from './catalog'

/** Collection / document of the flag, matching the Store's FLAG_DOC. */
export const CATALOG_FLAG_COLLECTION = 'egp_settings'
export const CATALOG_FLAG_ID = 'catalog'

/** How long to wait for more edits before publishing, in ms. */
export const REBUILD_DEBOUNCE_MS = 1500

let rebuildTimer = null
let rebuildInFlight = null

/**
 * Stage the dirty flag on an in-flight WriteBatch or Transaction.
 *
 * @param {{set: Function}} writer  the batch/transaction committing the change
 * @param {{scope?: 'products'|'full'}} options  diagnostic hint for the log
 */
export function markCatalogDirty(writer, { scope = 'products' } = {}) {
  writer.set(doc(db, CATALOG_FLAG_COLLECTION, CATALOG_FLAG_ID), {
    dirty: true,
    dirtyAt: Date.now(),
    dirtyScope: scope
  }, { merge: true })
}

/**
 * Commit a catalogue-changing batch and ask the Store to publish.
 *
 * Prefer this over markCatalogDirty + batch.commit so a call site cannot
 * accidentally set the flag without ever publishing.
 *
 * @returns {Promise<void>} never rejects for publishing reasons.
 */
export async function commitCatalogBatch(batch, { scope = 'products' } = {}) {
  markCatalogDirty(batch, { scope })
  await batch.commit()
  scheduleCatalogRebuild({ scope })
}

/**
 * Ask the Store to rebuild the snapshot, coalescing rapid edits.
 *
 * Best-effort by design - see the note at the top of this file. Returns the
 * timer handle, or null when there is no Store API to call.
 */
export function scheduleCatalogRebuild({ delayMs = REBUILD_DEBOUNCE_MS, scope = 'products' } = {}) {
  if (!storeApi.isConfigured()) {
    // Not an error: the dirty flag is already set, so the Store's cron will
    // publish. Say it once per call so a misconfigured build is diagnosable.
    console.warn('[catalog] Store API not configured; leaving the snapshot to the next scheduled rebuild.')
    return null
  }

  if (rebuildTimer) clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null
    void publishNow(scope)
  }, delayMs)
  return rebuildTimer
}

async function publishNow(scope) {
  // Coalesce a rebuild that is already running: the flag stays set until it
  // finishes, and writeSnapshot clears it on success.
  if (rebuildInFlight) return rebuildInFlight

  rebuildInFlight = rebuildCatalog()
    .then((result) => {
      console.info(`[catalog] published snapshot v${result?.version} (${scope})`)
      return result
    })
    .catch((error) => {
      // Swallow on purpose: the save succeeded and the dirty flag is set, so
      // the change still ships on the next scheduled rebuild. Surfacing this as
      // a save error would be a lie.
      console.error('[catalog] publish failed; dirty flag left set for the next rebuild:', error)
      return null
    })
    .finally(() => {
      rebuildInFlight = null
    })

  return rebuildInFlight
}

/** Test seam: drop any pending debounce so tests do not leak timers. */
export function __resetCatalogRebuildForTests() {
  if (rebuildTimer) clearTimeout(rebuildTimer)
  rebuildTimer = null
  rebuildInFlight = null
}