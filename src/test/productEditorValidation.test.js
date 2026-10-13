import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// The editor renders service-level validation errors behind a per-field gate.
// Two defects made "Invalid product" invisible: the gate consulted `saving`,
// which React had already reset to false by the time the errors rendered, and
// the `variants` error had no renderer at all. The repo has no DOM test env, so
// these assert on the source, the same way the storefront's renderSmoke suite
// guards its chrome copy.
const source = readFileSync(new URL('../pages/ProductEditor.jsx', import.meta.url), 'utf8')

describe('product editor validation visibility', () => {
  it('every touched-field gate also survives a failed submit', () => {
    // A gate of the form `touched.x || saving` re-evaluates as false once the
    // save settles, so an error on a field the owner never touched is dropped.
    const bare = [...source.matchAll(/touched\.\w+\s*\|\|\s*saving(?!\s*\|\|)/g)]
    expect(bare).toHaveLength(0)
  })

  it('sets submitted when the form is submitted', () => {
    expect(source).toMatch(/setSubmitted\(true\)/)
  })

  it('renders the variants error, which previously had no on-screen home', () => {
    expect(source).toContain('activeErrors.variants')
  })

  it('derives the error list live, not from the last rejected save', () => {
    // The summary used to be a verbatim copy of the service's errors, so a
    // field the owner had already fixed stayed listed and there was no way to
    // tell whether saving again would work. It is now recomputed from the
    // current form state.
    expect(source).toContain('validateEditorForm')
    expect(source).toMatch(/liveErrors/)
    expect(source).toMatch(/activeErrors/)
  })

  it('drops a service error on any field the live pass decides', () => {
    // The merge must know which keys the live pass has an opinion about —
    // including the ones it currently considers fine — so a stale "add at
    // least one colour" cannot outlive the colour chip that fixed it.
    expect(source).toMatch(/LIVE_KEYS/)
    expect(source).toMatch(/for \(const \[key, message\] of Object\.entries\(formErrors\)\)/)
  })
})