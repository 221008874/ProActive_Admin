import { useEffect, useState } from 'react'
import { PageTitle, StatusPill, Field, Summary, thumb, formatEGP, loc, Count } from '../ui'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import ProductForm from '../components/ProductForm'
import { useDashboardEGP } from '../hooks/useDashboardEGP'
import { db } from '../services/firebase'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  Timestamp,
  setDoc,
  getDoc,
  writeBatch
} from 'firebase/firestore'

// FIXED: Complete list of Egypt's 27 governorates with fixed IDs
const EGYPT_GOVERNORATES = [
  { id: 'cairo', name: 'Cairo', nameAr: 'ط§ظ„ظ‚ط§ظ‡ط±ط©', defaultCost: 50 },
  { id: 'giza', name: 'Giza', nameAr: 'ط§ظ„ط¬ظٹط²ط©', defaultCost: 50 },
  { id: 'alexandria', name: 'Alexandria', nameAr: 'ط§ظ„ط¥ط³ظƒظ†ط¯ط±ظٹط©', defaultCost: 60 },
  { id: 'qalyubia', name: 'Qalyubia', nameAr: 'ط§ظ„ظ‚ظ„ظٹظˆط¨ظٹط©', defaultCost: 55 },
  { id: 'monufia', name: 'Monufia', nameAr: 'ط§ظ„ظ…ظ†ظˆظپظٹط©', defaultCost: 60 },
  { id: 'gharbia', name: 'Gharbia', nameAr: 'ط§ظ„ط؛ط±ط¨ظٹط©', defaultCost: 65 },
  { id: 'dakahlia', name: 'Dakahlia', nameAr: 'ط§ظ„ط¯ظ‚ظ‡ظ„ظٹط©', defaultCost: 65 },
  { id: 'sharkia', name: 'Sharqia', nameAr: 'ط§ظ„ط´ط±ظ‚ظٹط©', defaultCost: 65 },
  { id: 'beheira', name: 'Beheira', nameAr: 'ط§ظ„ط¨ط­ظٹط±ط©', defaultCost: 70 },
  { id: 'kafr_sheikh', name: 'Kafr El Sheikh', nameAr: 'ظƒظپط± ط§ظ„ط´ظٹط®', defaultCost: 75 },
  { id: 'damietta', name: 'Damietta', nameAr: 'ط¯ظ…ظٹط§ط·', defaultCost: 70 },
  { id: 'port_said', name: 'Port Said', nameAr: 'ط¨ظˆط±ط³ط¹ظٹط¯', defaultCost: 80 },
  { id: 'ismailia', name: 'Ismailia', nameAr: 'ط§ظ„ط¥ط³ظ…ط§ط¹ظٹظ„ظٹط©', defaultCost: 75 },
  { id: 'suez', name: 'Suez', nameAr: 'ط§ظ„ط³ظˆظٹط³', defaultCost: 75 },
  { id: 'matrouh', name: 'Matrouh', nameAr: 'ظ…ط·ط±ظˆط­', defaultCost: 100 },
  { id: 'north_sinai', name: 'North Sinai', nameAr: 'ط´ظ…ط§ظ„ ط³ظٹظ†ط§ط،', defaultCost: 120 },
  { id: 'south_sinai', name: 'South Sinai', nameAr: 'ط¬ظ†ظˆط¨ ط³ظٹظ†ط§ط،', defaultCost: 130 },
  { id: 'faiyum', name: 'Faiyum', nameAr: 'ط§ظ„ظپظٹظˆظ…', defaultCost: 70 },
  { id: 'beni_suef', name: 'Beni Suef', nameAr: 'ط¨ظ†ظٹ ط³ظˆظٹظپ', defaultCost: 75 },
  { id: 'minya', name: 'Minya', nameAr: 'ط§ظ„ظ…ظ†ظٹط§', defaultCost: 80 },
  { id: 'asyut', name: 'Asyut', nameAr: 'ط£ط³ظٹظˆط·', defaultCost: 85 },
  { id: 'sohag', name: 'Sohag', nameAr: 'ط³ظˆظ‡ط§ط¬', defaultCost: 90 },
  { id: 'qena', name: 'Qena', nameAr: 'ظ‚ظ†ط§', defaultCost: 95 },
  { id: 'luxor', name: 'Luxor', nameAr: 'ط§ظ„ط£ظ‚طµط±', defaultCost: 100 },
  { id: 'aswan', name: 'Aswan', nameAr: 'ط£ط³ظˆط§ظ†', defaultCost: 110 },
  { id: 'red_sea', name: 'Red Sea', nameAr: 'ط§ظ„ط¨ط­ط± ط§ظ„ط£ط­ظ…ط±', defaultCost: 120 },
  { id: 'new_valley', name: 'New Valley', nameAr: 'ط§ظ„ظˆط§ط¯ظٹ ط§ظ„ط¬ط¯ظٹط¯', defaultCost: 130 }
]

export default function DashboardEGP() {
  const theme = { symbol: 'EGP', name: 'EGP Store', color: 'var(--pa-ink)', lightBg: 'var(--pa-stone)' }
  
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  
  const {
    isReady,
    showForm,
    editingProduct,
    searchQuery,
    deleteConfirm,
    activeTab,
    confirmPaymentModal,
    selectedDate,
    collectionNames,
    filteredProducts,
    filteredOrders,
    filteredConfirmedPayments,
    dateButtons,
    setSearchQuery,
    setShowForm,
    setDeleteConfirm,
    setConfirmPaymentModal,
    setSelectedDate,
    loadAllData,
    handleDelete,
    handleSuccess,
    handleEdit,
    handleConfirmPayment,
    formatDate
  } = useDashboardEGP()

  // FIXED: Simplified operations state - only storing shipping costs and minimum order
  const [operations, setOperations] = useState({
    governorateCosts: {}, // { governorateId: cost }
    minimumOrderAmount: 0
  })
  const [editingGovernorate, setEditingGovernorate] = useState(null)
  const [operationsLoading, setOperationsLoading] = useState(false)
const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)


  // Coupon states
  const [coupons, setCoupons] = useState([])
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [deleteCouponConfirm, setDeleteCouponConfirm] = useState(null)
  const [couponFormData, setCouponFormData] = useState({
    amount: '',
    duration: '',
    quantity: 1
  })
  const [isGeneratingCoupons, setIsGeneratingCoupons] = useState(false)
  const [couponError, setCouponError] = useState(null)


  // FIXED: Load operations - initialize governorates if not exist
  const loadOperations = async () => {
    try {
      // Load governorate shipping costs
      const costsRef = collection(db, 'egp_governorate_costs')
      const costsSnap = await getDocs(costsRef)
      
      let governorateCosts = {}
      
      if (costsSnap.empty) {
        // Initialize default costs for all governorates
        const batch = writeBatch(db)
        
        for (const gov of EGYPT_GOVERNORATES) {
          const ref = doc(db, 'egp_governorate_costs', gov.id)
          batch.set(ref, {
            cost: gov.defaultCost,
            name: gov.name,
            nameAr: gov.nameAr,
            updatedAt: Timestamp.now()
          })
          governorateCosts[gov.id] = gov.defaultCost
        }
        
        await batch.commit()
      } else {
        costsSnap.docs.forEach(doc => {
          governorateCosts[doc.id] = doc.data().cost
        })
        
        // Add any missing governorates (in case new ones were added to the list)
        const batch = writeBatch(db)
        let hasMissing = false
        
        for (const gov of EGYPT_GOVERNORATES) {
          if (!(gov.id in governorateCosts)) {
            const ref = doc(db, 'egp_governorate_costs', gov.id)
            batch.set(ref, {
              cost: gov.defaultCost,
              name: gov.name,
              nameAr: gov.nameAr,
              updatedAt: Timestamp.now()
            })
            governorateCosts[gov.id] = gov.defaultCost
            hasMissing = true
          }
        }
        
        if (hasMissing) await batch.commit()
      }

      // Load minimum order amount
      const settingsRef = doc(db, 'egp_settings', 'general')
      const settingsSnap = await getDoc(settingsRef)
      const minOrderAmount = settingsSnap.exists() ? settingsSnap.data().minimumOrderAmount || 0 : 0

      setOperations({
        governorateCosts,
        minimumOrderAmount: minOrderAmount
      })
    } catch (error) {
      console.error('Error loading operations:', error)
    }
  }


// Add this function to generate QR code data URL
const generateQRDataURL = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
  } catch (err) {
    console.error('QR generation error:', err)
    return null
  }
}

// Updated PDF generation function
// Enhanced PDF generation function with professional design
const generateCouponsPDF = async () => {
  const activeUnusedCoupons = coupons.filter(c =>
    c.isActive &&
    !isCouponExpired(c) &&
    (c.usedCount || 0) === 0
  )

  if (activeUnusedCoupons.length === 0) {
    alert('No active unused coupons available to export')
    return
  }

  setIsGeneratingPDF(true)

  try {
    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    // A4 PAGE GEOMETRY
    // A4 = 210 أ— 297 mm
    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const PW = 210
    const PH = 297

    // Page chrome
    const HDR  = 24   // header height
    const FTR  = 13   // footer height
    const PAD  = 11   // outer margin on all sides
    const GAPX = 7    // gap between 2 coupon columns
    const GAPY = 6    // gap between coupon rows
    const COLS = 2
    const ROWS = 4

    // Coupon card size â€” calculated to fill the grid exactly
    // CW = (210 - 11*2 - 7)  / 2 = 85.5 mm
    // CH = (297 - 24 - 13 - 11*2 - 6*3) / 4 = (238 - 18) / 4 = 55 mm
    const CW = (PW - PAD * 2 - GAPX) / COLS          // 85.5 mm
    const CH = (PH - HDR - FTR - PAD * 2 - GAPY * (ROWS - 1)) / ROWS  // 55 mm

    // â”€â”€ Inside each card the layout is: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //
    //   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”گ
    //   â”‚  [  NAVY HEADER BAND â€” full width  ]  [ AMOUNT BADGE ]â”‚  0â€“14
    //   â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ gold strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤  14â€“15.5
    //   â”‚                                    â”‚                   â”‚
    //   â”‚  LEFT TEXT COLUMN (0â€“57mm wide)    â”‚  RIGHT QR COLUMN  â”‚  15.5â€“CH
    //   â”‚  â€¢ COUPON CODE label               â”‚  (57â€“CW, 28.5mm)  â”‚
    //   â”‚  â€¢ code value                      â”‚  QR 28أ—28         â”‚
    //   â”‚  â€¢ gold underline                  â”‚  "Scan to redeem" â”‚
    //   â”‚  â€¢ expiry pill                     â”‚                   â”‚
    //   â”‚  â€¢ single-use pill                 â”‚                   â”‚
    //   â”‚  â€¢ ACTIVE badge                    â”‚                   â”‚
    //   â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ gold bottom bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤  CH-1.5â€“CH
    //   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”ک
    //
    //   Divider line between left/right at x = cx + 57

    const BAND_H  = 14    // navy top band height
    const DIVX    = 57    // x of left/right divider (from card left edge)
    const QR_SZ   = 28    // QR image side length
    const L_PAD   = 5     // left-column inner padding
    const R_PAD   = 4     // right-column inner padding from divider

    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    // COLOURS
    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    const C = {
      navy:     [10,  18,  45],
      navyMid:  [18,  32,  72],
      gold:     [190, 138, 15],
      goldLt:   [225, 178, 55],
      goldPale: [255, 248, 220],
      green:    [4,   142, 97],
      greenPale:[210, 252, 231],
      slate:    [68,  82,  102],
      silver:   [145, 160, 182],
      bg:       [247, 249, 252],
      white:    [255, 255, 255],
      border:   [208, 218, 234],
      shadow:   [182, 193, 212],
      perf:     [190, 202, 218],
    }

    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    // DRAW HELPERS
    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    const fillR = (x, y, w, h, r, col) => {
      pdf.setFillColor(...col)
      pdf.roundedRect(x, y, w, h, r, r, 'F')
    }
    const strokeR = (x, y, w, h, r, col, lw = 0.25) => {
      pdf.setDrawColor(...col)
      pdf.setLineWidth(lw)
      pdf.roundedRect(x, y, w, h, r, r, 'S')
    }
    const dashed = (x1, y, x2, dash = 1.6, gap = 2.2) => {
      pdf.setLineWidth(0.25)
      for (let cx = x1; cx < x2; cx += dash + gap) {
        pdf.line(cx, y, Math.min(cx + dash, x2), y)
      }
    }
    const pill = (x, y, w, h, bgCol, textCol, label, fontSize = 5.5) => {
      fillR(x, y, w, h, 2, bgCol)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(fontSize)
      pdf.setTextColor(...textCol)
      pdf.text(label, x + w / 2, y + h / 2 + fontSize * 0.18, { align: 'center' })
    }

    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    // PAGE HEADER
    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    const drawHeader = (pageNum, totalPages) => {
      // Navy bg
      pdf.setFillColor(...C.navy)
      pdf.rect(0, 0, PW, HDR, 'F')
      // Top highlight strip
      pdf.setFillColor(...C.navyMid)
      pdf.rect(0, 0, PW, 1.5, 'F')
      // Gold bottom bar
      pdf.setFillColor(...C.gold)
      pdf.rect(0, HDR - 2, PW, 2, 'F')

      // Left: brand + tagline
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(17)
      pdf.setTextColor(...C.white)
      pdf.text('LOUABLE', PAD, 14)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6.5)
      pdf.setTextColor(...C.goldLt)
      pdf.text('EXCLUSIVE DISCOUNT COUPONS', PAD, 20.5)

      // Right: meta
      pdf.setFontSize(6.5)
      pdf.setTextColor(...C.silver)
      pdf.text(
        `Generated: ${new Date().toLocaleDateString('en-GB')}`,
        PW - PAD, 13, { align: 'right' }
      )
      pdf.text(
        `${activeUnusedCoupons.length} coupons  آ·  Page ${pageNum + 1} / ${totalPages}`,
        PW - PAD, 20.5, { align: 'right' }
      )
    }

    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    // PAGE FOOTER
    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    const drawFooter = () => {
      const fy = PH - FTR
      pdf.setFillColor(...C.navy)
      pdf.rect(0, fy, PW, FTR, 'F')
      pdf.setFillColor(...C.gold)
      pdf.rect(0, fy, PW, 1.5, 'F')

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6)
      pdf.setTextColor(...C.silver)
      pdf.text(
        'Valid for single use only  آ·  Non-transferable  آ·  Scan QR code at checkout to apply discount',
        PW / 2, fy + 5.5, { align: 'center' }
      )
      pdf.setTextColor(...C.goldLt)
      pdf.text('elhamdindustriesegp.vercel.app', PW / 2, fy + 10.5, { align: 'center' })
    }

    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    // COUPON CARD
    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    const drawCoupon = async (coupon, cx, cy) => {
      const R = 3.5   // card corner radius

      // â”€â”€ 1. Shadow
      fillR(cx + 1.5, cy + 1.5, CW, CH, R, C.shadow)

      // â”€â”€ 2. Card base
      fillR(cx, cy, CW, CH, R, C.bg)

      // â”€â”€ 3. Navy top band (full width, BAND_H=14mm)
      pdf.setFillColor(...C.navy)
      pdf.roundedRect(cx, cy, CW, BAND_H, R, R, 'F')
      // Square off the bottom edge of the rounded rect
      pdf.rect(cx, cy + BAND_H - R, CW, R, 'F')

      // â”€â”€ 4. Gold strip right below band
      pdf.setFillColor(...C.gold)
      pdf.rect(cx, cy + BAND_H, CW, 1.5, 'F')

      // â”€â”€ 5. Amount badge â€” right-aligned inside band
      //       Pill: 30أ—9mm, vertically centred in 14mm band â†’ y = cy + 2.5
      const BW = 30, BH = 9
      const bx = cx + CW - BW - 5
      const by = cy + (BAND_H - BH) / 2
      fillR(bx, by, BW, BH, 3, C.gold)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...C.navy)
      pdf.text(
        `${theme.symbol}${coupon.amount}`,
        bx + BW / 2, by + BH / 2 + 1.8,
        { align: 'center' }
      )

      // â”€â”€ 6. Band text â€” left side (stays clear of badge)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(...C.white)
      pdf.text('EXCLUSIVE DISCOUNT', cx + L_PAD, cy + 6.5)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(5.5)
      pdf.setTextColor(...C.goldLt)
      pdf.text('MEMBER COUPON', cx + L_PAD, cy + 12)

      // â”€â”€ 7. Vertical divider line (left/right column separator)
      //       Runs from below gold strip to above gold bottom bar
      const divX = cx + DIVX
      pdf.setDrawColor(...C.border)
      pdf.setLineWidth(0.3)
      pdf.line(divX, cy + BAND_H + 1.5, divX, cy + CH - 3)

      // â”€â”€ 8. LEFT COLUMN content
      //       All y coords are absolute (cy + offset)
      const LX = cx + L_PAD   // left content x

      // "COUPON CODE" micro-label at cy+19
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(5)
      pdf.setTextColor(...C.slate)
      pdf.text('COUPON CODE', LX, cy + 19)

      // Code value at cy+26
      pdf.setFont('courier', 'bold')
      pdf.setFontSize(10.5)
      pdf.setTextColor(...C.navy)
      pdf.text(coupon.code, LX, cy + 26)

      // Gold underline â€” constrained to left column width
      const maxCodeW = DIVX - L_PAD - 3
      pdf.setFont('courier', 'bold'); pdf.setFontSize(10.5)
      const codeW = Math.min(pdf.getTextWidth(coupon.code), maxCodeW)
      pdf.setDrawColor(...C.gold)
      pdf.setLineWidth(0.7)
      pdf.line(LX, cy + 27.5, LX + codeW, cy + 27.5)

      // Expiry pill: x=LX, y=cy+30, width = DIVX-L_PAD-3, height=6
      const expire = coupon.expiresAt?.toLocaleDateString('en-GB') || 'No expiry'
      const PW_LEFT = DIVX - L_PAD - 3   // pill width fits strictly in left column
      fillR(LX, cy + 30, PW_LEFT, 6, 2, C.goldPale)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(5.5)
      pdf.setTextColor(...C.gold)
      pdf.text(`Valid until: ${expire}`, LX + 2.5, cy + 34)

      // Single-use pill: y=cy+37.5
      fillR(LX, cy + 37.5, PW_LEFT, 6, 2, C.greenPale)
      pdf.setFontSize(5.5)
      pdf.setTextColor(...C.green)
      pdf.text('âœ“  Single use  آ·  Non-transferable', LX + 2.5, cy + 41.5)

      // ACTIVE badge: y=cy+45
      fillR(LX, cy + 45, 20, 6, 2, C.green)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(5.5)
      pdf.setTextColor(...C.white)
      pdf.text('ACTIVE', LX + 10, cy + 49, { align: 'center' })

      // â”€â”€ 9. RIGHT COLUMN â€” QR code
      //       Available width  = CW - DIVX - R_PAD*2 = 85.5-57-8 = 20.5mm  â†گ too narrow for 28mm QR
      //       â–¶ Widen right column: shift divider to 52mm, QR=28mm
      //         divX = cx+52, QR starts at divX+R_PAD = cx+56, QR_SZ=28, right edge=cx+84 < cx+CW âœ“

      // QR is centred in the right column
      const rightColW = CW - DIVX - 1   // remaining width after divider
      const QX = divX + (rightColW - QR_SZ) / 2   // centre QR horizontally
      const QY = cy + BAND_H + 2.5                 // just below gold strip

      // Navy outer frame, white mat
      fillR(QX - 2, QY - 2, QR_SZ + 4, QR_SZ + 4, 2.5, C.navy)
      fillR(QX - 1, QY - 1, QR_SZ + 2, QR_SZ + 2, 2,   C.white)

      const qrUrl = await generateQRDataURL(
        `https://elhamdindustriesegp.vercel.app/coupon/${coupon.code}`
      )
      if (qrUrl) pdf.addImage(qrUrl, 'PNG', QX, QY, QR_SZ, QR_SZ)

      // "Scan to redeem" below QR â€” centred in right column
      const scanY = QY + QR_SZ + 5
      if (scanY < cy + CH - 3) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(5)
        pdf.setTextColor(...C.slate)
        pdf.text('Scan to redeem', QX + QR_SZ / 2, scanY, { align: 'center' })
      }

      // â”€â”€ 10. Gold bottom bar
      pdf.setFillColor(...C.gold)
      pdf.rect(cx + 6, cy + CH - 1.5, CW - 12, 1.5, 'F')

      // â”€â”€ 11. Card border
      strokeR(cx, cy, CW, CH, R, C.border, 0.2)
    }

    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    // RENDER ALL PAGES
    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    const PER_PAGE    = COLS * ROWS
    const TOTAL_PAGES = Math.ceil(activeUnusedCoupons.length / PER_PAGE)
    const GRID_TOP    = HDR + PAD

    for (let i = 0; i < activeUnusedCoupons.length; i++) {
      const pageNum     = Math.floor(i / PER_PAGE)
      const indexOnPage = i % PER_PAGE

      if (indexOnPage === 0) {
        if (i > 0) pdf.addPage()
        drawHeader(pageNum, TOTAL_PAGES)
        drawFooter()
      }

      const col = indexOnPage % COLS
      const row = Math.floor(indexOnPage / COLS)
      const cx  = PAD + col * (CW + GAPX)
      const cy  = GRID_TOP + row * (CH + GAPY)

      await drawCoupon(activeUnusedCoupons[i], cx, cy)
    }

    pdf.save(`louable-coupons-${new Date().toISOString().split('T')[0]}.pdf`)

  } catch (error) {
    console.error('Error generating PDF:', error)
    alert('Failed to generate PDF. Please try again.')
  } finally {
    setIsGeneratingPDF(false)
  }
}
  // FIXED: Update governorate shipping cost only
  const handleUpdateGovernorateCost = async (governorateId, newCost) => {
    try {
      const cost = parseFloat(newCost) || 0
      if (cost < 0) throw new Error('Cost cannot be negative')
      
      setOperationsLoading(true)
      
      await updateDoc(doc(db, 'egp_governorate_costs', governorateId), {
        cost: cost,
        updatedAt: Timestamp.now()
      })
      
      setOperations(prev => ({
        ...prev,
        governorateCosts: {
          ...prev.governorateCosts,
          [governorateId]: cost
        }
      }))
      
      setEditingGovernorate(null)
    } catch (error) {
      console.error('Error updating cost:', error)
      alert('Failed to update shipping cost')
    } finally {
      setOperationsLoading(false)
    }
  }

  // Update minimum order amount
  const handleUpdateMinOrder = async (newAmount) => {
    try {
      const amount = parseFloat(newAmount) || 0
      await setDoc(doc(db, 'egp_settings', 'general'), {
        minimumOrderAmount: amount,
        updatedAt: Timestamp.now()
      }, { merge: true })
      
      setOperations(prev => ({
        ...prev,
        minimumOrderAmount: amount
      }))
    } catch (error) {
      console.error('Error updating min order:', error)
      alert('Failed to update minimum order amount')
    }
  }

  // Generate unique coupon code
  const generateCouponCode = () => {
    const prefix = 'EGP'
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `${prefix}-${timestamp}-${random}`
  }

  // Load coupons from Firestore
  const loadCoupons = async () => {
    try {
      const couponsRef = collection(db, 'egp_coupons')
      const q = query(couponsRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      const couponsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        expiresAt: doc.data().expiresAt?.toDate?.() || null
      }))
      setCoupons(couponsData)
    } catch (error) {
      console.error('Error loading coupons:', error)
    }
  }

  // Generate multiple coupons
  const handleGenerateCoupons = async (e) => {
    e.preventDefault()
    setCouponError(null)
    setIsGeneratingCoupons(true)

    try {
      const { amount, duration, quantity } = couponFormData
      const numQuantity = parseInt(quantity)
      const numAmount = parseFloat(amount)
      const numDuration = parseInt(duration)

      if (!numAmount || numAmount <= 0) throw new Error('Invalid amount')
      if (!numDuration || numDuration <= 0) throw new Error('Invalid duration')
      if (!numQuantity || numQuantity <= 0 || numQuantity > 100) throw new Error('Quantity must be between 1 and 100')

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + numDuration)

      const generatedCoupons = []

      for (let i = 0; i < numQuantity; i++) {
        const couponCode = generateCouponCode()
        const couponData = {
          code: couponCode,
          amount: numAmount,
          currency: 'EGP',
          duration: numDuration,
          createdAt: Timestamp.now(),
          expiresAt: Timestamp.fromDate(expiresAt),
          isActive: true,
          usedCount: 0,
          maxUses: 1,
          createdBy: currentUser?.email || 'admin'
        }

        const docRef = await addDoc(collection(db, 'egp_coupons'), couponData)
        generatedCoupons.push({
          id: docRef.id,
          ...couponData,
          createdAt: new Date(),
          expiresAt: expiresAt
        })
      }

      setCoupons(prev => [...generatedCoupons, ...prev])
      setShowCouponForm(false)
      setCouponFormData({ amount: '', duration: '', quantity: 1 })
      alert(`Successfully generated ${numQuantity} coupon(s)`)
    } catch (error) {
      setCouponError(error.message)
    } finally {
      setIsGeneratingCoupons(false)
    }
  }

  // Delete coupon
  const handleDeleteCoupon = async (couponId) => {
    try {
      await deleteDoc(doc(db, 'egp_coupons', couponId))
      setCoupons(prev => prev.filter(c => c.id !== couponId))
      setDeleteCouponConfirm(null)
    } catch (error) {
      console.error('Error deleting coupon:', error)
      alert('Failed to delete coupon')
    }
  }

  // Toggle coupon active status
  const handleToggleCouponStatus = async (coupon) => {
    try {
      const newStatus = !coupon.isActive
      await updateDoc(doc(db, 'egp_coupons', coupon.id), {
        isActive: newStatus
      })
      setCoupons(prev => prev.map(c => 
        c.id === coupon.id ? { ...c, isActive: newStatus } : c
      ))
    } catch (error) {
      console.error('Error updating coupon:', error)
    }
  }

  // Edit coupon
  const handleEditCoupon = async (e) => {
    e.preventDefault()
    try {
      const { amount, duration } = editingCoupon
      const numAmount = parseFloat(amount)
      const numDuration = parseInt(duration)

      if (!numAmount || numAmount <= 0) throw new Error('Invalid amount')
      
      const updates = {
        amount: numAmount,
        updatedAt: Timestamp.now()
      }

      if (numDuration && numDuration !== editingCoupon.duration) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + numDuration)
        updates.duration = numDuration
        updates.expiresAt = Timestamp.fromDate(expiresAt)
      }

      await updateDoc(doc(db, 'egp_coupons', editingCoupon.id), updates)
      
      setCoupons(prev => prev.map(c => 
        c.id === editingCoupon.id ? { ...c, ...updates, updatedAt: new Date() } : c
      ))
      setEditingCoupon(null)
    } catch (error) {
      alert(error.message)
    }
  }

  // Filter coupons. Uses the tab's shared search box (`searchQuery`) — the
  // design-system refactor replaced the per-tab coupon search input with the one
  // search field at the top of the page, so the filter reads that.
  const filteredCoupons = coupons.filter(coupon =>
    coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coupon.amount.toString().includes(searchQuery)
  )

  // Check if coupon is expired
  const isCouponExpired = (coupon) => {
    if (!coupon.expiresAt) return false
    return new Date(coupon.expiresAt) < new Date()
  }

  useEffect(() => {
    if (!currentUser) {
      navigate('/login')
      return
    }
    loadAllData()
    loadCoupons()
    loadOperations()
  }, [currentUser, navigate])

  if (!isReady) {
    return (
      <div className="pa-container" role="status" style={{ paddingBlock: 64, textAlign: 'center' }}>
        <span className="pa-subtitle">Loading…</span>
      </div>
    )
  }

  // The nav now lives in the design system's AdminShell (see DashboardRouter),
  // so the dashboard no longer renders its own tab bar or header. What is left
  // is the working area: actions, the forms and the tables for the active tab.
  const onConfirmPayment = (order) => handleConfirmPayment(order, currentUser)

  const tabTitle = {
    products: 'Products',
    orders: 'Pending EGP orders',
    confirmed: 'Confirmed for shipping',
    coupons: 'Coupons',
    operations: 'Operations'
  }[activeTab] ?? 'Dashboard'

  const tabSubtitle = {
    products: 'Edit the catalogue. Products carry colours, sizes and a stock grid.',
    orders: 'Cash on delivery orders awaiting confirmation for shipping',
    confirmed: 'Cash on delivery orders confirmed and ready for shipping',
    coupons: `Generate, edit and revoke ${collectionNames.coupons}`,
    operations: "Configure shipping costs for Egypt's 27 governorates"
  }[activeTab] ?? ''

  return (
    <>
      <PageTitle
        title={tabTitle}
        subtitle={tabSubtitle}
        actions={
          <>
            {activeTab === 'products' && (
              <button
                type="button"
                className="pa-btn pa-btn--admin"
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? 'Close form' : 'Add product'}
              </button>
            )}
            {activeTab === 'coupons' && (
              <>
                <button
                  type="button"
                  className="pa-btn pa-btn--outline pa-btn--admin"
                  onClick={() => setShowCouponForm(false)}
                  hidden={!showCouponForm}
                >
                  Close form
                </button>
                <button
                  type="button"
                  className="pa-btn pa-btn--admin"
                  onClick={() => setShowCouponForm(true)}
                >
                  Generate coupons
                </button>
              </>
            )}
            {(activeTab === 'orders' || activeTab === 'confirmed' || activeTab === 'coupons') && (
              <>
                <button
                  type="button"
                  className="pa-btn pa-btn--outline pa-btn--admin"
                  onClick={generateCouponsPDF}
                  disabled={isGeneratingPDF}
                >
                  {isGeneratingPDF ? 'Generating PDF…' : 'Export PDF'}
                </button>
                <button type="button" className="pa-btn pa-btn--outline pa-btn--admin" onClick={loadAllData}>
                  Reload
                </button>
              </>
            )}

            {!(activeTab === 'orders' || activeTab === 'confirmed' || activeTab === 'coupons') && (
              <button type="button" className="pa-btn pa-btn--outline pa-btn--admin" onClick={loadAllData}>
                Reload
              </button>
            )}
          </>
        }
      />

      {(activeTab === 'products' || activeTab === 'orders' || activeTab === 'confirmed' || activeTab === 'coupons') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div className="pa-field" style={{ flex: '1 1 260px' }}>
            <input
              className="pa-input pa-input--admin"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'orders'
                  ? 'Search by Order ID or product name...'
                  : activeTab === 'confirmed'
                    ? 'Search confirmed orders...'
                    : activeTab === 'coupons'
                      ? 'Search coupons...'
                      : 'Search products...'
              }
              aria-label="Search"
            />
          </div>
        </div>
      )}

      {/* Date filter â€” confirmed orders only */}
      {activeTab === 'confirmed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="pa-pdp__label">Date</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dateButtons.map((btn) => (
              <button
                key={btn.date}
                type="button"
                className={`pa-chip${selectedDate === btn.date ? ' pa-chip--on' : ''}`}
                aria-pressed={selectedDate === btn.date}
                onClick={() => setSelectedDate(btn.date)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          COUPON GENERATION FORM
      ------------------------------------------------------------------ */}
      {activeTab === 'coupons' && showCouponForm && (
        <form className="pa-block" onSubmit={handleGenerateCoupons} style={{ gap: 16 }}>
          <div className="pa-pdp__label">Generate new coupons</div>

          {couponError && <div className="pa-error" role="alert">{couponError}</div>}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <Field
              id="cg-amount"
              label="Amount (EGP)"
              type="number"
              min="1"
              step="0.01"
              value={couponFormData.amount}
              onChange={(e) => setCouponFormData({ ...couponFormData, amount: e.target.value })}
              required
            />
            <Field
              id="cg-duration"
              label="Duration (days)"
              type="number"
              min="1"
              value={couponFormData.duration}
              onChange={(e) => setCouponFormData({ ...couponFormData, duration: e.target.value })}
              required
            />
            <Field
              id="cg-quantity"
              label="Quantity"
              type="number"
              min="1"
              value={couponFormData.quantity}
              onChange={(e) => setCouponFormData({ ...couponFormData, quantity: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              className="pa-btn pa-btn--admin"
              disabled={isGeneratingCoupons}
            >
              {isGeneratingCoupons ? 'Generating...' : 'Generate'}
            </button>
            <button
              type="button"
              className="pa-btn pa-btn--outline pa-btn--admin"
              onClick={() => setShowCouponForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------------
          PRODUCT FORM
      ------------------------------------------------------------------ */}
      {activeTab === 'products' && showForm && (
        <div className="pa-block">
          <div className="pa-pdp__label">{editingProduct ? 'Edit product' : 'Add new product'}</div>
          <ProductForm
            product={editingProduct}
            onSuccess={handleSuccess}
            collectionName={collectionNames.products}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------
          OPERATIONS
      ------------------------------------------------------------------ */}
      {activeTab === 'operations' && (
        <>
          <div className="pa-block">
            <div className="pa-pdp__label">Minimum order amount</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
              <Field
                id="op-min-order"
                label="Orders below this amount will not be accepted"
                type="number"
                min="0"
                step="0.01"
                value={operations.minimumOrderAmount}
                onChange={(e) => handleUpdateMinOrder(e.target.value)}
                admin
              />
            </div>
          </div>

          <div className="pa-pdp__label">Governorates</div>
          <div style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'
          }}>
            {EGYPT_GOVERNORATES.map((gov) => {
              const currentCost = operations.governorateCosts[gov.id] ?? gov.defaultCost
              const isEditing = editingGovernorate === gov.id

              return (
                <div key={gov.id} className="pa-callout" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <b>{gov.name}</b>
                      <div className="pa-subtitle" lang="ar">{gov.nameAr}</div>
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        className="pa-btn pa-btn--outline pa-btn--sm"
                        onClick={() => setEditingGovernorate(gov.id)}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <form
                      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleUpdateGovernorateCost(gov.id, e.target.elements.cost.value)
                      }}
                    >
                      <div className="pa-field" style={{ flex: 1 }}>
                        <label className="pa-label" htmlFor={`gov-cost-${gov.id}`}>Shipping cost</label>
                        <input
                          id={`gov-cost-${gov.id}`}
                          name="cost"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={currentCost}
                          className="pa-input pa-input--admin"
                          autoFocus
                        />
                      </div>
                      <button type="submit" className="pa-btn pa-btn--admin" disabled={operationsLoading}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="pa-btn pa-btn--outline pa-btn--admin"
                        onClick={() => setEditingGovernorate(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <b>{theme.symbol} {currentCost.toFixed(2)}</b>
                      <span className="pa-subtitle">Shipping</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------
          PRODUCTS
      ------------------------------------------------------------------ */}
      {activeTab === 'products' && (
        <div className="pa-tablebox">
          <div className="pa-pdp__label">
            Products <span className="pa-count">{filteredProducts.length}</span>
          </div>
          {searchQuery && <div className="pa-subtitle">Search results for "{searchQuery}"</div>}

          {filteredProducts.length === 0 ? (
            <div className="pa-callout" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <b>{searchQuery ? 'No products match your search' : 'No products found.'}</b>
                {!searchQuery && (
                  <button type="button" className="pa-btn pa-btn--admin" onClick={() => setShowForm(true)}>
                    Add first product
                  </button>
                )}
              </div>
            </div>
          ) : (
            <table className="pa-table">
              <thead>
                <tr className="pa-tr pa-tr--head">
                  <th>Image</th>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Colours</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="pa-tr">
                    <td>
                      <div className="pa-thumb">
                        {p.images?.[0]?.url && (
                          <img src={thumb(p.images[0].url, 120)} alt="" width={52} height={64} style={{ objectFit: 'cover' }} />
                        )}
                      </div>
                    </td>
                    <td>{loc(p.title, 'en')}</td>
                    <td><bdi>{formatEGP(p.price, 'en')}</bdi></td>
                    <td>{Number(p.totalStock ?? 0)}</td>
                    <td>{(p.availableColors ?? []).length}</td>
                    <td>{formatDate(p.updatedAt ?? p.createdAt)}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="pa-btn pa-btn--outline pa-btn--sm" onClick={() => handleEdit(p)}>Edit</button>
                      <button type="button" className="pa-btn pa-btn--outline pa-btn--sm" onClick={() => setDeleteConfirm(p)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------
          COUPONS LIST
      ------------------------------------------------------------------ */}
      {activeTab === 'coupons' && !showCouponForm && (
        <div className="pa-tablebox">
          <div className="pa-pdp__label">
            Coupons <span className="pa-count">{filteredCoupons.length}</span>
          </div>
          {searchQuery && <div className="pa-subtitle">Search results for "{searchQuery}"</div>}

          {filteredCoupons.length === 0 ? (
            <div className="pa-callout" style={{ marginTop: 12 }}>
              <b>No coupons found. Generate your first batch.</b>
            </div>
          ) : (
            <table className="pa-table">
              <thead>
                <tr className="pa-tr pa-tr--head">
                  <th>Code</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Expires</th>
                  <th>Used</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map((coupon) => {
                  const expired = isCouponExpired(coupon)
                  return (
                    <tr key={coupon.id} className="pa-tr">
                      <td style={{ direction: 'ltr', unicodeBidi: 'embed', fontWeight: 700 }}>{coupon.code}</td>
                      <td>
                        <StatusPill
                          status={coupon.isActive && !expired ? 'delivered' : 'cancelled'}
                          label={coupon.isActive && !expired ? 'Active' : expired ? 'Expired' : 'Revoked'}
                        />
                      </td>
                      <td><bdi>{formatEGP(coupon.amount, 'en')}</bdi></td>
                      <td>{expired ? 'â€”' : formatDate(coupon.expiresAt)}</td>
                      <td>{coupon.usedCount || 0}</td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="pa-btn pa-btn--outline pa-btn--sm"
                          onClick={() => handleToggleCouponStatus(coupon)}
                        >
                          {coupon.isActive ? 'Revoke' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="pa-btn pa-btn--outline pa-btn--sm"
                          onClick={() => setEditingCoupon(coupon)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="pa-btn pa-btn--outline pa-btn--sm"
                          onClick={() => setDeleteCouponConfirm(coupon)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------
          ORDERS
      ------------------------------------------------------------------ */}
      {activeTab === 'orders' && (
        <div className="pa-tablebox">
          <div className="pa-pdp__label">
            Pending EGP orders <span className="pa-count">{filteredOrders.length}</span>
          </div>
          {filteredOrders.length === 0 ? (
            <div className="pa-callout" style={{ marginTop: 12 }}>
              <b>No pending EGP orders.</b>
            </div>
          ) : (
            <table className="pa-table">
              <thead>
                <tr className="pa-tr pa-tr--head">
                  <th>Order details</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="pa-tr">
                    <td>
                      <div style={{ direction: 'ltr', unicodeBidi: 'embed', fontWeight: 700 }}>{order.orderId}</div>
                      <div className="pa-subtitle">{formatDate(order.createdAt)}</div>
                    </td>
                    <td>
                      <div>{order.customerName}</div>
                      <div className="pa-subtitle" style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{order.customerPhone}</div>
                      <div className="pa-subtitle">{order.customerAddress}</div>
                      {order.governorate && <div className="pa-subtitle">{order.governorate}</div>}
                    </td>
                    <td>{order.totalItems}</td>
                    <td><bdi>{formatEGP(order.totalPrice, 'en')}</bdi></td>
                    <td><StatusPill status="pending" /></td>
                    <td>
                      <button
                        type="button"
                        className="pa-btn pa-btn--admin"
                        onClick={() => setConfirmPaymentModal(order)}
                      >
                        Confirm for shipping
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------
          CONFIRMED
      ------------------------------------------------------------------ */}
      {activeTab === 'confirmed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="pa-pdp__label">
            Confirmed for shipping <span className="pa-count">{filteredConfirmedPayments.length}</span>
          </div>

          {filteredConfirmedPayments.length === 0 ? (
            <div className="pa-callout">
              <b>No confirmed EGP orders for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</b>
            </div>
          ) : (
            filteredConfirmedPayments.map((payment) => (
              <div key={payment.id} className="pa-block">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <b style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{payment.orderId}</b>
                    <div className="pa-subtitle">{formatDate(payment.confirmedAt)}</div>
                  </div>
                  <StatusPill
                    status={payment.shippingStatus === 'shipped' ? 'delivered' : 'pending'}
                    label={payment.shippingStatus === 'shipped' ? 'Shipped' : 'Pending'}
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 8 }}>
                  <div className="pa-field">
                    <div className="pa-pdp__label">Customer</div>
                    <div>{payment.customerName}</div>
                    <div className="pa-subtitle" style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{payment.customerPhone}</div>
                    <div className="pa-subtitle">{payment.customerAddress}</div>
                  </div>
                </div>
                {/* No shipping toggle: the original view was display-only for
                    `shippingStatus`; the write path never existed. */}

                <div className="pa-pdp__label" style={{ marginTop: 12 }}>Order items</div>
                <table className="pa-table">
                  <thead>
                    <tr className="pa-tr pa-tr--head">
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payment.items ?? []).map((item, idx) => (
                      <tr key={idx} className="pa-tr">
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td><bdi>{formatEGP((item.price ?? 0) * (item.quantity ?? 1), 'en')}</bdi></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <Summary
                  rows={[
                    { label: 'Total amount', value: formatEGP(payment.totalPrice, 'en'), tone: 'total' }
                  ]}
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------
          MODALS
      ------------------------------------------------------------------ */}
      {editingCoupon && (
        <div className="pa-sheet-backdrop" onClick={() => setEditingCoupon(null)}>
          <form
            className="pa-sheet"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleEditCoupon}
            role="dialog"
            aria-modal="true"
            aria-label="Edit coupon"
          >
            <div className="pa-sheet__title">Edit coupon</div>
            <div className="pa-subtitle">Update coupon details</div>
            <div className="pa-field">
              <span className="pa-label">Code</span>
              <b style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{editingCoupon.code}</b>
            </div>
            <Field
              id="ec-amount"
              label="Amount (EGP)"
              type="number"
              min="1"
              step="0.01"
              value={editingCoupon.amount}
              onChange={(e) => setEditingCoupon({ ...editingCoupon, amount: e.target.value })}
              required
            />
            <Field
              id="ec-duration"
              label="Duration (days)"
              type="number"
              min="1"
              value={editingCoupon.duration}
              onChange={(e) => setEditingCoupon({ ...editingCoupon, duration: e.target.value })}
              required
            />
            {couponError && <div className="pa-error" role="alert">{couponError}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="pa-btn pa-btn--admin">Save</button>
              <button
                type="button"
                className="pa-btn pa-btn--outline pa-btn--admin"
                onClick={() => setEditingCoupon(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteCouponConfirm && (
        <div className="pa-sheet-backdrop" onClick={() => setDeleteCouponConfirm(null)}>
          <div
            className="pa-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Delete coupon"
          >
            <div className="pa-sheet__title">Delete coupon</div>
            <div className="pa-subtitle">
              You are about to delete <b style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{deleteCouponConfirm.code}</b>. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="pa-btn pa-btn--admin"
                onClick={() => {
                  handleDeleteCoupon(deleteCouponConfirm.id)
                  setDeleteCouponConfirm(null)
                }}
              >
                Delete coupon
              </button>
              <button
                type="button"
                className="pa-btn pa-btn--outline pa-btn--admin"
                onClick={() => setDeleteCouponConfirm(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="pa-sheet-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div
            className="pa-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Delete product"
          >
            <div className="pa-sheet__title">Delete product</div>
            <div className="pa-subtitle">Are you sure you want to delete this product? This action cannot be undone.</div>
            <div className="pa-subtitle">You are about to delete: {deleteConfirm.name}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="pa-btn pa-btn--admin"
                onClick={() => {
                  handleDelete(deleteConfirm.id)
                  setDeleteConfirm(null)
                }}
              >
                Delete product
              </button>
              <button
                type="button"
                className="pa-btn pa-btn--outline pa-btn--admin"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPaymentModal && (
        <div className="pa-sheet-backdrop" onClick={() => setConfirmPaymentModal(null)}>
          <div
            className="pa-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm EGP order for shipping"
          >
            <div className="pa-sheet__title">Confirm EGP order for shipping</div>
            <div className="pa-subtitle">Review the cash on delivery order before confirming for shipping</div>

            <div className="pa-field">
              <div className="pa-pdp__label">Order information</div>
              <div style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{confirmPaymentModal.orderId}</div>
              <div className="pa-subtitle">{formatDate(confirmPaymentModal.createdAt)}</div>
              <StatusPill status="pending" label={confirmPaymentModal.status} />
            </div>

            <div className="pa-field">
              <div className="pa-pdp__label">Delivery</div>
              <div>{confirmPaymentModal.customerName}</div>
              <div className="pa-subtitle" style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{confirmPaymentModal.customerPhone}</div>
              <div className="pa-subtitle">{confirmPaymentModal.customerAddress}</div>
            </div>

            <div className="pa-pdp__label">Order items ({confirmPaymentModal.totalItems})</div>
            <table className="pa-table">
              <thead>
                <tr className="pa-tr pa-tr--head">
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {(confirmPaymentModal.items ?? []).map((item, idx) => (
                  <tr key={idx} className="pa-tr">
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td><bdi>{formatEGP((item.price ?? 0) * (item.quantity ?? 1), 'en')}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Summary
              rows={[
                { label: 'Total items', value: String(confirmPaymentModal.totalItems ?? 0) },
                { label: 'Currency', value: confirmPaymentModal.currency },
                { label: 'Total amount', value: formatEGP(confirmPaymentModal.totalPrice, 'en'), tone: 'total' }
              ]}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="pa-btn pa-btn--admin"
                onClick={() => {
                  onConfirmPayment(confirmPaymentModal)
                  setConfirmPaymentModal(null)
                }}
              >
                Confirm for shipping
              </button>
              <button
                type="button"
                className="pa-btn pa-btn--outline pa-btn--admin"
                onClick={() => setConfirmPaymentModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}



