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
//
// NOTE this shell is a router-less tab set on purpose for now; the routes are
// added in the next pass. Labels come from the language context so the sidebar
// is bilingual like the rest of the panel.

import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../services/firebase'
import DashboardEGP from './DashboardEGP'
import { AdminShell } from '../ui'
import { NAV } from '../config/nav'

export default function DashboardRouter({ activeTab, onTabChange, badges = {} }) {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const { t } = useLanguage()

  useEffect(() => {
    if (!currentUser) navigate('/login')
  }, [currentUser, navigate])

  if (!currentUser) return null

  const items = NAV.map((n) => ({
    ...n,
    label: t(n.labelKey),
    href: `#${n.key}`,
    badge: n.badge ? badges[n.badge] : undefined
  }))

  return (
    <AdminShell
      items={items}
      active={activeTab}
      email={currentUser.email}
      onSignOut={() => signOut(auth)}
      onNavigate={onTabChange}
      labels={{ signOut: t('signOut'), brand: t('admin') }}
    >
      <DashboardEGP />
    </AdminShell>
  )
}
