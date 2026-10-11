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
const { LanguageProvider } = await import('../context/LanguageContext.jsx')
const { AdminShell } = await import('../ui/index.js')

// SignIn reads the language context (its labels and its toggle are translated),
// so it renders inside the real provider rather than a stub — that also proves
// the provider itself boots without a browser.
const renderSignIn = () =>
  renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(LanguageProvider, null, React.createElement(SignIn))
    )
  )

it('the sign-in page renders design-system markup', () => {
  const html = renderSignIn()
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
        onNavigate() {},
        labels: { signOut: 'Sign out', brand: 'Admin' }
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

it('renders in English by default and offers the Arabic toggle', () => {
  // The admin defaults to English (the storefront defaults to Arabic): this is
  // the owner's tool, and Arabic is opt-in via the toggle.
  const html = renderSignIn()
  expect(html).toContain('Sign in')
  expect(html).toContain('Enter your credentials to access the dashboard')
  expect(html).toContain('العربية') // the toggle offers the other language
})

it('renders in Arabic when the saved language is Arabic', () => {
  // Prove the Arabic dictionary resolves rather than falling back to the key,
  // which is the failure mode t(k) !== k guards against.
  const original = window.localStorage.getItem
  window.localStorage.getItem = (key) => (key === 'language' ? 'ar' : original(key))
  try {
    const html = renderSignIn()
    expect(html).toContain('تسجيل الدخول')
    expect(html).toContain('البريد الإلكتروني')
    expect(html).toContain('English') // the toggle now offers the other language
    expect(html).not.toContain('>signInTitle<')
  } finally {
    window.localStorage.getItem = original
  }
})

