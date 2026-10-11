// src/components/BillsPanel.jsx
//
// The bills tab: every order's generated tax invoice, listed from the
// orders_egp/*/order_documents index. The bytes live in a private GitHub
// repository behind the store's admin-authenticated download endpoint, so
// viewing is a storeApi call (bearer token) and a base64 -> Blob handoff,
// never a public URL: a bill carries the customer's name, phone and address.
//
// Rows whose archival failed (status: "failed" - the checkout still
// succeeded) offer a regenerate action that re-runs the store pipeline.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collectionGroup, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../services/firebase'
import { storeApi } from '../services/storeApi'
import { useLanguage } from '../context/LanguageContext'
import { StatusPill } from '../ui'

const PAGE_SIZE = 50

const ERROR_MESSAGE_KEY = {
  BILLS_DOWNLOAD_FAILED: 'billsDownloadFailed',
  BILLS_RETRY_FAILED: 'billsRetryFailed',
  STORE_API_NOT_CONFIGURED: 'billsStoreMissing'
}

function whenMs(value) {
  if (!value) return null
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function formatWhen(value) {
  const ms = whenMs(value)
  if (!ms) return '—'
  return new Date(ms).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1)} KB`
}

// Base64 (what the store endpoint returns) -> Blob -> object URL.
function base64ToBlob(content, mimeType) {
  const binary = atob(content)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

async function fetchBill(document) {
  const path = encodeURIComponent(document.repositoryPath)
  const data = await storeApi.getJson(`/admin/documents/download?path=${path}`)
  return base64ToBlob(data.content, data.mimeType || document.mimeType)
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'bill.pdf'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function BillsPanel() {
  const { t } = useLanguage()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // One collection-group query over every order's document index; the
      // parent path (ref.parent.parent.id) is the order the bill belongs to.
      const q = query(collectionGroup(db, 'order_documents'), orderBy('uploadedAt', 'desc'), limit(PAGE_SIZE))
      const snapshot = await getDocs(q)
      setBills(
        snapshot.docs.map((d) => ({
          id: d.id,
          docType: d.id,
          orderId: d.ref?.parent?.parent?.id ?? null,
          ...d.data()
        }))
      )
    } catch (err) {
      console.error('Error loading bills:', err)
      setError('error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bills
    return bills.filter(
      (b) =>
        String(b.orderNumber ?? '').toLowerCase().includes(q) ||
        String(b.customerName ?? '').toLowerCase().includes(q) ||
        String(b.orderId ?? '').toLowerCase().includes(q)
    )
  }, [bills, search])

  const view = async (doc) => {
    if (!storeApi.isConfigured()) {
      setError('STORE_API_NOT_CONFIGURED')
      return
    }
    setBusyId(doc.id)
    setError(null)
    try {
      const blob = await fetchBill(doc)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      // The new tab needs the URL alive while it loads; revoke long after.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      console.error('Error viewing bill:', err)
      setError('BILLS_DOWNLOAD_FAILED')
    } finally {
      setBusyId(null)
    }
  }

  const download = async (doc) => {
    if (!storeApi.isConfigured()) {
      setError('STORE_API_NOT_CONFIGURED')
      return
    }
    setBusyId(doc.id)
    setError(null)
    try {
      const blob = await fetchBill(doc)
      saveBlob(blob, `ProActive_Invoice_${doc.orderNumber ?? doc.orderId ?? 'bill'}.pdf`)
    } catch (err) {
      console.error('Error downloading bill:', err)
      setError('BILLS_DOWNLOAD_FAILED')
    } finally {
      setBusyId(null)
    }
  }

  const retry = async (doc) => {
    setBusyId(doc.id)
    setError(null)
    try {
      await storeApi.postJson('/admin/order/document/retry', {
        orderId: doc.orderId,
        docType: doc.docType || 'invoice'
      })
      await load()
    } catch (err) {
      console.error('Error regenerating bill:', err)
      setError('BILLS_RETRY_FAILED')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="pa-tablebox">
        <div className="pa-pdp__label">
          {t('billsTitle')} <span className="pa-count">{visible.length}</span>
        </div>
        <div className="pa-subtitle" style={{ marginBottom: 10 }}>
          {t('billsSubtitle')}
        </div>

        <input
          className="pa-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
        />

        {error && (
          <div className="pa-callout" style={{ marginTop: 12 }} role="alert">
            <b>{t(ERROR_MESSAGE_KEY[error] ?? 'error')}</b>
          </div>
        )}

        {loading ? (
          <div className="pa-subtitle" style={{ marginTop: 12 }}>
            {t('billsLoading')}
          </div>
        ) : visible.length === 0 ? (
          <div className="pa-callout" style={{ marginTop: 12 }}>
            <b>{t('billsNone')}</b>
          </div>
        ) : (
          <table className="pa-table" style={{ marginTop: 12 }}>
            <thead>
              <tr className="pa-tr pa-tr--head">
                <th>{t('billsColOrder')}</th>
                <th>{t('billsColCustomer')}</th>
                <th>{t('billsColDate')}</th>
                <th>{t('billsColSize')}</th>
                <th>{t('billsColStatus')}</th>
                <th>{t('billsColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((doc) => {
                const failed = doc.status !== 'ready'
                const busy = busyId === doc.id
                return (
                  <tr key={`${doc.orderId}-${doc.id}`} className="pa-tr">
                    <td style={{ direction: 'ltr', unicodeBidi: 'embed', fontWeight: 700 }}>{doc.orderNumber ?? '—'}</td>
                    <td>{doc.customerName ?? '—'}</td>
                    <td>{formatWhen(doc.uploadedAt)}</td>
                    <td>{formatBytes(doc.bytes)}</td>
                    <td>
                      <StatusPill
                        status={failed ? 'cancelled' : 'delivered'}
                        label={failed ? t('billsStatusFailed') : t('billsStatusReady')}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!failed && (
                          <>
                            <button
                              type="button"
                              className="pa-btn pa-btn--admin pa-btn--sm"
                              disabled={busy}
                              onClick={() => view(doc)}
                            >
                              {t('billsView')}
                            </button>
                            <button
                              type="button"
                              className="pa-btn pa-btn--outline pa-btn--sm"
                              disabled={busy}
                              onClick={() => download(doc)}
                            >
                              {t('billsDownload')}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="pa-btn pa-btn--outline pa-btn--sm"
                          disabled={busy}
                          onClick={() => retry(doc)}
                          title={failed ? t('billsFailedRow') : undefined}
                        >
                          {t('billsRetry')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
