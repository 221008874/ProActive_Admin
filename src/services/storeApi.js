// src/services/storeApi.js
//
// The admin's client for the STORE app's /api routes. The admin reads
// Firestore directly (it holds the admin claim), but the generated bills are
// bytes in a PRIVATE GitHub repository on the store side: there is no public
// URL for them and the github token must never leave the server. So the
// bytes are fetched through the store's admin-authenticated endpoints.
//
// Every call attaches a fresh Firebase ID token (the SDK refreshes it
// automatically; never cache the token itself). The store base URL comes
// from VITE_STORE_API_BASE because the two apps are deployed separately.

import { auth } from './firebase'

export const STORE_API_BASE = (import.meta.env.VITE_STORE_API_BASE || '').replace(/\/+$/, '')

async function authHeaders(extra = {}) {
  const headers = { 'content-type': 'application/json', ...extra }
  // getIdToken() refreshes when needed, so a stale claim never 403s here.
  const user = auth.currentUser
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`
  return headers
}

async function request(path, { method = 'GET', body, headers } = {}) {
  if (!STORE_API_BASE) {
    throw new Error('STORE_API_NOT_CONFIGURED')
  }
  let response
  try {
    response = await fetch(`${STORE_API_BASE}${path}`, {
      method,
      headers: await authHeaders(headers),
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
  } catch {
    throw new Error('NETWORK_ERROR')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `HTTP_${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

export const storeApi = {
  isConfigured: () => Boolean(STORE_API_BASE),
  getJson: (path, options) => request(path, { ...options, method: 'GET' }),
  postJson: (path, body, options) => request(path, { ...options, method: 'POST', body })
}
