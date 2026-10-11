// src/context/LanguageContext.jsx
//
// Owns the admin panel's language state and the t() lookup. The copy lives in
// src/i18n/strings.js so it can be edited without opening the provider.
//
// The API deliberately matches the storefront's LanguageContext (lang, t,
// toggleLanguage) plus `dir`, so a component written for one app reads the
// same in the other. The dictionaries are NOT shared: the admin speaks to the
// owner about orders and stock, the store speaks to shoppers about products,
// and a key that exists in both would drift. Copy a key across deliberately.

import { createContext, useContext, useEffect, useState } from 'react'
import { ar, en } from '../i18n/strings'

// The live dictionary pair. t() reads translations[lang], so pointing this at
// a different source (a CMS, a locale fetched at runtime) is the only change
// a new language needs.
const translations = { ar, en }

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  // The saved language is the initial state, so the first paint is already in
  // the right language and direction rather than flashing English then
  // mirroring. Default is English here (the storefront defaults to Arabic):
  // the admin is the owner's tool, and Arabic is opt-in via the toggle.
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('language')
      return saved === 'ar' || saved === 'en' ? saved : 'en'
    } catch {
      return 'en' // private mode: default English
    }
  })

  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  // Apply direction & language to <html>, which is what the logical
  // properties in components.css mirror against.
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    localStorage.setItem('language', lang)
  }, [lang, dir])

  // Interpolation: t('onlyNLeft', { count: 3 }) fills {count}.
  const t = (key, params = {}) => {
    let text = translations[lang][key] || key
    Object.keys(params).forEach((param) => {
      text = text.replace(`{${param}}`, params[param])
    })
    return text
  }

  const toggleLanguage = () => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))

  return (
    <LanguageContext.Provider value={{ lang, dir, t, toggleLanguage, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
