import { it, expect, vi, beforeEach, afterEach } from 'vitest'

// The storefront reads a pre-built catalogue snapshot, so an Admin write is only
// really finished when the Store has been told to publish it.
//
// Two things are asserted here, and both are load-bearing:
//
//   1. The dirty flag rides inside the SAME batch/transaction as the data. A
//      follow-up write would be lost to a closed tab, which is exactly the
//      failure the flag exists to prevent.
//
//   2. Publishing is best-effort and never fails the save. The data already
//      committed, so a slow or unconfigured Store API must not surface as a
//      save error - the flag is the fallback that still ships the change on the
//      Store's next scheduled rebuild.
//
// The Store-side half of this contract is catalogCore.refreshSnapshotIfStale in
// the ProActive_Store repo, which reads egp_settings/catalog.dirty.

vi.mock('../services/firebase.js', () => ({ db: { __db: true } }))

const rebuild = vi.fn()
vi.mock('../services/catalog.js', () => ({ rebuildCatalog: () => rebuild() }))

const storeApiState = { configured: true }
vi.mock('../services/storeApi.js', () => ({
  storeApi: { isConfigured: () => storeApiState.configured }
}))

vi.mock('firebase/firestore', () => ({
  // Real signature: doc(db, collection, id). The db ref is dropped.
  doc: (_db, ...path) => ({ __path: path.join('/') })
}))

const { commitCatalogBatch, scheduleCatalogRebuild, __resetCatalogRebuildForTests } = await import(
  '../services/catalogDirty.js'
)

/** A WriteBatch stand-in that records what was staged. */
function fakeBatch() {
  const staged = []
  return {
    staged,
    set(ref, data, options) {
      staged.push({ ref, data, options })
    },
    async commit() {
      this.committed = true
    }
  }
}

beforeEach(() => {
  rebuild.mockReset()
  storeApiState.configured = true
  __resetCatalogRebuildForTests()
})

afterEach(() => {
  __resetCatalogRebuildForTests()
  vi.useRealTimers()
})

it('stages the flag on the same batch as the data', async () => {
  const batch = fakeBatch()

  await commitCatalogBatch(batch)

  expect(batch.staged).toHaveLength(1)
  expect(batch.staged[0].ref.__path).toBe('egp_settings/catalog')
  expect(batch.staged[0].data).toMatchObject({ dirty: true, dirtyScope: 'products' })
  expect(batch.staged[0].options).toEqual({ merge: true })
  // The flag is staged BEFORE the commit, so they cannot land apart.
  expect(batch.committed).toBe(true)
})

it('merges the flag so the build metadata is not clobbered', async () => {
  const batch = fakeBatch()

  await commitCatalogBatch(batch)

  // Without merge, this write would drop version/lastBuiltAt, which is how the
  // Store knows when it last built.
  expect(batch.staged[0].options.merge).toBe(true)
})

it('records the structural scope for category and settings changes', async () => {
  const batch = fakeBatch()

  await commitCatalogBatch(batch, { scope: 'full' })

  expect(batch.staged[0].data.dirtyScope).toBe('full')
})

it('does not call the Store API when it is not configured', async () => {
  vi.useFakeTimers()
  storeApiState.configured = false

  await commitCatalogBatch(fakeBatch())
  vi.advanceTimersByTime(5000)

  // The flag is still staged, so the Store's cron picks the change up.
  expect(rebuild).not.toHaveBeenCalled()
})

it('publishes after the debounce, not on every keystroke-sized edit', async () => {
  vi.useFakeTimers()
  rebuild.mockResolvedValue({ version: 4 })

  scheduleCatalogRebuild()
  vi.advanceTimersByTime(400)
  scheduleCatalogRebuild()
  vi.advanceTimersByTime(400)
  expect(rebuild).not.toHaveBeenCalled() // the first timer was replaced

  vi.advanceTimersByTime(1500)
  expect(rebuild).toHaveBeenCalledTimes(1)
})

it('never lets a publish failure escape into the caller', async () => {
  vi.useFakeTimers()
  rebuild.mockRejectedValue(new Error('STORE_API_NOT_CONFIGURED'))

  // scheduleCatalogRebuild is fire-and-forget; the save that called it already
  // succeeded, so nothing may throw here.
  expect(() => scheduleCatalogRebuild()).not.toThrow()

  vi.advanceTimersByTime(1500)
  await vi.runAllTimersAsync()
  expect(rebuild).toHaveBeenCalledTimes(1)
})