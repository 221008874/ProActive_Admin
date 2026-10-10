import { it, expect, vi } from 'vitest'

// Runtime smoke test for the admin. Renders the sign-in page (the only admin
// route reachable without a session) and asserts the design-system shell
// produces its own markup. jspdf / html2canvas / qrcode are mocked: they are
// heavy native-ish deps and are not what this test is about.

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
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1280, innerHeight: 800,
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

const { MemoryRouter } = await import('react-router-dom')
const React = (await import('react')).default
const { renderToString } = await import('react-dom/server')
const { default: SignIn } = await import('../pages/SignIn.jsx')
const { AdminShell } = await import('../ui/index.js')

it('the sign-in page renders design-system markup', () => {
  const html = renderToString(
    React.createElement(MemoryRouter, { initialEntries: ['/login'] }, React.createElement(SignIn))
  )
  const pa = (html.match(/class="[^"]*pa-/g) || []).length
  console.log(`sign-in: ${html.length} bytes, ${pa} .pa-* nodes`)
  expect(pa).toBeGreaterThan(0)
  expect(html).toContain('pa-logo')
  expect(html).toContain('pa-field')
  expect(html).toContain('pa-btn')
})

it('the admin shell renders its sidebar, nav, email and sign-out', () => {
  const shell = renderToString(
    React.createElement(
      AdminShell,
      {
        items: [
          { key: 'products', label: 'Products', href: '#products', badge: 3, badgeTone: 'low' },
          { key: 'orders', label: 'Orders', href: '#orders' }
        ],
        active: 'products',
        email: 'admin@example.com',
        onSignOut() {},
        onNavigate() {}
      },
      React.createElement('div', { className: 'pa-content' }, 'body')
    )
  )
  expect(shell).toContain('pa-side')
  expect(shell).toContain('PROACTIVE')
  expect(shell).toContain('Products')
  expect(shell).toContain('admin@example.com')
  expect(shell).toContain('Sign out')
  expect(shell).toContain('pa-count')
  expect(shell).toContain('aria-current="page"')
})

