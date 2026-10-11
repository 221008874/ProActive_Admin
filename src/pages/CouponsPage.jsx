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
  Button, EmptyState, ErrorState, Field, IconTrash, PageTitle, Select, Skeleton, StatusPill
} from '../ui'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../ui/overlays'
import { bulkGenerate, setCouponActive, deleteCoupon, fetchCoupons } from '../services/coupons'
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

  const toggle = async (coupon, active) => {
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
                  <span role="columnheader">{t('edit')}</span>
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
                        {c.type === 'percent' ? `${c.value}%` : `${c.value} EGP`}
                        {c.minOrder > 0 && <><br /><span className="pa-subtitle">{`min ${c.minOrder}`}</span></>}
                      </span>
                      <span role="cell"><bdi>{max == null ? `${used} / ∞` : `${used} / ${max}`}</bdi></span>
                      <span role="cell" className="pa-subtitle">
                        {c.expiresAt ? whenDate(c.expiresAt, lang) : L('noExpiry', 'No expiry', 'منتهيمش')}
                      </span>
                      <span role="cell">
                        <StatusPill
                          status={!c.active ? 'neutral' : expired ? 'cancelled' : exhausted ? 'pending' : 'delivered'}
                          label={!c.active ? t('statusOff') : expired ? t('statusExpired') : exhausted ? t('statusUsedUp') : t('statusActive')}
                        />
                      </span>
                      <span role="cell" style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="pa-btn pa-btn--sm pa-btn--outline"
                          onClick={() => toggle(c, !c.active)}>
                          {c.active ? t('statusOff') : t('active')}
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
    </div>
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