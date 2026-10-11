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
  Button, ErrorState, Field, PageTitle, Skeleton
} from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../ui/overlays'
import { rebuildCatalog } from '../services/catalog'
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
  const [publishing, setPublishing] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Store settings form state
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  const publishCatalog = async () => {
    setPublishing(true)
    try {
      const result = await rebuildCatalog()
      toast.show(L('published', `Catalogue published (v${result.version}, ${result.productCount} products)`,
        `الكتالوج اتنشر (نسخة ${result.version}، ${result.productCount} منتج)`))
    } catch (e) {
      console.error('Could not rebuild the catalogue:', e)
      toast.show(e?.code === 'STORE_API_NOT_CONFIGURED'
        ? L('apiNotConfigured', 'The store API URL is not configured.', 'رابط متجر الـ API مش مضبوط.')
        : e?.message ?? t('error'))
    } finally {
      setPublishing(false)
    }
  }


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
      // Initialize form fields from loaded settings
      setFreeShippingThreshold(general.freeShippingThreshold ?? 800)
      setWhatsapp(general.whatsapp ?? '')
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

  const saveStoreSettings = async () => {
    setSavingSettings(true)
    try {
      await saveGeneral({
        freeShippingThreshold: Number(freeShippingThreshold),
        whatsapp: whatsapp
      })
      toast.show(t('saved'))
    } catch (e) {
      console.error('Could not save store settings:', e)
    } finally {
      setSavingSettings(false)
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
          {/* Publishing is on demand, not only on the 04:00 schedule: after
              editing a product the shop keeps serving the old snapshot until
              something rebuilds it, and a wrong price reaching a customer is
              not something to discover the next morning. */}
          <section className="pa-block" style={{ border: '1px solid var(--pa-ink)', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: 18 }}>{t('catalogue')}</h2>
                <p className="pa-subtitle" style={{ maxWidth: 560 }}>
                  {L('catalogueExplain',
                    'The shop reads a pre-built catalogue. Rebuild it after adding or editing a product so the storefront shows the change immediately.',
                    'المتجر بيقرأ نسخة جاهزة من الكتالوج. اعمل تحديث بعد إضافة أو تعديل منتج عشان المتجر يظهر التغيير فوراً.')}
                </p>
              </div>
              <Button onClick={publishCatalog} disabled={publishing}>
                {publishing ? t('publishing') : t('publishChanges')}
              </Button>
            </div>
          </section>

          <section className="pa-block" style={{ border: '1px solid var(--pa-ink)' }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>{t('storeSettings')}</h2>
            <div className="pa-editor__row">
              <Field
                id="fs-threshold"
                label={t('freeShippingFrom')}
                type="number"
                min="0"
                step="1"
                value={freeShippingThreshold}
                onChange={(e) => setFreeShippingThreshold(e.target.value)}
                suffix="ج.م"
              />
              <Field
                id="whatsapp-number"
                label={t('whatsappNumber')}
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                inputMode="tel"
                dir="ltr"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onClick={saveStoreSettings} disabled={savingSettings}>
                {savingSettings ? L('saving', 'Saving…', 'جاري الحفظ…') : t('saveSettings')}
              </Button>
            </div>
            <p className="pa-subtitle" style={{ marginTop: 8 }}>
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