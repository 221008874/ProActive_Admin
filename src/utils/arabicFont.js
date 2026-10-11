// Cairo TTF for jsPDF, which cannot embed WOFF2.
//
// Fetched from Google's font CDN the first time it is needed and cached for
// the session. Only the packing slip uses it, and only when the order has
// Arabic in it, so a store that never prints one never fetches anything.

let cachedFont = null

export async function loadCairoFontB64() {
  if (cachedFont) return cachedFont

  const res = await fetch(
    'https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvalIhTp2mxdt0UX8.ttf'
  )
  if (!res.ok) throw new Error(`cairo font ${res.status}`)
  const buffer = await res.arrayBuffer()

  // jsPDF wants base64, not bytes.
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  cachedFont = btoa(binary)
  return cachedFont
}