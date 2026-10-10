// src/pages/DashboardRouter.jsx
//
// The old file was a fixed 44px dark bar hosting a currency switcher — but this
// admin runs exactly one store (EGP), so the switcher had a single tab and the
// real navigation lived in the dashboard's own header. That is what the design
// system's AdminShell is for: PROACTIVE / Admin brand, the nav with live counts,
// the signed-in email and sign-out, in one place, with the black sidebar turning
// into a bottom bar on phones.
//
// The currency switcher is gone (there is nothing to switch between) and the
// dashboard's internal tab bar with it: this shell IS the nav. onNavigate wires
// the sidebar into the dashboard's activeTab state.

import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../services/firebase'
import DashboardEGP from './DashboardEGP'
import { AdminShell, Count } from '../ui'

// The dashboard's tab ids. Counts are injected by the app while it renders.
const NAV = [
  { key: 'products', label: 'Products' },
  { key: 'orders', label: 'Orders' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'coupons', label: 'Coupons' },
  { key: 'operations', label: 'Operations' }
]

export default function DashboardRouter({ activeTab, onTabChange, badges = {} }) {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentUser) navigate('/login')
  }, [currentUser, navigate])

  if (!currentUser) return null

  const items = NAV.map((n) => ({
    ...n,
    href: `#${n.key}`,
    badge: badges[n.key],
    badgeTone: n.key === 'products' ? 'low' : undefined
  }))

  return (
    <AdminShell
      items={items}
      active={activeTab}
      email={currentUser.email}
      onSignOut={() => signOut(auth)}
      onNavigate={onTabChange}
    >
      <DashboardEGP />
    </AdminShell>
  )
}

export { NAV, Count }
