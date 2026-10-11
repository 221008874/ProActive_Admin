import { it, expect, vi, beforeEach } from 'vitest'

// The governorate table is sorted by document id.
//
// Sorting by id rather than by a data field matters because `order` is optional
// on documents written before it existed, and an orderBy on a missing field
// drops the whole row. It is also the one query in this panel built on an API
// that moved: Firebase 12 dropped the static `FieldPath.documentId()` in favour
// of a standalone `documentId()` export, so the old call site silently became
// `undefined is not a function` and every load of the operations settings threw.
//
// The mock only implements what the module imports, so a call back to
// `FieldPath.documentId()` would not even link — which is the point of the test.

vi.mock('../services/firebase.js', () => ({ db: {} }))

const calls = { orderBy: [], documentId: 0 }

vi.mock('firebase/firestore', () => {
  const fieldPath = { __fieldPath: '__name__' }
  return {
    collection: () => ({ __collection: true }),
    doc: () => ({ __doc: true }),
    documentId: () => {
      calls.documentId++
      return fieldPath
    },
    getDoc: async () => ({ exists: () => false, data: () => ({}) }),
    getDocs: async () => ({ docs: [] }),
    orderBy: (field) => {
      calls.orderBy.push(field)
      return { __orderBy: field }
    },
    query: (source, ...constraints) => ({ __query: source, constraints }),
    serverTimestamp: () => ({ __serverTimestamp: true }),
    setDoc: async () => {},
    writeBatch: () => ({ set() {}, commit: async () => {} })
  }
})

const { fetchGovernorates } = await import('../services/settings.js')

beforeEach(() => {
  calls.orderBy.length = 0
  calls.documentId = 0
})

it('orders the governorates by the document id', async () => {
  await fetchGovernorates()

  expect(calls.documentId).toBe(1)
  expect(calls.orderBy).toEqual([{ __fieldPath: '__name__' }])
})

it('seeds from the same sorted query, so ids come back in order', async () => {
  const { ensureGovernorates } = await import('../services/settings.js')

  await ensureGovernorates([{ id: 'cairo', name: 'Cairo' }])

  expect(calls.orderBy).toHaveLength(1)
  expect(calls.orderBy[0]).toEqual({ __fieldPath: '__name__' })
})