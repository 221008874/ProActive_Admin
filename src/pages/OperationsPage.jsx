// Operations — the two settings that change what a shopper pays.
//
// Free shipping threshold and the WhatsApp number in one card; the 27
// governorates below, each with its shipping cost, its own minimum order and
// an on/off switch.
//
// Everything saves on blur, not on a form submit: the owner edits one cell,
// tabs to the next, and the value is already stored. A "Saved" tick confirms
// it and then fades, so a save that fails is noticed.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button, ErrorState, PageTitle, Skeleton
} from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../ui/overlays'
import { loc } from '../ui'
import {
  fetchGovernorates, saveGovernorate, ensureGovernorates,
  fetchSettings, saveSettings
} from '../services/settings'
import { EGYPT_GOVERNORATES } from '../config/egypt'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

/** A cell that saves itself on blur and says so. */
function SettingCell({ value, onSave, type = 'number', min = 0, suffix, ariaLabel, disabled, savedLabel = 'Saved' }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const timer = useRef(null)

  // An external change (a reload, another row) should update the field, but
  // not one the owner is part way through typing into. Adjusting during render
  // keeps this out of the cascading-render trap.
  const incoming = value == null ? '' : String(value)
  if (!dirty && draft !== incoming) {
    setDraft(incoming)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  const commit = async () => {
    if (disabled) return
    const parsed = type === 'number' ? Number(draft) : draft
    if (type === 'number' && !Number.isFinite(parsed)) { setDraft(incoming); setDirty(false); return }
    if (String(parsed) === String(value ?? '')) { setDirty(false); return }

    try {
      await onSave(parsed)
      setDirty(false)
      setSaved(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setSaved(false), 1600)
    } catch (e) {
      console.error('Could not save setting:', e)
      setDraft(incoming)
      setDirty(false)
    }
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        className="pa-input pa-input--admin pa-cell-input"
        type={type}
        min={type === 'number' ? min : undefined}
        step={type === 'number' ? 'any' : undefined}
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => { setDraft(e.target.value); setDirty(true) }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      {suffix && <span className="pa-subtitle">{suffix}</span>}
      <span className="pa-savedtick" data-on={saved} aria-live="polite">
        {saved ? savedLabel : ''}
      </span>
    </span>
  )
}

export default function OperationsPage() {
  const { t, lang } = useLanguage()
  const toast = useToast()
  const L = label(t, lang)
  // Passed to each cell so the confirmation follows the language toggle.
  const savedLabel = t('saved')

  const [govs, setGovs] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)


  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // A project that never seeded its governorates gets them now, rather
      // than an empty table the owner has to fill in one row at a time.
      await ensureGovernorates(EGYPT_GOVERNORATES).catch((e) => console.warn('seed skipped:', e))
      const [list, general] = await Promise.all([fetchGovernorates(), fetchSettings()])
      setGovs(list)
      setSettings(general)
    } catch (e) {
      console.error('Could not load operations settings:', e)
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, reload])

  const saveGeneral = async (patch) => {
    try {
      const next = await saveSettings(patch)
      setSettings(next)
      toast.show(t('saved'))
    } catch (e) {
      console.error('Could not save settings:', e)
      toast.show(e?.message ?? t('error'))
      throw e
    }
  }

  const saveGov = async (id, patch) => {
    try {
      const next = await saveGovernorate(id, patch)
      setGovs((prev) => prev.map((g) => (g.id === id ? { ...g, ...next } : g)))
    } catch (e) {
      console.error('Could not save governorate:', e)
      toast.show(e?.message ?? t('error'))
      throw e
    }
  }

  const activeCount = useMemo(() => govs.filter((g) => g.active !== false).length, [govs])

  return (
    <div className="pa-operations">
      <PageTitle
        title={t('operations')}
        subtitle={L('governorateSummary', '{n} of {total} active', '{n} من {total} مُفعّلة')
          .replace('{n}', activeCount)
          .replace('{total}', govs.length || 27)}
      />

      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton variant="line" height={80} />
        <Skeleton count={6} />
      </div>}

      {!loading && error && (
        <ErrorState title={t('error')} onRetry={() => setReload((n) => n + 1)} retryLabel={t('retry')} />
      )}

      {!loading && !error && settings && (
        <>
          <section className="pa-block" style={{ border: '1px solid var(--pa-ink)' }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>{t('storeSettings')}</h2>
            <div className="pa-editor__row">
              <SettingCell
                value={settings.freeShippingThreshold}
                onSave={(v) => saveGeneral({ freeShippingThreshold: v })}
                suffix="EGP"
                ariaLabel={t('freeShippingFrom')}
                savedLabel={savedLabel}
              />
              <SettingCell
                type="text"
                value={settings.whatsapp ?? ''}
                onSave={(v) => saveGeneral({ whatsapp: v })}
                ariaLabel={t('whatsappNumber')}
                savedLabel={savedLabel}
              />
            </div>
            <p className="pa-subtitle" style={{ marginTop: 4 }}>
              {L('settingsLabels', 'Free shipping threshold, and the WhatsApp number shown to customers.',
                'حد الشحن المجاني، ورقم الواتساب اللي بيظهر للعملاء.')}
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, margin: '24px 0 10px' }}>{t('governorates')}</h2>
            <div className="pa-tablebox">
              <div className="pa-table pa-table--govs" role="table" aria-label={t('governorates')}>
                <div className="pa-tr pa-tr--head" role="row">
                  <span role="columnheader">{t('governorateName')}</span>
                  <span role="columnheader">{t('shippingCost')}</span>
                  <span role="columnheader">{t('minOrder')}</span>
                  <span role="columnheader">{t('active')}</span>
                </div>
                {govs.map((g) => (
                  <div key={g.id} className="pa-tr" role="row">
                    <span role="cell">
                      {loc(g.name, lang)}
                      <br />
                      <span className="pa-subtitle pa-ltr">{g.id}</span>
                    </span>
                    <span role="cell">
                      <SettingCell
                        value={g.cost}
                        onSave={(v) => saveGov(g.id, { cost: v })}
                        ariaLabel={`${t('shippingCost')} ${loc(g.name, lang)}`}
                        savedLabel={savedLabel}
                      />
                    </span>
                    <span role="cell">
                      <SettingCell
                        value={g.minOrder ?? 0}
                        onSave={(v) => saveGov(g.id, { minOrder: v })}
                        ariaLabel={`${t('minOrder')} ${loc(g.name, lang)}`}
                        savedLabel={savedLabel}
                      />
                    </span>
                    <span role="cell">
                      <Toggle
                        on={g.active !== false}
                        onChange={(on) => saveGov(g.id, { active: on })}
                        label={`${t('active')} ${loc(g.name, lang)}`}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/** A switch that reads as a switch but is a real checkbox underneath. */
function Toggle({ on, onChange, label }) {
  return (
    <label className="pa-switch">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="pa-switch__track" aria-hidden="true"><span className="pa-switch__thumb" /></span>
    </label>
  )
}