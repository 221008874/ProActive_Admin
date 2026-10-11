import { it, expect, vi } from 'vitest'

// Every sidebar link must land on its section, not on the login screen.
//
// This is the bug the admin shipped with: NAV keyed the low-stock section
// "lowStock" while the route was "low-stock", so the sidebar linked to
// /dashboard/lowStock. Nothing matched, the catch-all fired, and an authenticated
// admin was bounced to /login — indistinguishable from being signed out. No
// build or lint rule catches an unmatched route; only rendering the link does.
//
// So these tests do exactly that: render the real App at each nav href, with a
// signed-in admin session, and assert the section's own heading is on the page
// rather than the sign-in form.

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
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    innerWidth: 1280, innerHeight: 800,
    location: { hash: '' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  }
  globalThis.document = doc
  globalThis.localStorage = window.localStorage
}
if (typeof requestAnimationFrame === 'undefined') globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
if (typeof globalThis.atob === 'undefined') globalThis.atob = () => ''
if (typeof globalThis.btoa === 'undefined') globalThis.btoa = () => ''

vi.mock('jspdf', () => ({ jsPDF: class {} }))
vi.mock('html2canvas', () => ({ default: () => Promise.resolve({}) }))
vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('') } }))
vi.mock('../services/firebase.js', () => ({ db: {}, auth: {} }))

// A signed-in administrator. The guard only cares about the admin claim, so
// this is the whole session the router needs. Supplied through the real context
// rather than by mocking onAuthStateChanged, because the provider resolves the
// claim in a microtask and a server render never waits for one.
const ADMIN_SESSION = {
  currentUser: { email: 'admin@example.com', getIdTokenResult: async () => ({ claims: { admin: true } }) },
  isAdmin: true,
  status: 'admin',
  claimError: null,
  loading: false
}

const { MemoryRouter } = await import('react-router-dom')
const React = (await import('react')).default
const { renderToString } = await import('react-dom/server')
const { NAV, hrefFor } = await import('../config/nav.js')
const { AppRoutes } = await import('../App.jsx')
const { AuthContext } = await import('../context/AuthContext.jsx')
const { LanguageProvider } = await import('../context/LanguageContext.jsx')

const renderAt = (path) =>
  renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: [path] },
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          AuthContext.Provider,
          { value: ADMIN_SESSION },
          React.createElement(AppRoutes)
        )
      )
    )
  )

// The headings the sections themselves render. If the router fell through to the
// catch-all none of them appear and the sign-in form does.
const HEADINGS = {
  overview: 'Overview',
  products: 'Products',
  orders: 'Orders',
  bills: 'Bills',
  categories: 'Categories',
  coupons: 'Coupons',
  operations: 'Operations',
  lowStock: 'Low stock'
}

it('every sidebar link opens its own section, not the login screen', () => {
  for (const nav of NAV) {
    const html = renderAt(hrefFor(nav))
    expect(html, `${hrefFor(nav)} did not render ${HEADINGS[nav.key]}`).toContain(HEADINGS[nav.key])
    // The sign-in page's own line is the symptom of an unmatched route: the
    // catch-all redirects there. Matched on copy rather than a class, because
    // pa-field is a form wrapper the section pages use too.
    expect(html, `${hrefFor(nav)} bounced to the sign-in page`).not.toContain('Enter your credentials')
  }
})

it('the low-stock link is the kebab-case path the route uses', () => {
  // The regression in its smallest form: the href and the route must agree, and
  // the route is the kebab-case one because that is what it has always been.
  const lowStock = NAV.find((n) => n.key === 'lowStock')
  expect(lowStock.path).toBe('low-stock')
  expect(hrefFor(lowStock)).toBe('/dashboard/low-stock')
})

it('no nav href falls through to the catch-all', () => {
  // A path segment is a URL, not an identifier: a camelCase key leaked into
  // one is what made the link unmatched in the first place.
  for (const nav of NAV) {
    expect(nav.path, `${nav.key} has no route segment`).toBeTruthy()
    expect(nav.path, `${nav.key} is not kebab-case`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  }
})

it('the dashboard root lands on the first section', () => {
  const html = renderAt('/dashboard')
  expect(html).toContain(HEADINGS[NAV[0].key])
})