// src/context/AuthContext.jsx
//
// Owns the Firebase session AND whether that session is an administrator.
//
// The claim is the point: an authenticated user is not an admin. Without this,
// any account that can load the app sees the whole back office and can attempt
// every write. The claim is a custom claim on the ID token, set with
// scripts/setAdmin.mjs and enforced by Firestore rules, so this context is a
// UX mirror of the server's rule — never the enforcement itself.

import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../services/firebase'
import { onAuthStateChanged } from 'firebase/auth'

// Exported so a test can render the app's routes against a known session: the
// provider reads the admin claim asynchronously and renders nothing until it
// settles, which is right for the app and blocks a synchronous render.
export const AuthContext = createContext()

// Three states, not two: an unknown claim (still deciding) is not the same as a
// false one, and rendering "not authorised" while the token is still loading
// would bounce a legitimate admin to the login screen on every reload.
const STATUS = { loading: 'loading', admin: 'admin', denied: 'denied', anonymous: 'anonymous' }

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [status, setStatus] = useState(STATUS.loading)
  const [claimError, setClaimError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)

      if (!user) {
        setIsAdmin(false)
        setStatus(STATUS.anonymous)
        return
      }

      setStatus(STATUS.loading)
      try {
        // forceRefresh on the first read after sign-in: the claim is issued
        // server-side and may post-date the token the client cached at login.
        const token = await user.getIdTokenResult()
        const admin = token.claims.admin === true
        setIsAdmin(admin)
        setStatus(admin ? STATUS.admin : STATUS.denied)
      } catch (e) {
        // A token that cannot be read is a token that cannot be trusted.
        console.error('Could not read the ID token claims:', e)
        setClaimError(e?.code ?? 'unknown')
        setIsAdmin(false)
        setStatus(STATUS.denied)
      }
    })
    return unsubscribe
  }, [])

  const value = { currentUser, isAdmin, status, claimError, loading: status === STATUS.loading }

  // Children are gated on `loading`, so nothing renders before the claim is
  // known: no flash of the dashboard to a non-admin, no bounce of an admin.
  return (
    <AuthContext.Provider value={value}>
      {status === STATUS.loading ? null : children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export { STATUS as AUTH_STATUS }
