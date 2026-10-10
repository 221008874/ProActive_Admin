import { useEffect, useState } from 'react'
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'

export function useDashboardDollar() {
  const navigate = useNavigate()
  const [isReady, setIsReady] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1024)
  
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [confirmedPayments, setConfirmedPayments] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products')
  const [confirmPaymentModal, setConfirmPaymentModal] = useState(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const currency = 'USD'
  const otherCurrencies = ['PI', 'EGP']
  
  const collectionNames = {
    products: 'products_dollar',
    orders: 'orders_dollar',
    confirmedPayments: 'confirmedPayments_dollar'
  }

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      setIsTablet(window.innerWidth < 1024)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const loadProducts = async () => {
    try {
      const snapshot = await getDocs(collection(db, collectionNames.products))
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setProducts(list)
    } catch (err) {
      console.error('Error loading products:', err)
    }
  }

  const loadOrders = async () => {
    try {
      const q = query(collection(db, collectionNames.orders), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        adminConfirmed: doc.data().adminConfirmed || false
      }))
      setOrders(list)
    } catch (err) {
      console.error('Error loading orders:', err)
      setOrders([])
    }
  }

  const loadConfirmedPayments = async () => {
    try {
      const q = query(collection(db, collectionNames.confirmedPayments), orderBy('confirmedAt', 'desc'))
      const snapshot = await getDocs(q)
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setConfirmedPayments(list)
    } catch (err) {
      console.error('Error loading confirmed payments:', err)
      setConfirmedPayments([])
    }
  }

  const loadAllData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([loadProducts(), loadOrders(), loadConfirmedPayments()])
      setDataLoaded(true)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, collectionNames.products, id))
      setDeleteConfirm(null)
      await loadProducts()
    } catch (err) {
      console.error('Error deleting product:', err)
      alert('Error deleting product. Please try again.')
    }
  }

  const handleSuccess = async () => {
    setShowForm(false)
    setEditingProduct(null)
    await loadProducts()
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/login')
    } catch (err) {
      console.error('Error logging out:', err)
    }
  }

  const handleSyncProduct = async (product, targetCurrency) => {
    if (!product || !targetCurrency) return
    try {
      setSyncStatus(`syncing-${targetCurrency}`)
      
      const targetCollection = targetCurrency === 'PI' ? 'products_pi' : 'products_egp'
      const syncedProduct = {
        ...product,
        currency: targetCurrency,
        syncedFrom: currency,
        syncedAt: serverTimestamp(),
        originalId: product.id,
        originalPriceUSD: product.price
      }
      delete syncedProduct.id

      // Convert price based on target currency (you can adjust rates)
      if (targetCurrency === 'PI') {
        // Example: 1 USD = 10 PI (adjust as needed)
        syncedProduct.price = (product.price * 10).toFixed(2)
      } else if (targetCurrency === 'EGP') {
        // Example: 1 USD = 50 EGP (adjust as needed)
        syncedProduct.price = (product.price * 50).toFixed(2)
      }

      const targetProductsQuery = query(collection(db, targetCollection), where('name', '==', product.name))
      const existingSnapshot = await getDocs(targetProductsQuery)

      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0]
        await updateDoc(doc(db, targetCollection, existingDoc.id), {
          ...syncedProduct,
          updatedAt: serverTimestamp()
        })
      } else {
        await addDoc(collection(db, targetCollection), {
          ...syncedProduct,
          createdAt: serverTimestamp()
        })
      }
      setSyncStatus(`synced-${targetCurrency}`)
      setTimeout(() => setSyncStatus(null), 3000)
    } catch (err) {
      console.error('Error syncing product:', err)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus(null), 3000)
    }
  }

  const handleConfirmPayment = async (order, currentUser) => {
    try {
      const confirmedData = {
        originalOrderId: order.id,
        orderId: order.orderId,
        currency: currency,
        items: order.items || [],
        totalItems: order.totalItems || 0,
        totalPrice: order.totalPrice || 0,
        originalCreatedAt: order.createdAt,
        confirmedBy: currentUser.uid,
        confirmedByEmail: currentUser.email,
        confirmedAt: serverTimestamp(),
        adminConfirmed: true,
        status: 'confirmed_for_shipping',
        shippingStatus: 'pending',
        paymentMethod: order.paymentMethod || 'credit_card', // stripe, paypal, etc.
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        customerInfo: {
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          shippingAddress: order.shippingAddress,
          billingAddress: order.billingAddress,
          orderReference: order.orderId
        }
      }

      await addDoc(collection(db, collectionNames.confirmedPayments), confirmedData)
      
      await updateDoc(doc(db, collectionNames.orders, order.id), {
        adminConfirmed: true,
        adminConfirmedAt: serverTimestamp(),
        adminConfirmedBy: currentUser.uid,
        shippingStatus: 'pending'
      })
      
      setConfirmPaymentModal(null)
      await loadOrders()
      await loadConfirmedPayments()
    } catch (err) {
      console.error('Error confirming payment:', err)
      alert('Error confirming order. Please try again.')
    }
  }

  const generateDateButtons = () => {
    const buttons = []
    const today = new Date()
    for (let i = 7; i > 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      buttons.push({
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        isToday: false
      })
    }
    buttons.push({ date: today.toISOString().split('T')[0], label: 'Today', isToday: true })
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      buttons.push({
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        isToday: false
      })
    }
    return buttons
  }

  // Dollar orders: status === 'completed' (paid via stripe/paypal) AND !adminConfirmed
  const pendingOrders = orders.filter(order => 
    order.status === 'completed' && !order.adminConfirmed
  )

  const filteredOrders = pendingOrders.filter(o =>
    o.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.paymentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customerEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.items?.some(item => item.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getFilteredConfirmedByDate = () => {
    if (!selectedDate) return confirmedPayments
    
    return confirmedPayments.filter(payment => {
      if (!payment.confirmedAt) return false
      
      let confirmedDate
      if (payment.confirmedAt.toDate) {
        confirmedDate = payment.confirmedAt.toDate()
      } else if (typeof payment.confirmedAt === 'string') {
        confirmedDate = new Date(payment.confirmedAt)
      } else if (payment.confirmedAt.seconds) {
        confirmedDate = new Date(payment.confirmedAt.seconds * 1000)
      } else {
        confirmedDate = new Date(payment.confirmedAt)
      }
      
      const paymentDateStr = confirmedDate.toISOString().split('T')[0]
      return paymentDateStr === selectedDate
    })
  }

  const filteredConfirmedPayments = getFilteredConfirmedByDate().filter(p =>
    p.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.customerEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.items?.some(item => item.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A'
    try {
      let date
      if (timestamp.toDate) {
        date = timestamp.toDate()
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp)
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000)
      } else {
        date = new Date(timestamp)
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      console.error('Date formatting error:', e)
      return 'Invalid Date'
    }
  }

  return {
    isReady,
    isMobile,
    isTablet,
    products,
    orders,
    confirmedPayments,
    showForm,
    editingProduct,
    searchQuery,
    deleteConfirm,
    isLoading,
    activeTab,
    confirmPaymentModal,
    dataLoaded,
    syncStatus,
    selectedDate,
    otherCurrencies,
    collectionNames,
    filteredProducts,
    filteredOrders,
    filteredConfirmedPayments,
    pendingOrders,
    dateButtons: generateDateButtons(),
    setSearchQuery,
    setActiveTab,
    setShowForm,
    setEditingProduct,
    setDeleteConfirm,
    setConfirmPaymentModal,
    setSelectedDate,
    loadAllData,
    handleDelete,
    handleSuccess,
    handleEdit,
    handleLogout,
    handleSyncProduct,
    handleConfirmPayment,
    formatDate
  }
}