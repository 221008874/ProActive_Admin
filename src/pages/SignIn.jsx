// src/pages/SignIn.jsx
//
// The only unauthenticated screen. Localised: the store owner's browser may be
// in Arabic, and a login form they cannot read is a support call.

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { Button, Field } from '../ui'

const AUTH_ERROR_KEY = {
  'auth/user-not-found': 'accountNotFound',
  'auth/wrong-password': 'wrongPassword',
  'auth/invalid-email': 'invalidEmail'
}

export default function SignIn() {
  const { t, lang, toggleLanguage } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      setError(t(AUTH_ERROR_KEY[err.code] ?? 'invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="pa-container" style={{ paddingBlock: 64, maxWidth: 440, position: 'relative' }}>
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label={t('signIn')}
        style={{
          position: 'absolute', top: 16, insetInlineEnd: 16,
          background: 'transparent', border: '1.5px solid var(--pa-ink)', color: 'var(--pa-ink)',
          minHeight: 'var(--pa-tap)', padding: '0 12px', font: '700 13px var(--pa-font-body)', cursor: 'pointer'
        }}
      >
        {lang === 'ar' ? 'English' : 'العربية'}
      </button>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div className="pa-logo" style={{ fontSize: 26 }}>PROACTIVE</div>
        <div className="pa-subtitle">{t('admin')}</div>
      </div>

      <div className="pa-block">
        <h1 style={{ fontSize: 22 }}>{t('signInTitle')}</h1>
        <p className="pa-subtitle">{t('signInSubtitle')}</p>

        {error && (
          <div className="pa-callout pa-callout--error" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            id="si-email"
            label={t('email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@yourstore.com"
            admin
            required
          />
          <Field
            id="si-password"
            label={t('password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            admin
            required
          />
          <Button type="submit" className="pa-btn--admin pa-btn--block" disabled={loading}>
            {loading ? t('signingIn') : t('signIn')}
          </Button>
        </form>
      </div>
    </main>
  )
}
