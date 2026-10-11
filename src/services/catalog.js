// Rebuilding the storefront's catalogue snapshot.
//
// The storefront reads /api/catalog, which serves a pre-built snapshot rather
// than querying Firestore on every visitor request. That snapshot is rebuilt by
// a scheduled job, but a schedule is the wrong tool right after a change: you
// edit a product, the shop still shows the old one, and waiting until 04:00 to
// find out is how a wrong price reaches a customer.
//
// So the same builder runs on demand behind POST /api/admin/catalog/rebuild,
// which requires the admin claim and returns the version it wrote.

import { storeApi } from './storeApi'

/**
 * Rebuild the catalogue snapshot now.
 *
 * @returns {Promise<{ok: boolean, version: number, productCount: number, shards: number}>}
 * @throws  Error('STORE_API_NOT_CONFIGURED') when VITE_STORE_API_BASE is unset.
 */
export async function rebuildCatalog() {
  return storeApi.postJson('/api/admin/catalog/rebuild', {})
}