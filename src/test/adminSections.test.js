import { it, expect, vi } from "vitest"

// Render smoke test for every admin section page.
//
// These pages are the ones that broke silently: a missing design-system export
// or a bad hook order does not fail the build, it produces a blank screen for
// the owner. renderToString exercises the first render of each page, which is
// the loading state, and catches exactly that class of error. Effects do not
// run, so no Firestore read happens and no data is needed.

if (typeof window === "undefined") {
  const mkEl = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} })
  const doc = {
    documentElement: { dataset: {}, style: {}, setAttribute() {}, lang: "", dir: "" },
    body: { style: {}, appendChild() {}, className: "" },
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
    location: { hash: "" },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  }
  globalThis.document = doc
  globalThis.localStorage = window.localStorage
}
if (typeof requestAnimationFrame === "undefined") globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
if (typeof globalThis.atob === "undefined") globalThis.atob = () => ""
if (typeof globalThis.btoa === "undefined") globalThis.btoa = () => ""

vi.mock("jspdf", () => ({ jsPDF: class {} }))
vi.mock("html2canvas", () => ({ default: () => Promise.resolve({}) }))
vi.mock("qrcode", () => ({ default: { toDataURL: () => Promise.resolve("") } }))
vi.mock("../services/firebase.js", () => ({ db: {}, auth: {} }))

const { MemoryRouter } = await import("react-router-dom")
const React = (await import("react")).default
const { renderToString } = await import("react-dom/server")
const { LanguageProvider } = await import("../context/LanguageContext.jsx")

const render = (Page) =>
  renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/dashboard"] },
      React.createElement(LanguageProvider, null, React.createElement(Page))
    )
  )

const SECTIONS = [
  ["OverviewPage", "../pages/OverviewPage.jsx"],
  ["ProductsPage", "../pages/ProductsPage.jsx"],
  ["OrdersPage", "../pages/OrdersPage.jsx"],
  ["BillsPage", "../pages/BillsPage.jsx"],
  ["CategoriesPage", "../pages/CategoriesPage.jsx"],
  ["CouponsPage", "../pages/CouponsPage.jsx"],
  ["OperationsPage", "../pages/OperationsPage.jsx"],
  ["LowStockPage", "../pages/LowStockPage.jsx"]
]

const modules = {}
for (const [name, path] of SECTIONS) modules[name] = (await import(path)).default

it("every admin section page renders design-system markup", () => {
  for (const [name] of SECTIONS) {
    const html = render(modules[name])
    const pa = (html.match(/class="[^"]*pa-/g) || []).length
    console.log(`${name}: ${html.length} bytes, ${pa} .pa-* nodes`)
    expect(pa, `${name} rendered no design-system markup`).toBeGreaterThan(0)
    // A rendered key means the dictionary is missing that entry.
    expect(html, `${name} leaked a translation key`).not.toMatch(/>([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)</)
  }
})

it("the section pages resolve their English titles, not their keys", () => {
  // t() returns the key itself when a string is missing, which reads as
  // English prose to nobody; each page must resolve its own heading.
  const titles = {
    OverviewPage: "Overview",
    OrdersPage: "Orders",
    LowStockPage: "Low stock",
    CouponsPage: "Coupons",
    CategoriesPage: "Categories &amp; collections" // rendered HTML escapes the ampersand
  }
  for (const [name, expected] of Object.entries(titles)) {
    expect(render(modules[name]), name).toContain(expected)
  }
})