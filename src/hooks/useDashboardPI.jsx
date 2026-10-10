import { useEffect, useState } from 'react'
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'

export function useDashboardPI() {
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

  const currency = 'PI'
  const otherCurrency = 'EGP'
  
  const collectionNames = {
    products: 'products_pi',
    orders: 'orders_pi',
    confirmedPayments: 'confirmedPayments_pi'
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

  const handleSyncProduct = async (product) => {
    if (!product) return
    try {
      setSyncStatus('syncing')
      const otherCollection = 'products_egp'
      const syncedProduct = {
        ...product,
        currency: otherCurrency,
        syncedFrom: currency,
        syncedAt: serverTimestamp(),
        originalId: product.id
      }
      delete syncedProduct.id

      const otherProductsQuery = query(collection(db, otherCollection), where('name', '==', product.name))
      const existingSnapshot = await getDocs(otherProductsQuery)

      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0]
        await updateDoc(doc(db, otherCollection, existingDoc.id), {
          ...syncedProduct,
          updatedAt: serverTimestamp()
        })
      } else {
        await addDoc(collection(db, otherCollection), {
          ...syncedProduct,
          createdAt: serverTimestamp()
        })
      }
      setSyncStatus('synced')
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
        paymentId: order.paymentId,
        txid: order.txid || null,
        customerInfo: {
          orderReference: order.orderId
        }
      }

      await addDoc(collection(db, collectionNames.confirmedPayments), confirmedData)
      
      await updateDoc(doc(db, collectionNames.orders, order.id), {
        adminConfirmed: true,
        adminConfirmedAt: serverTimestamp(),
        adminConfirmedBy: currentUser.uid,
        shippingStatus: 'pending',
        paymentId: order.paymentId,
        txid: order.txid || null
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

  // PI: Filter by status === 'completed' AND !adminConfirmed
  const pendingOrders = orders.filter(order => 
    order.status === 'completed' && !order.adminConfirmed
  )

  const filteredOrders = pendingOrders.filter(o =>
    o.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.paymentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.items?.some(item => item.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Date filtering for confirmed payments
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
    p.paymentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    otherCurrency,
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