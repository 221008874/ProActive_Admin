// src/lib/firebase.js
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator
} from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator
} from 'firebase/firestore'

const env = import.meta.env

const FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
]

/**
 * Emulator mode.
 *
 * This flag switches BOTH Auth and Firestore, deliberately. Leaving Firestore
 * pointed at production while Auth talks to the emulator is the worst possible
 * split: the emulator happily accepts any email/password, so a test signs in
 * "successfully" and then reads and writes the real catalogue.
 *
 * The project id is overridden too, because the emulators namespace everything
 * by project. The seeded admin (scripts/setup-emulator-auth.mjs) lives under
 * 'proactive-fashion-demo'; signing in against any other project id is a
 * user-not-found, not a wrong password.
 */
const useEmulator = env.VITE_USE_AUTH_EMULATOR === 'true'
const AUTH_EMULATOR_URL = env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099'
const FIRESTORE_EMULATOR_URL = env.VITE_FIRESTORE_EMULATOR_URL || 'http://127.0.0.1:8399'
const EMULATOR_PROJECT_ID = env.VITE_EMULATOR_PROJECT_ID || 'proactive-fashion-demo'

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyB-zDX6AzSZ6ccS6XeqITC8oucFcwlWwDo',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'mina-terek-samir-shein.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'mina-terek-samir-shein',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'mina-terek-samir-shein.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '204099991190',
  appId: env.VITE_FIREBASE_APP_ID || '1:204099991190:web:ba4e9d9a848e64a3f474b7'
}

const missingEnvKeys = FIREBASE_ENV_KEYS.filter((key) => !env[key])

if (missingEnvKeys.length > 0 && !useEmulator) {
  console.warn(
    `[firebase] Missing ${missingEnvKeys.length} of ${FIREBASE_ENV_KEYS.length} environment values: ` +
    `${missingEnvKeys.join(', ')}\n` +
    `[firebase] Falling back to built-in defaults, so the app is pointed at project ` +
    `"${firebaseConfig.projectId}". Copy .env.example to .env and fill in the ProActive ` +
    'values to switch projects.'
  )
}

if (useEmulator) {
  // Must happen before initializeApp: the id is baked into every emulator
  // request path.
  firebaseConfig.projectId = EMULATOR_PROJECT_ID
  console.warn(
    `[firebase] EMULATOR MODE: auth ${AUTH_EMULATOR_URL}, firestore ${FIRESTORE_EMULATOR_URL}, ` +
    `project "${EMULATOR_PROJECT_ID}". Nothing here touches the live project.`
  )
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// The Firestore database id.
//
// This must be '(default)' WITH the parentheses. Firestore's default database is
// literally named "(default)", and passing 'default' instead silently addresses a
// different, non-existent database rather than erroring: reads come back empty
// and the panel just looks like it has no data. Against the emulator the symptom
// is louder but equally confusing - the emulator logs
// "could not infer db from headers" and the client gives up with "Could not reach
// Cloud Firestore backend", then serves empty results from its offline cache.
//
// Overridable so another project can be pointed at without a code change.
export const DATABASE_ID = env.VITE_FIRESTORE_DATABASE_ID || '(default)'
export const db = getFirestore(app, DATABASE_ID)

/**
 * Point the SDKs at the local emulators.
 *
 * These calls MUST be synchronous and must precede every auth or Firestore call.
 * A floating import() here is a race, and the race is invisible: the emulator
 * connection simply loses, the sign-in goes to the live project, and the failure
 * surfaces as "stuck on the login page" rather than as a config error.
 *
 * connectAuthEmulator also throws if called twice, which Vite's hot reload will
 * happily do, so the registration is parked on globalThis.
 */
if (useEmulator) {
  const key = '__proactiveEmulatorsConnected'
  if (globalThis[key]) {
    console.warn('[firebase] Emulators already connected for this page; skipping re-connect.')
  } else {
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true })
    connectFirestoreEmulator(db, FIRESTORE_EMULATOR_URL)
    globalThis[key] = true
    console.warn('[firebase] Emulators connected (auth + firestore).')
  }
}

// Set auth persistence to LOCAL (survives page refresh). Deliberately last: it
// is an auth network call, so it has to happen after the emulator is wired up.
setPersistence(auth, browserLocalPersistence).catch(console.error)