// Coupons — bulk generation, the table, and the printable A4 sheet.
//
// A coupon's document id IS its code, so redemption is a getDoc rather than a
// query, and two people cannot generate the same code. That is why the
// generator asks for a count and a prefix instead of a single code: these are
// printed, cut out and handed out.
//
// Type matters. A flat amount and a percentage are different products, and
// silently treating one as the other is how a shop gives away its margin, so
// the form makes the choice explicit and the table shows it back.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button, Checkbox, EmptyState, ErrorState, Field, IconClose, IconTrash, PageTitle, Select, Skeleton, StatusPill
} from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../ui/overlays'
import { bulkGenerate, setCouponActive, updateCoupon, deleteCoupon, fetchCoupons } from '../services/coupons'
import { couponSheetPdf } from '../services/couponSheet'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function CouponsPage() {
  const { t, lang } = useLanguage()
  const toast = useToast()
  const L = label(t, lang)

  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)

  const [count, setCount] = useState(10)
  const [prefix, setPrefix] = useState('PA')
  const [type, setType] = useState('percent')
  const [value, setValue] = useState(10)
  const [minOrder, setMinOrder] = useState(0)
  const [maxUses, setMaxUses] = useState(1)
  const [expiresInDays, setExpiresInDays] = useState('')
  const [formError, setFormError] = useState('')

  // Edit dialog state
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [editType, setEditType] = useState('percent')
  const [editValue, setEditValue] = useState(10)
  const [editMinOrder, setEditMinOrder] = useState(0)
  const [editMaxUses, setEditMaxUses] = useState(1)
  const [editExpiresInDays, setEditExpiresInDays] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCoupons(await fetchCoupons())
    } catch (e) {
      console.error('Could not load coupons:', e)
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, reload])

  const generate = async () => {
    setFormError('')
    setBusy(true)
    try {
      const codes = await bulkGenerate({
        count: Number(count),
        prefix,
        type,
        value: Number(value),
        minOrder: Number(minOrder) || 0,
        maxUses: Number(maxUses) || null,
        expiresAt: expiresInDays ? new Date(Date.now() + Number(expiresInDays) * 864e5) : null
      })
      toast.show(t('couponsGenerated')?.replace('{count}', codes.length) ?? `${codes.length} codes generated`)
      setReload((n) => n + 1)
    } catch (e) {
      console.error('Could not generate coupons:', e)
      // The service validates before writing anything, so its error names the
      // field that stopped it.
      setFormError(e?.errors ? Object.values(e.errors).join(' ') : e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleCoupon = async (coupon, active) => {
    try {
      await setCouponActive(coupon.code, active)
      setReload((n) => n + 1)
    } catch (e) {
      console.error('Could not toggle coupon:', e)
      toast.show(e?.message ?? t('error'))
    }
  }

  const remove = async (coupon) => {
    if (!window.confirm(t('deleteCouponConfirm') ?? 'Delete this code?')) return
    try {
      await deleteCoupon(coupon.code)
      toast.show(L('deleted', 'Coupon deleted', 'كود الخصم اتمسح'))
      setReload((n) => n + 1)
    } catch (e) {
      console.error('Could not delete coupon:', e)
      toast.show(e?.message ?? t('error'))
    }
  }

  const openEdit = (coupon) => {
    setEditingCoupon(coupon)
    setEditType(coupon.type)
    setEditValue(coupon.value)
    setEditMinOrder(coupon.minOrder ?? 0)
    setEditMaxUses(coupon.maxUses ?? 1)
    setEditExpiresInDays(coupon.expiresAt ? Math.ceil((new Date(coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : coupon.expiresAt).getTime() - Date.now()) / 864e5) : '')
    setEditError('')
  }

  const saveEdit = async () => {
    setEditError('')
    // The dialog used to be handed saving={false} forever, so nothing stopped
    // a second click while the write was in flight - two updates, two toasts.
    if (savingEdit) return
    setSavingEdit(true)
    try {
      await updateCoupon(editingCoupon.code, {
        type: editType,
        value: Number(editValue),
        minOrder: Number(editMinOrder) || 0,
        maxUses: Number(editMaxUses) || null,
        expiresAt: editExpiresInDays ? new Date(Date.now() + Number(editExpiresInDays) * 864e5) : null
      })
      toast.show(L('couponUpdated', 'Coupon updated', 'تم تحديث الكود'))
      setEditingCoupon(null)
      setReload((n) => n + 1)
    } catch (e) {
      console.error('Could not update coupon:', e)
      setEditError(e?.errors ? Object.values(e.errors).join(' ') : e.message)
    } finally {
      setSavingEdit(false)
    }
  }

  // A4 preview: the first six, which is one sheet.
  const printable = useMemo(
    () => coupons.filter((c) => c.active && (c.usedCount ?? 0) < (c.maxUses ?? Infinity)).slice(0, 6),
    [coupons]
  )

  return (
    <div className="pa-coupons">
      <PageTitle title={t('coupons')} />

      <div className="pa-cols">
        <section className="pa-formcol">
          <div className="pa-block" style={{ border: '1px solid var(--pa-ink)' }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{t('createCoupons')}</h2>

            <div className="pa-editor__row">
              <Field id="c-count" label={t('howMany')} type="number" min="1" max="100" admin
                value={count} onChange={(e) => setCount(e.target.value)}
                hint={L('countHint', '1–100 codes', 'من ١ لـ ١٠٠ كود')} />
              <Field id="c-prefix" label={t('prefix')} admin value={prefix}
                onChange={(e) => setPrefix(e.target.value)} />
            </div>

            <div className="pa-editor__row">
              <Select id="c-type" label={t('type')} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="percent">{t('typePercent')}</option>
                <option value="fixed">{t('typeFixed')}</option>
              </Select>
              <Field id="c-value" label={type === 'percent' ? `${t('value')} %` : t('value')}
                type="number" min="1" admin value={value}
                onChange={(e) => setValue(e.target.value)} />
            </div>

            <div className="pa-editor__row">
              <Field id="c-min" label={t('minimumOrder')} type="number" min="0" admin
                value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
              <Field id="c-max" label={t('usesPerCode')} type="number" min="1" admin
                value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>

            <Field id="c-exp" label={`${t('expires')} (${t('optional')})`} type="number" min="1" admin
              value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)}
              hint={L('expiresHint', 'Days from now. Blank means no expiry.', 'أيام من دلوقتي. فاضي يعني منتهيمش.')} />

            {formError && <div className="pa-error" role="alert">{formError}</div>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={generate} disabled={busy}>
                {busy ? L('generating', 'Generating…', 'جاري الإنشاء…')
                  : (t('generateCodes') ?? 'Generate').replace('{count}', count)}
              </Button>
              <Button variant="outline" onClick={() => couponSheetPdf(printable, lang)} disabled={printable.length === 0}>
                {t('exportA4Sheet')}
              </Button>
            </div>
          </div>

          {/* One A4 sheet as six tiles, each with its QR. What the owner will
              actually hand out, visible before it is printed. */}
          <div className="pa-block">
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('a4Preview')}</h3>
            {printable.length === 0
              ? <span className="pa-subtitle">{L('noCodes', 'Generate some codes to preview them here.', 'ولّد أكواد عشان تشوفها هنا.')}</span>
              : (
                <>
                  <div className="pa-sheetpreview">
                    {printable.map((c) => (
                      <div key={c.code} className="pa-coupontile">
                        <span className="pa-subtitle" style={{ fontSize: 10 }}>{t('couponCode')}</span>
                        <b className="pa-coupontile__code">{c.code}</b>
                        <span className="pa-coupontile__off">
                          {c.type === 'percent' ? `${c.value}% ${t('off').toLowerCase()}` : `${c.value} EGP ${t('off').toLowerCase()}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="pa-subtitle" style={{ marginTop: 8 }}>
                    {t('qrEncodes')}{' '}
                    <bdi className="pa-ltr">{`${window.location.origin}/coupon/${printable[0].code}`}</bdi>
                  </p>
                </>
              )}
          </div>
        </section>

        <section className="pa-listcol">
          {loading && <CouponsSkeleton />}

          {!loading && error && (
            <ErrorState title={t('error')} onRetry={() => setReload((n) => n + 1)} retryLabel={t('retry')} />
          )}

          {!loading && !error && coupons.length === 0 && (
            <EmptyState title={L('noCoupons', 'No coupons yet', 'مفيش أكواد لسه')}
              body={L('noCouponsBody', 'Generate a batch above.', 'ولّد دفعة من فوق.')} />
          )}

          {!loading && !error && coupons.length > 0 && (
            <div className="pa-tablebox">
              <div className="pa-table pa-table--coupons" role="table" aria-label={t('coupons')}>
                <div className="pa-tr pa-tr--head" role="row">
                  <span role="columnheader">{t('couponCode')}</span>
                  <span role="columnheader">{t('off')}</span>
                  <span role="columnheader">{t('usedCount')}</span>
                  <span role="columnheader">{t('expiresAt')}</span>
                  <span role="columnheader">{t('status')}</span>
                  <span role="columnheader">{t('actions')}</span>
                </div>
                {coupons.map((c) => {
                  const used = Number(c.usedCount ?? 0)
                  const max = c.maxUses == null ? null : Number(c.maxUses)
                  const exhausted = max != null && used >= max
                  const expired = c.expiresAt ? new Date(c.expiresAt.toDate?.() ?? c.expiresAt) < new Date() : false

                  return (
                    <div key={c.code} className="pa-tr" role="row">
                      <span role="cell"><b className="pa-ltr">{c.code}</b></span>
                      <span role="cell">
                        {formatDiscount(c, lang)}
                        {formatCondition(c, lang) && (
                          <><br /><span className="pa-subtitle">{formatCondition(c, lang)}</span></>
                        )}
                      </span>
                      <span role="cell"><bdi>{max == null ? `${used} / ∞` : `${used} / ${max}`}</bdi></span>
                      <span role="cell" className="pa-subtitle">
                        {c.expiresAt ? whenDate(c.expiresAt, lang) : L('noExpiry', 'No expiry', 'منتهيمش')}
                      </span>
                      <span role="cell">
                        {/* A coupon that ran out of uses or expired looks exactly
                            like a healthy one behind a bare toggle: the owner
                            sees "active" while the checkout refuses it. The
                            dictionary already had the words for both. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="pa-subtitle">
                            {expired
                              ? t('statusExpired')
                              : exhausted
                                ? t('statusUsedUp')
                                : c.active
                                  ? t('statusActive')
                                  : t('statusOff')}
                          </span>
                          <Toggle
                            on={c.active}
                            onChange={(on) => toggleCoupon(c, on)}
                            label={c.active ? t('statusActive') : t('statusOff')}
                          />
                        </div>
                      </span>
                      <span role="cell" style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="pa-btn pa-btn--sm pa-btn--outline"
                          onClick={() => openEdit(c)}>
                          {t('edit')}
                        </button>
                        <button type="button" className="pa-btn pa-btn--sm pa-btn--outline"
                          aria-label={`${t('delete')} ${c.code}`} onClick={() => remove(c)}>
                          <IconTrash width={16} height={16} />
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>
      {editingCoupon && (
        <CouponEditDialog
          coupon={editingCoupon}
          t={t}
          L={L}
          onClose={() => setEditingCoupon(null)}
          onSave={saveEdit}
saving={savingEdit}
          editType={editType}
          editValue={editValue}
          editMinOrder={editMinOrder}
          editMaxUses={editMaxUses}
          editExpiresInDays={editExpiresInDays}
          editError={editError}
          setEditType={setEditType}
          setEditValue={setEditValue}
          setEditMinOrder={setEditMinOrder}
          setEditMaxUses={setEditMaxUses}
          setEditExpiresInDays={setEditExpiresInDays}
        />
      )}
    </div>
  )
}

function CouponEditDialog({ coupon, t, L, onClose, onSave, saving, editType, editValue, editMinOrder, editMaxUses, editExpiresInDays, editError, setEditType, setEditValue, setEditMinOrder, setEditMaxUses, setEditExpiresInDays }) {
  const valueLabel = editType === 'percent' ? `${t('value')} %` : t('value')
  return (
    <>
      <div className="pa-sheet-backdrop" onClick={onClose} />
      <aside className="pa-editor" role="dialog" aria-modal="true" aria-label={t('editCoupon')}>
        <header className="pa-editor__head">
          <h2>{t('editCoupon')}</h2>
          <button type="button" className="pa-icon-btn" style={{ width: 44, height: 44 }}
            aria-label={L('close', 'Close', 'إغلاق')} onClick={onClose}>
            <IconClose width={22} height={22} />
          </button>
        </header>
        <div className="pa-editor__body">
          <div className="pa-editor__row">
            <Field id="ec-code" label={t('couponCode')} admin className="pa-ltr" value={coupon.code} readOnly />
          </div>
          <div className="pa-editor__row">
            <Select id="ec-type" label={t('type')} value={editType} onChange={(e) => setEditType(e.target.value)}>
              <option value="percent">{t('typePercent')}</option>
              <option value="fixed">{t('typeFixed')}</option>
            </Select>
            <Field id="ec-value" label={valueLabel}
              type="number" min="1" admin value={editValue} onChange={(e) => setEditValue(e.target.value)} />
          </div>
          <div className="pa-editor__row">
            <Field id="ec-min" label={t('minimumOrder')} type="number" min="0" admin
              value={editMinOrder} onChange={(e) => setEditMinOrder(e.target.value)} />
            <Field id="ec-max" label={t('usesPerCode')} type="number" min="1" admin
              value={editMaxUses} onChange={(e) => setEditMaxUses(e.target.value)} />
          </div>
          <Field id="ec-exp" label={`${t('expires')} (${t('optional')})`} type="number" min="1" admin
            value={editExpiresInDays} onChange={(e) => setEditExpiresInDays(e.target.value)}
            hint={L('expiresHint', 'Days from now. Blank means no expiry.', 'أيام من دلوقتي. فاضي يعني منتهيمش.')} />
          {editError && <div className="pa-error" role="alert">{editError}</div>}
        </div>
        <footer className="pa-editor__foot">
          <Button variant="outline" onClick={onClose}>{L('cancel', 'Cancel', 'إلغاء')}</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? L('saving', 'Saving…', 'جاري الحفظ…') : t('save')}</Button>
        </footer>
      </aside>
    </>
  )
}

function CouponsSkeleton() {
  return (
    <div className="pa-tablebox" aria-hidden="true">
      <div className="pa-table">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="pa-tr" key={i}>
            <Skeleton variant="line" width="80%" />
            <Skeleton variant="line" width="50%" />
            <Skeleton variant="line" width="40%" />
            <Skeleton variant="line" width="60%" />
            <Skeleton variant="line" width="60%" />
            <Skeleton variant="line" width="50%" />
          </div>
        ))}
      </div>
    </div>
  )
}

function whenDate(ts, lang) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

/** Format discount for display: "10%" or "10 ج.م" / "10 EGP" */
function formatDiscount(coupon, lang) {
  if (coupon.type === 'percent') {
    return `${coupon.value}%`
  }
  return lang === 'ar' ? `${coupon.value} ج.م` : `${coupon.value} EGP`
}

/** Format condition for display: "الحد الأدنى 5 ج.م" / "Min 5 EGP" */
function formatCondition(coupon, lang) {
  if (coupon.minOrder > 0) {
    return lang === 'ar' ? `الحد الأدنى ${coupon.minOrder} ج.م` : `Min ${coupon.minOrder} EGP`
  }
  return ''
}