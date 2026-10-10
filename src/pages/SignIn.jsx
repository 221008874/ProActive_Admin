// src/pages/SignIn.jsx
import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'import { Field } from '../ui'

export default function SignIn() {
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
      let message = 'Invalid email or password'
      if (err.code === 'auth/user-not-found') {
        message = 'No account found with this email.'
      } else if (err.code === 'auth/wrong-password') {
        message = 'Incorrect password.'
      } else if (err.code === 'auth/invalid-email') {
        message = 'Invalid email address.'
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }


  // Sign-in. Before: 380 lines of `<style jsx>` hand-rolling a dark gradient card.
  // The design system owns the look now (tokens + .pa-* classes, light mode like
  // the rest of the admin), so this is just the form and its states.
  return (
    <main className="pa-container" style={{ paddingBlock: 64, maxWidth: 440 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div className="pa-logo" style={{ fontSize: 26 }}>PROACTIVE</div>
        <div className="pa-subtitle">Admin</div>
      </div>

      <div className="pa-block">
        <h1 style={{ fontSize: 22 }}>Sign in</h1>
        <p className="pa-subtitle">Enter your credentials to access the dashboard</p>

        {error && (
          <div className="pa-callout pa-callout--error" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            id="si-email"
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@yourstore.com"
            admin
            required
          />
          <Field
            id="si-password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            admin
            required
          />
          <button type="submit" className="pa-btn pa-btn--admin" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  )
}
