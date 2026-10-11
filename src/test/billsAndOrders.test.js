import { it, expect, vi } from 'vitest'

// The bills tab and the order view-model mapping.
//
// The mapping is the important half: the store writes orders server-side
// with a different field shape than the legacy orders this panel was built
// for, and a blank "Customer" cell on every new order is exactly the kind of
// failure that looks like missing data instead of a mapping bug.

if (typeof window === 'undefined') {
  const mkEl = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} })
  const doc = {
    documentElement: { dataset: {}, style: {}, setAttribute() {}, lang: '', dir: '' },
    body: { style: {}, appendChild() {}, className: '' },
    head: { appendChild() {} },
    createElement: mkEl,
    getElementById: () => null,
    addEventListener() {},
    removeEventListener() {}
  }
  globalThis.window = {
    document: doc,
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1280,
    innerHeight: 800,
    location: { hash: '' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  }
  globalThis.document = doc
  globalThis.localStorage = window.localStorage
}
if (typeof requestAnimationFrame === 'undefined') globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)

vi.mock('jspdf', () => ({ jsPDF: class {} }))
vi.mock('html2canvas', () => ({ default: () => Promise.resolve({}) }))
vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('') } }))
vi.mock('../services/firebase.js', () => ({ db: {}, auth: { currentUser: null } }))

const React = (await import('react')).default
const { renderToString } = await import('react-dom/server')
const { MemoryRouter } = await import('react-router-dom')
const { toOrderView } = await import('../services/orderView.js')
const { default: BillsPanel } = await import('../components/BillsPanel.jsx')
const { LanguageProvider } = await import('../context/LanguageContext.jsx')
const { storeApi } = await import('../services/storeApi.js')

const asDoc = (id, data) => ({ id, data: () => data })

const SERVER_ORDER = {
  orderNumber: 'PA-LZ3K9X2',
  status: 'pending',
  adminConfirmed: false,
  paymentMethod: 'cod',
  customer: { name: 'Jane Doe', phone: '01012345678', email: 'jane@example.com' },
  address: {
    governorateId: 'cairo',
    governorate: 'Cairo',
    city: 'Giza',
    street: '12 Elm Street',
    building: '3B',
    lat: 30.04,
    lng: 31.23
  },
  items: [
    { productId: 'dress', variantId: 'red_M', title: 'Summer Dress', color: 'Red', size: 'M', unitPrice: 450, qty: 2, lineTotal: 900 }
  ],
  subtotal: 900,
  discount: 90,
  shippingCost: 60,
  total: 870,
  createdAt: { seconds: 1728000000 }
}

it('maps the server order shape onto the fields the panel reads', () => {
  const view = toOrderView(asDoc('o1', SERVER_ORDER))
  expect(view.orderId).toBe('PA-LZ3K9X2')
  expect(view.customerName).toBe('Jane Doe')
  expect(view.customerPhone).toBe('01012345678')
  expect(view.customerAddress).toBe('12 Elm Street, Giza, Cairo')
  expect(view.governorate).toBe('Cairo')
  expect(view.totalItems).toBe(2)
  expect(view.totalPrice).toBe(870)
  expect(view.currency).toBe('EGP')
  expect(view.status).toBe('pending')
  expect(view.adminConfirmed).toBe(false)
  expect(view.items).toEqual([{ name: 'Summer Dress', quantity: 2, price: 450 }])
})

it('keeps legacy mobile orders rendering through the same view', () => {
  const legacy = toOrderView(asDoc('o2', {
    orderId: 'PA-000001',
    customerName: 'Old Shopper',
    customerPhone: '01000000000',
    customerAddress: '1 Talaat Harb St',
    governorate: 'Cairo',
    totalItems: 3,
    totalPrice: 1200,
    items: [{ name: 'Legacy Dress', quantity: 3, price: 400 }],
    status: 'pending',
    adminConfirmed: false,
    createdAt: { seconds: 1720000000 }
  }))
  expect(legacy.orderId).toBe('PA-000001')
  expect(legacy.customerName).toBe('Old Shopper')
  expect(legacy.customerAddress).toBe('1 Talaat Harb St')
  expect(legacy.totalPrice).toBe(1200)
  expect(legacy.items).toEqual([{ name: 'Legacy Dress', quantity: 3, price: 400 }])
})

it('survives orders with no address and no items', () => {
  const sparse = toOrderView(asDoc('o3', { orderNumber: 'PA-EMPTY1' }))
  expect(sparse.orderId).toBe('PA-EMPTY1')
  expect(sparse.customerName).toBeNull()
  expect(sparse.customerAddress).toBeNull()
  expect(sparse.totalItems).toBe(0)
  expect(sparse.totalPrice).toBeNull()
  expect(sparse.items).toEqual([])
  expect(sparse.createdAt).toBeNull()
})

it('bills panel renders its table shell while loading (no store URL needed)', () => {
  const html = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(LanguageProvider, null, React.createElement(BillsPanel))
    )
  )
  expect(html).toContain('pa-tablebox')
  expect(html).toContain('Order bills') // the English label resolves, not the key
  expect(html).toContain('Loading bills')
  expect(html).toContain('pa-input')
})

it('the store api client refuses to build a request without a configured base', async () => {
  // VITE_STORE_API_BASE is unset in tests: the bills' bytes have no public
  // URL, so an unconfigured client must fail loudly instead of guessing.
  expect(storeApi.isConfigured()).toBe(false)
  await expect(storeApi.getJson('/admin/documents/download?path=x')).rejects.toThrow(
    'STORE_API_NOT_CONFIGURED'
  )
})
