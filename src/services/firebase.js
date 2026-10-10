// src/lib/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const env = import.meta.env

const FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
]

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyB-zDX6AzSZ6ccS6XeqITC8oucFcwlWwDo',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'mina-terek-samir-shein.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'mina-terek-samir-shein',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'mina-terek-samir-shein.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '204099991190',
  appId: env.VITE_FIREBASE_APP_ID || '1:204099991190:web:ba4e9d9a848e64a3f474b7'
}

const missingEnvKeys = FIREBASE_ENV_KEYS.filter((key) => !env[key])

if (missingEnvKeys.length > 0) {
  console.warn(
    `[firebase] Missing ${missingEnvKeys.length} of ${FIREBASE_ENV_KEYS.length} environment values: ` +
    `${missingEnvKeys.join(', ')}\n` +
    `[firebase] Falling back to built-in defaults, so the app is pointed at project ` +
    `"${firebaseConfig.projectId}". Copy .env.example to .env and fill in the ProActive ` +
    'values to switch projects.'
  )
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Set auth persistence to LOCAL (survives page refresh)
setPersistence(auth, browserLocalPersistence).catch(console.error)