import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Every component a page renders must actually be bound in that file.
//
// Three separate pages shipped a JSX tag whose component was never imported or
// defined: `IconWhatsApp` and `BottomSheet` in the store's ProductDetail, and
// `SettingCell` in the admin's OperationsPage. A JSX tag that resolves to no
// binding is a free identifier - it stays in the emitted bundle as a global
// reference - so neither the bundler nor `renderToString` (which never reaches
// these branches) nor ESLint without react/jsx-no-undef complains. The page
// renders fine until the branch is taken, then throws ReferenceError.
//
// This is the check that would have caught all three.

const ADMIN_FILES = [
  '../pages/OperationsPage.jsx',
  '../pages/OverviewPage.jsx',
  '../pages/ProductsPage.jsx',
  '../pages/ProductEditor.jsx',
  '../pages/OrdersPage.jsx',
  '../pages/BillsPage.jsx',
  '../pages/CategoriesPage.jsx',
  '../pages/CouponsPage.jsx',
  '../pages/LowStockPage.jsx',
  '../pages/SignIn.jsx',
  '../pages/AdminShell.jsx',
  '../ui/overlays.jsx'
]

/** Capitalised JSX tags, i.e. components - lowercase ones are host elements. */
function componentsUsedIn(source) {
  const names = new Set()
  for (const match of source.matchAll(/<\/?([A-Z][A-Za-z0-9_]*)/g)) names.add(match[1])
  return names
}

/** Multi-line-safe: pull every `import ... from '...'` block out of the source. */
function importBlocks(source) {
  return [...source.matchAll(/import[\s\S]*?from\s*['"][^'"]+['"]/g)].map((m) => m[0])
}

function isBound(source, name, imports) {
  const word = new RegExp(`\\b${name}\\b`)
  if (imports.some((block) => word.test(block))) return true
  // Locally declared: function Foo(){}, const Foo = , class Foo
  if (new RegExp(`function\\s+${name}\\b`).test(source)) return true
  if (new RegExp(`(?:const|let|var|class)\\s+${name}\\b`).test(source)) return true
  return false
}

describe('every rendered component is bound', () => {
  for (const file of ADMIN_FILES) {
    it(`${file.split('/').pop()} renders no unbound component`, () => {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      const imports = importBlocks(source)
      const unbound = [...componentsUsedIn(source)].filter((name) => !isBound(source, name, imports))
      expect(unbound, `${file} renders unbound component(s): ${unbound.join(', ')}`).toEqual([])
    })
  }
})

describe('the toast stack is mounted', () => {
  it('main.jsx renders ToastProvider above the app', () => {
    // useToast() returns a no-op stub without a provider, so an unmounted
    // ToastProvider silently swallows EVERY confirmation in the panel.
    const main = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8')
    expect(main).toContain('ToastProvider')
    expect(main).toMatch(/<ToastProvider>[\s\S]*<App \/>/)
  })

  it('overlays.jsx still exports it', () => {
    const overlays = readFileSync(new URL('../ui/overlays.jsx', import.meta.url), 'utf8')
    expect(overlays).toMatch(/export function ToastProvider/)
  })
})

describe('router links navigate', () => {
  it('Overview quick actions use `to`, not `href`, on a Link', () => {
    // Button spreads every extra prop onto whatever tag it renders, so
    // `as={Link} href=...` put an href on a Link - which ignores it.
    const raw = readFileSync(new URL('../pages/OverviewPage.jsx', import.meta.url), 'utf8')
    // Strip comments first: the prose about this very bug mentions the pattern.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const bad = src.match(/as=\{Link\}[^>]*\bhref=/g)
    expect(bad, 'a React Router Link must be given `to`, not `href`').toBeNull()
  })
})

describe('no label is built by interpolation', () => {
  // `t(`status_${s}`)` reads as if it were a key; it is not one, and t()
  // returns the template's own text on a miss. Every order status pill, tab,
  // history row and action button was rendering `status_pending` on screen.
  for (const file of ['../pages/OrdersPage.jsx', '../pages/OverviewPage.jsx']) {
    it(`${file.split('/').pop()} interpolates no dictionary keys`, () => {
      const raw = readFileSync(new URL(file, import.meta.url), 'utf8')
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const built = src.match(/\bt\(\s*`[^`]*\$\{/g) ?? []
      expect(built, `${file} builds dictionary keys by interpolation: ${built.join(', ')}`).toEqual([])
    })
  }

  it('every order status and action has a real key in both dictionaries', async () => {
    const labels = readFileSync(new URL('../services/orderLabels.js', import.meta.url), 'utf8')
    const { ar, en } = await import('../i18n/strings.js')
    const pairs = [
      [/STATUS_KEY = \{([\s\S]*?)\}/, 'STATUS_KEY'],
      [/ACTION_KEY = \{([\s\S]*?)\}/, 'ACTION_KEY']
    ]
    for (const [re, name] of pairs) {
      const block = labels.match(re)
      expect(block, `${name} not found`).not.toBeNull()
      for (const m of block[1].matchAll(/([A-Za-z_]\w*):\s*'([A-Za-z_]\w*)'/g)) {
        // m[1] is the state name, m[2] is the dictionary key it maps to.
        expect(ar, `missing Arabic: ${name}.${m[2]}`).toHaveProperty(m[2])
        expect(en, `missing English: ${name}.${m[2]}`).toHaveProperty(m[2])
      }
    }
  })

  it('every status the FLOW can produce has a label', async () => {
    const orders = readFileSync(new URL('../pages/OrdersPage.jsx', import.meta.url), 'utf8')
    const labels = readFileSync(new URL('../services/orderLabels.js', import.meta.url), 'utf8')
    const { ar, en } = await import('../i18n/strings.js')
    const flow = orders.match(/const FLOW = \{([\s\S]*?)\n\}/)
    expect(flow, 'FLOW not found').not.toBeNull()
    for (const m of flow[1].matchAll(/([A-Za-z_]\w*):/g)) {
      const status = m[1]
      const key = labels.match(new RegExp(`\\b${status}:\\s*'([A-Za-z_]\\w*)'`))
      expect(key, `status "${status}" has no dictionary key`).not.toBeNull()
      expect(ar).toHaveProperty(key[1])
      expect(en).toHaveProperty(key[1])
    }
  })
})