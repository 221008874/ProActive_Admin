// src/lib/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {

  apiKey: "AIzaSyBOHwckfAbEYHOhmhKzmOYd8GEY7mywqE4",

  authDomain: "louable-b4c1a.firebaseapp.com",

  projectId: "louable-b4c1a",

  storageBucket: "louable-b4c1a.firebasestorage.app",

  messagingSenderId: "966810994370",

  appId: "1:966810994370:web:6c691e3a0d3afcb6439d5b"

};


const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Set auth persistence to LOCAL (survives page refresh)
setPersistence(auth, browserLocalPersistence).catch(console.error)

// Flexible collection names - supports both old and new structure
export const getCollectionNames = (currency, useNewStructure = false) => {
  if (useNewStructure) {
    return {
      products: currency === 'PI' ? 'products_pi' : 'products_egp',
      orders: currency === 'PI' ? 'orders_pi' : 'orders_egp',
      confirmedPayments: currency === 'PI' ? 'confirmedPayments_pi' : 'confirmedPayments_egp'
    }
  }
  // Old structure (backward compatible)
  return {
    products: 'products',
    orders: 'orders',
    confirmedPayments: 'confirmedPayments'
  }
}