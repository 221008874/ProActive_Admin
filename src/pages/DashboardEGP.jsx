import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import ProductForm from '../components/ProductForm'
import { useDashboardEGP } from '../hooks/useDashboardEGP'
import { themes } from '../config/themes'
import { createStyles } from '../styles/dashboardStyles'
import { db } from '../services/firebase'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
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
  { id: 'cairo', name: 'Cairo', nameAr: 'القاهرة', defaultCost: 50 },
  { id: 'giza', name: 'Giza', nameAr: 'الجيزة', defaultCost: 50 },
  { id: 'alexandria', name: 'Alexandria', nameAr: 'الإسكندرية', defaultCost: 60 },
  { id: 'qalyubia', name: 'Qalyubia', nameAr: 'القليوبية', defaultCost: 55 },
  { id: 'monufia', name: 'Monufia', nameAr: 'المنوفية', defaultCost: 60 },
  { id: 'gharbia', name: 'Gharbia', nameAr: 'الغربية', defaultCost: 65 },
  { id: 'dakahlia', name: 'Dakahlia', nameAr: 'الدقهلية', defaultCost: 65 },
  { id: 'sharkia', name: 'Sharqia', nameAr: 'الشرقية', defaultCost: 65 },
  { id: 'beheira', name: 'Beheira', nameAr: 'البحيرة', defaultCost: 70 },
  { id: 'kafr_sheikh', name: 'Kafr El Sheikh', nameAr: 'كفر الشيخ', defaultCost: 75 },
  { id: 'damietta', name: 'Damietta', nameAr: 'دمياط', defaultCost: 70 },
  { id: 'port_said', name: 'Port Said', nameAr: 'بورسعيد', defaultCost: 80 },
  { id: 'ismailia', name: 'Ismailia', nameAr: 'الإسماعيلية', defaultCost: 75 },
  { id: 'suez', name: 'Suez', nameAr: 'السويس', defaultCost: 75 },
  { id: 'matrouh', name: 'Matrouh', nameAr: 'مطروح', defaultCost: 100 },
  { id: 'north_sinai', name: 'North Sinai', nameAr: 'شمال سيناء', defaultCost: 120 },
  { id: 'south_sinai', name: 'South Sinai', nameAr: 'جنوب سيناء', defaultCost: 130 },
  { id: 'faiyum', name: 'Faiyum', nameAr: 'الفيوم', defaultCost: 70 },
  { id: 'beni_suef', name: 'Beni Suef', nameAr: 'بني سويف', defaultCost: 75 },
  { id: 'minya', name: 'Minya', nameAr: 'المنيا', defaultCost: 80 },
  { id: 'asyut', name: 'Asyut', nameAr: 'أسيوط', defaultCost: 85 },
  { id: 'sohag', name: 'Sohag', nameAr: 'سوهاج', defaultCost: 90 },
  { id: 'qena', name: 'Qena', nameAr: 'قنا', defaultCost: 95 },
  { id: 'luxor', name: 'Luxor', nameAr: 'الأقصر', defaultCost: 100 },
  { id: 'aswan', name: 'Aswan', nameAr: 'أسوان', defaultCost: 110 },
  { id: 'red_sea', name: 'Red Sea', nameAr: 'البحر الأحمر', defaultCost: 120 },
  { id: 'new_valley', name: 'New Valley', nameAr: 'الوادي الجديد', defaultCost: 130 }
]

export default function DashboardEGP() {
  const theme = themes.egp
  const otherTheme = themes.pi
  
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  
  const {
    isReady,
    isMobile,
    isTablet,
    products,
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
    dateButtons,
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
  } = useDashboardEGP()

  // FIXED: Simplified operations state - only storing shipping costs and minimum order
  const [operations, setOperations] = useState({
    governorateCosts: {}, // { governorateId: cost }
    minimumOrderAmount: 0
  })
  const [editingGovernorate, setEditingGovernorate] = useState(null)
  const [operationsLoading, setOperationsLoading] = useState(false)
const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const [hoveredProduct, setHoveredProduct] = useState(null)
  const [hoveredCard, setHoveredCard] = useState(null)
  const [hoveredButton, setHoveredButton] = useState(null)
  const [hoveredModalBtn, setHoveredModalBtn] = useState({})

  // Coupon states
  const [coupons, setCoupons] = useState([])
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [deleteCouponConfirm, setDeleteCouponConfirm] = useState(null)
  const [couponSearchQuery, setCouponSearchQuery] = useState('')
  const [couponFormData, setCouponFormData] = useState({
    amount: '',
    duration: '',
    quantity: 1
  })
  const [isGeneratingCoupons, setIsGeneratingCoupons] = useState(false)
  const [couponError, setCouponError] = useState(null)

  const s = createStyles(theme, otherTheme, isMobile, isTablet)

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
    // ═══════════════════════════════════════════════════════════
    // A4 PAGE GEOMETRY
    // A4 = 210 × 297 mm
    // ═══════════════════════════════════════════════════════════
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

    // Coupon card size — calculated to fill the grid exactly
    // CW = (210 - 11*2 - 7)  / 2 = 85.5 mm
    // CH = (297 - 24 - 13 - 11*2 - 6*3) / 4 = (238 - 18) / 4 = 55 mm
    const CW = (PW - PAD * 2 - GAPX) / COLS          // 85.5 mm
    const CH = (PH - HDR - FTR - PAD * 2 - GAPY * (ROWS - 1)) / ROWS  // 55 mm

    // ── Inside each card the layout is: ────────────────────────
    //
    //   ┌────────────────────────────────────────────────────────┐
    //   │  [  NAVY HEADER BAND — full width  ]  [ AMOUNT BADGE ]│  0–14
    //   ├──────────────────────── gold strip ────────────────────┤  14–15.5
    //   │                                    │                   │
    //   │  LEFT TEXT COLUMN (0–57mm wide)    │  RIGHT QR COLUMN  │  15.5–CH
    //   │  • COUPON CODE label               │  (57–CW, 28.5mm)  │
    //   │  • code value                      │  QR 28×28         │
    //   │  • gold underline                  │  "Scan to redeem" │
    //   │  • expiry pill                     │                   │
    //   │  • single-use pill                 │                   │
    //   │  • ACTIVE badge                    │                   │
    //   ├───────────────── gold bottom bar ──────────────────────┤  CH-1.5–CH
    //   └────────────────────────────────────────────────────────┘
    //
    //   Divider line between left/right at x = cx + 57

    const BAND_H  = 14    // navy top band height
    const DIVX    = 57    // x of left/right divider (from card left edge)
    const QR_SZ   = 28    // QR image side length
    const L_PAD   = 5     // left-column inner padding
    const R_PAD   = 4     // right-column inner padding from divider

    // ═══════════════════════════════════════════════════════════
    // COLOURS
    // ═══════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════
    // DRAW HELPERS
    // ═══════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════
    // PAGE HEADER
    // ═══════════════════════════════════════════════════════════
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
        `${activeUnusedCoupons.length} coupons  ·  Page ${pageNum + 1} / ${totalPages}`,
        PW - PAD, 20.5, { align: 'right' }
      )
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE FOOTER
    // ═══════════════════════════════════════════════════════════
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
        'Valid for single use only  ·  Non-transferable  ·  Scan QR code at checkout to apply discount',
        PW / 2, fy + 5.5, { align: 'center' }
      )
      pdf.setTextColor(...C.goldLt)
      pdf.text('elhamdindustriesegp.vercel.app', PW / 2, fy + 10.5, { align: 'center' })
    }

    // ═══════════════════════════════════════════════════════════
    // COUPON CARD
    // ═══════════════════════════════════════════════════════════
    const drawCoupon = async (coupon, cx, cy) => {
      const R = 3.5   // card corner radius

      // ── 1. Shadow
      fillR(cx + 1.5, cy + 1.5, CW, CH, R, C.shadow)

      // ── 2. Card base
      fillR(cx, cy, CW, CH, R, C.bg)

      // ── 3. Navy top band (full width, BAND_H=14mm)
      pdf.setFillColor(...C.navy)
      pdf.roundedRect(cx, cy, CW, BAND_H, R, R, 'F')
      // Square off the bottom edge of the rounded rect
      pdf.rect(cx, cy + BAND_H - R, CW, R, 'F')

      // ── 4. Gold strip right below band
      pdf.setFillColor(...C.gold)
      pdf.rect(cx, cy + BAND_H, CW, 1.5, 'F')

      // ── 5. Amount badge — right-aligned inside band
      //       Pill: 30×9mm, vertically centred in 14mm band → y = cy + 2.5
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

      // ── 6. Band text — left side (stays clear of badge)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(...C.white)
      pdf.text('EXCLUSIVE DISCOUNT', cx + L_PAD, cy + 6.5)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(5.5)
      pdf.setTextColor(...C.goldLt)
      pdf.text('MEMBER COUPON', cx + L_PAD, cy + 12)

      // ── 7. Vertical divider line (left/right column separator)
      //       Runs from below gold strip to above gold bottom bar
      const divX = cx + DIVX
      pdf.setDrawColor(...C.border)
      pdf.setLineWidth(0.3)
      pdf.line(divX, cy + BAND_H + 1.5, divX, cy + CH - 3)

      // ── 8. LEFT COLUMN content
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

      // Gold underline — constrained to left column width
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
      pdf.text('✓  Single use  ·  Non-transferable', LX + 2.5, cy + 41.5)

      // ACTIVE badge: y=cy+45
      fillR(LX, cy + 45, 20, 6, 2, C.green)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(5.5)
      pdf.setTextColor(...C.white)
      pdf.text('ACTIVE', LX + 10, cy + 49, { align: 'center' })

      // ── 9. RIGHT COLUMN — QR code
      //       Available width  = CW - DIVX - R_PAD*2 = 85.5-57-8 = 20.5mm  ← too narrow for 28mm QR
      //       ▶ Widen right column: shift divider to 52mm, QR=28mm
      //         divX = cx+52, QR starts at divX+R_PAD = cx+56, QR_SZ=28, right edge=cx+84 < cx+CW ✓

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

      // "Scan to redeem" below QR — centred in right column
      const scanY = QY + QR_SZ + 5
      if (scanY < cy + CH - 3) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(5)
        pdf.setTextColor(...C.slate)
        pdf.text('Scan to redeem', QX + QR_SZ / 2, scanY, { align: 'center' })
      }

      // ── 10. Gold bottom bar
      pdf.setFillColor(...C.gold)
      pdf.rect(cx + 6, cy + CH - 1.5, CW - 12, 1.5, 'F')

      // ── 11. Card border
      strokeR(cx, cy, CW, CH, R, C.border, 0.2)
    }

    // ═══════════════════════════════════════════════════════════
    // RENDER ALL PAGES
    // ═══════════════════════════════════════════════════════════
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

  // Filter coupons
  const filteredCoupons = coupons.filter(coupon => 
    coupon.code.toLowerCase().includes(couponSearchQuery.toLowerCase()) ||
    coupon.amount.toString().includes(couponSearchQuery)
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

  useEffect(() => {
    const styleId = 'dashboard-styles-egp'
    if (!document.getElementById(styleId)) {
      const styleSheet = document.createElement('style')
      styleSheet.id = styleId
      styleSheet.textContent = `
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(15, 23, 42, 0.4); } 50% { box-shadow: 0 0 0 10px rgba(15, 23, 42, 0); } }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 8px; }
        .sync-pulse { animation: pulse 2s infinite; }
        .dashboard-loading { min-height: 100vh; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); display: flex; align-items: center; justify-content: center; }
        .date-filter-scroll { display: flex; gap: 8px; overflow-x: auto; padding: 4px; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; scrollbar-width: thin; scrollbar-color: ${theme.color} #f1f5f9; }
        .date-filter-scroll::-webkit-scrollbar { height: 6px; }
        .date-filter-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
        .date-filter-scroll::-webkit-scrollbar-thumb { background: ${theme.color}; border-radius: 3px; }
        @media (max-width: 768px) { table { display: block; overflow-x: auto; white-space: nowrap; } }
      `
      document.head.appendChild(styleSheet)
    }
  }, [])

  if (!isReady) {
    return (
      <div className="dashboard-loading">
        <div style={{fontSize: '2rem', color: '#94a3b8', animation: 'spin 1s linear infinite'}}>⟳</div>
      </div>
    )
  }

  const onConfirmPayment = (order) => handleConfirmPayment(order, currentUser)

  // FIXED: Updated tabs array
  const navigationTabs = [
    { id: 'products', icon: '📦', label: 'Products', count: products.length },
    { id: 'orders', icon: '🛒', label: 'Orders', count: filteredOrders.length },
    { id: 'confirmed', icon: '✅', label: 'Confirmed', count: filteredConfirmedPayments.length },
    { id: 'coupons', icon: '🎫', label: 'Coupons', count: coupons.length },
    { id: 'operations', icon: '⚙️', label: 'Operations', count: 27 } // Fixed count
  ]

  return (
    <div style={s.dashboard}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerContent}>
          <div style={s.headerLeft}>
            <h1 style={s.headerTitle}>{theme.symbol} Dashboard</h1>
            <span style={s.headerBadge}>{theme.name}</span>
            {!isMobile && <span style={{...s.headerBadge, background: theme.lightBg, color: theme.textColor}}>📦 {collectionNames.products}</span>}
          </div>
          <button 
            onClick={handleLogout} 
            style={s.logoutBtn}
            onMouseEnter={(e) => { e.target.style.background = '#0f172a'; e.target.style.color = '#ffffff'; e.target.style.borderColor = '#0f172a'; e.target.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = '#0f172a'; e.target.style.borderColor = '#e2e8f0'; e.target.style.transform = 'translateY(0)' }}
          >
            🚪 Logout
          </button>
        </div>
      </header>

      <main style={s.main}>
        {/* Navigation Tabs */}
        <div style={s.navTabs}>
          {navigationTabs.map(tab => (
            <button key={tab.id} style={s.navTab(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
              {tab.icon} {tab.label}
              <span style={s.tabBadge(activeTab === tab.id)}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Search/Actions Bar */}
        {activeTab === 'products' && (
          <div style={s.actionsBar}>
            <button onClick={() => setShowForm(!showForm)} style={s.addBtn} onMouseEnter={() => setHoveredButton('add')} onMouseLeave={() => setHoveredButton(null)}>
              <span>➕</span>{showForm ? 'Cancel' : 'Add Product'}
            </button>
            <div style={s.searchBox}>
              <span style={{position: 'absolute', left: isMobile ? 10 : 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '1.2rem'}}>🔍</span>
              <input type="text" placeholder="Search products..." style={s.searchInput} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={(e) => { e.target.style.borderColor = theme.color; e.target.style.boxShadow = `0 0 0 3px ${theme.color}1a` }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)' }} />
            </div>
          </div>
        )}

        {(activeTab === 'orders' || activeTab === 'confirmed') && (
          <div style={s.actionsBar}>
            <div style={{...s.searchBox, maxWidth: '100%'}}>
              <span style={{position: 'absolute', left: isMobile ? 10 : 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '1.2rem'}}>🔍</span>
              <input type="text" placeholder={activeTab === 'orders' ? "Search by Order ID or product name..." : "Search confirmed orders..."} style={s.searchInput} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={(e) => { e.target.style.borderColor = theme.color; e.target.style.boxShadow = `0 0 0 3px ${theme.color}1a` }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)' }} />
            </div>
          </div>
        )}

        {/* Coupons Actions Bar */}
{activeTab === 'coupons' && (
  <div style={s.actionsBar}>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button 
        onClick={() => {
          setShowCouponForm(!showCouponForm)
          setEditingCoupon(null)
          setCouponFormData({ amount: '', duration: '', quantity: 1 })
        }} 
        style={{...s.addBtn, background: showCouponForm ? '#e11d48' : theme.gradient}}
        onMouseEnter={() => setHoveredButton('coupon-add')} 
        onMouseLeave={() => setHoveredButton(null)}
      >
        <span>{showCouponForm ? '✕' : '🎫'}</span>
        {showCouponForm ? 'Cancel' : 'Generate Coupons'}
      </button>
      
      {/* NEW: Export PDF Button */}
      <button 
        onClick={generateCouponsPDF}
        disabled={isGeneratingPDF}
        style={{
          ...s.addBtn,
          background: isGeneratingPDF ? '#94a3b8' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          opacity: isGeneratingPDF ? 0.7 : 1,
          cursor: isGeneratingPDF ? 'not-allowed' : 'pointer'
        }}
        onMouseEnter={() => setHoveredButton('pdf-export')} 
        onMouseLeave={() => setHoveredButton(null)}
      >
        <span>{isGeneratingPDF ? '⟳' : '📄'}</span>
        {isGeneratingPDF ? 'Generating...' : 'Export PDF'}
      </button>
    </div>
    
    <div style={s.searchBox}>
      <span style={{position: 'absolute', left: isMobile ? 10 : 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '1.2rem'}}>🔍</span>
      <input 
        type="text" 
        placeholder="Search coupons by code or amount..." 
        style={s.searchInput} 
        value={couponSearchQuery} 
        onChange={(e) => setCouponSearchQuery(e.target.value)}
        onFocus={(e) => { e.target.style.borderColor = theme.color; e.target.style.boxShadow = `0 0 0 3px ${theme.color}1a` }}
        onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)' }} 
      />
    </div>
  </div>
)}
        {/* Date Filter for Confirmed Orders */}
        {activeTab === 'confirmed' && (
          <div style={s.dateFilterContainer}>
            <div style={s.dateFilterLabel}>
              📅 Filter by Date
              <span style={{fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500}}>
                (Showing: {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
              </span>
            </div>
            <div className="date-filter-scroll">
              {dateButtons.map((btn) => (
                <button key={btn.date} style={s.dateButton(selectedDate === btn.date, btn.isToday)} onClick={() => setSelectedDate(btn.date)}
                  onMouseEnter={(e) => { if (selectedDate !== btn.date) { e.target.style.borderColor = theme.color; e.target.style.transform = 'translateY(-2px)' } }}
                  onMouseLeave={(e) => { if (selectedDate !== btn.date) { e.target.style.borderColor = '#e2e8f0'; e.target.style.transform = 'translateY(0)' } }}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Coupon Generation Form */}
        {activeTab === 'coupons' && showCouponForm && (
          <div style={s.formSection}>
            <div style={s.formSectionHeader}>
              <h3 style={s.formSectionTitle}>🎫 Generate New Coupons</h3>
              <button onClick={() => setShowCouponForm(false)} style={s.closeBtn}>✕ Close</button>
            </div>

            <form onSubmit={handleGenerateCoupons} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>

                {/* Amount */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Discount Amount (EGP) *
                  </label>
                  <input
                    type="number" min="1" step="0.01" required
                    value={couponFormData.amount}
                    onChange={(e) => setCouponFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="e.g., 50"
                    style={{
                      width: '100%', padding: '11px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8, fontSize: '0.92rem',
                      color: '#f0f0f8', outline: 'none', transition: 'all 0.2s'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = theme.color; e.target.style.boxShadow = `0 0 0 3px ${theme.color}22` }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {/* Duration */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Validity (Days) *
                  </label>
                  <input
                    type="number" min="1" max="365" required
                    value={couponFormData.duration}
                    onChange={(e) => setCouponFormData(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g., 30"
                    style={{
                      width: '100%', padding: '11px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8, fontSize: '0.92rem',
                      color: '#f0f0f8', outline: 'none', transition: 'all 0.2s'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = theme.color; e.target.style.boxShadow = `0 0 0 3px ${theme.color}22` }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {/* Quantity */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Quantity (1–100) *
                  </label>
                  <input
                    type="number" min="1" max="100" required
                    value={couponFormData.quantity}
                    onChange={(e) => setCouponFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    placeholder="e.g., 10"
                    style={{
                      width: '100%', padding: '11px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8, fontSize: '0.92rem',
                      color: '#f0f0f8', outline: 'none', transition: 'all 0.2s'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = theme.color; e.target.style.boxShadow = `0 0 0 3px ${theme.color}22` }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              {couponError && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.30)',
                  borderRadius: 8, color: '#fca5a5', fontSize: '0.88rem'
                }}>
                  ⚠️ {couponError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCouponForm(false)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 9, background: 'rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.65)', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem'
                  }}
                  onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.12)'; e.target.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.07)'; e.target.style.color = 'rgba(255,255,255,0.65)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingCoupons}
                  style={{
                    padding: '10px 26px',
                    border: 'none', borderRadius: 9,
                    background: theme.color,
                    color: '#ffffff', fontWeight: 700,
                    cursor: isGeneratingCoupons ? 'not-allowed' : 'pointer',
                    opacity: isGeneratingCoupons ? 0.6 : 1,
                    transition: 'all 0.2s', fontSize: '0.9rem',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    boxShadow: `0 4px 16px ${theme.color}44`
                  }}
                >
                  {isGeneratingCoupons
                    ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Generating...</>
                    : <>🎫 Generate {couponFormData.quantity > 1 ? `${couponFormData.quantity} Coupons` : 'Coupon'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        )}

       {/* Edit Coupon Modal */}
        {editingCoupon && (
          <div style={s.modalOverlay} onClick={() => setEditingCoupon(null)}>
            <div style={{...s.modal, maxWidth: 500}} onClick={(e) => e.stopPropagation()}>
              <div style={s.modalHeader}>
                <h3 style={s.modalTitle}>✏️ Edit Coupon</h3>
                <p style={s.modalSubtitle}>Update coupon details</p>
              </div>

              <form onSubmit={handleEditCoupon} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Code display */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Coupon Code
                  </label>
                  <div style={{
                    padding: '11px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '1rem',
                    color: '#ffffff',
                    fontWeight: 700,
                    letterSpacing: '1.5px'
                  }}>
                    {editingCoupon.code}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Amount */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Amount (EGP) *
                    </label>
                    <input
                      type="number" min="1" step="0.01" required
                      value={editingCoupon.amount}
                      onChange={(e) => setEditingCoupon(prev => ({ ...prev, amount: e.target.value }))}
                      style={{
                        width: '100%', padding: '11px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8, fontSize: '0.92rem',
                        color: '#f0f0f8', outline: 'none', transition: 'all 0.2s'
                      }}
                      onFocus={(e) => { e.target.style.borderColor = theme.color; e.target.style.boxShadow = `0 0 0 3px ${theme.color}22` }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>

                  {/* Duration */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Extend Duration (Days)
                    </label>
                    <input
                      type="number" min="1"
                      value={editingCoupon.duration}
                      onChange={(e) => setEditingCoupon(prev => ({ ...prev, duration: parseInt(e.target.value) || prev.duration }))}
                      style={{
                        width: '100%', padding: '11px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8, fontSize: '0.92rem',
                        color: '#f0f0f8', outline: 'none', transition: 'all 0.2s'
                      }}
                      onFocus={(e) => { e.target.style.borderColor = theme.color; e.target.style.boxShadow = `0 0 0 3px ${theme.color}22` }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>
                      Expires: {editingCoupon.expiresAt?.toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div style={s.modalActions}>
                  <button type="button" onClick={() => setEditingCoupon(null)}
                    style={s.modalBtn('cancel', hoveredModalBtn.cancel)}
                    onMouseEnter={() => setHoveredModalBtn({...hoveredModalBtn, cancel: true})}
                    onMouseLeave={() => setHoveredModalBtn({...hoveredModalBtn, cancel: false})}>
                    Cancel
                  </button>
                  <button type="submit"
                    style={s.modalBtn('confirm', hoveredModalBtn.confirm)}
                    onMouseEnter={() => setHoveredModalBtn({...hoveredModalBtn, confirm: true})}
                    onMouseLeave={() => setHoveredModalBtn({...hoveredModalBtn, confirm: false})}>
                    💾 Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Coupon Confirmation */}
        {deleteCouponConfirm && (
          <div style={s.modalOverlay} onClick={() => setDeleteCouponConfirm(null)}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <div style={s.modalHeader}>
                <h3 style={s.modalTitle}>🗑️ Delete Coupon</h3>
                <p style={s.modalSubtitle}>Are you sure you want to delete this coupon?</p>
              </div>
              <div style={s.modalSection}>
                <p style={s.deleteModalText}>
                  You are about to delete:
                  <span style={{...s.deleteModalProductName, fontFamily: 'monospace', letterSpacing: '1px'}}>
                    🎫 {deleteCouponConfirm.code}
                  </span>
                </p>
                <p style={{fontSize: '0.85rem', color: '#94a3b8'}}>
                  Amount: {theme.symbol} {deleteCouponConfirm.amount} | 
                  Status: {deleteCouponConfirm.isActive ? 'Active' : 'Inactive'}
                </p>
                {deleteCouponConfirm.usedCount > 0 && (
                  <p style={{fontSize: '0.85rem', color: '#f59e0b', marginTop: 8}}>
                    ⚠️ This coupon has been used {deleteCouponConfirm.usedCount} time(s)
                  </p>
                )}
              </div>
              <div style={s.modalActions}>
                <button 
                  onClick={() => setDeleteCouponConfirm(null)} 
                  style={s.modalBtn('cancel', hoveredModalBtn.cancel)} 
                  onMouseEnter={() => setHoveredModalBtn({...hoveredModalBtn, cancel: true})} 
                  onMouseLeave={() => setHoveredModalBtn({...hoveredModalBtn, cancel: false})}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteCoupon(deleteCouponConfirm.id)} 
                  style={{...s.modalBtn('confirm', hoveredModalBtn.confirm), background: hoveredModalBtn.confirm ? '#dc2626' : '#e11d48', borderColor: '#e11d48'}} 
                  onMouseEnter={() => setHoveredModalBtn({...hoveredModalBtn, confirm: true})} 
                  onMouseLeave={() => setHoveredModalBtn({...hoveredModalBtn, confirm: false})}
                >
                  🗑️ Delete Coupon
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Form */}
        {activeTab === 'products' && showForm && (
          <div style={s.formSection}>
            <div style={s.formSectionHeader}>
              <h3 style={s.formSectionTitle}>{editingProduct ? '✏️ Edit Product' : '✨ Add New Product'}</h3>
              <button onClick={() => { setShowForm(false); setEditingProduct(null) }} style={s.closeBtn}
                onMouseEnter={(e) => { e.target.style.background = '#e2e8f0'; e.target.style.color = '#0f172a' }}
                onMouseLeave={(e) => { e.target.style.background = '#f1f5f9'; e.target.style.color = '#64748b' }}>✕ Close</button>
            </div>
            <ProductForm product={editingProduct} onSuccess={handleSuccess} currency="EGP" collectionName={collectionNames.products} />
            
            {editingProduct && (
              <div style={{marginTop: 24, paddingTop: 24, borderTop: '2px solid #f1f5f9'}}>
                <button onClick={() => handleSyncProduct(editingProduct)} disabled={syncStatus === 'syncing'} style={s.syncButton(syncStatus)} className={syncStatus === 'syncing' ? 'sync-pulse' : ''}>
                  {syncStatus === 'syncing' && '⏳ Syncing...'}
                  {syncStatus === 'synced' && '✅ Synced!'}
                  {syncStatus === 'error' && '❌ Error'}
                  {!syncStatus && <>🔄 Sync to {otherCurrency} Store</>}
                </button>
                <p style={s.syncNote}>This will copy "{editingProduct.name}" to the <strong>{otherCurrency}</strong> products collection</p>
              </div>
            )}
          </div>
        )}

        {/* FIXED: Operations Section - Governorates Management */}
{activeTab === 'operations' && (
  <>
    <div style={s.sectionHeader}>
      <h2 style={s.sectionTitle}>⚙️ Operations Management</h2>
      <p style={s.sectionSubtitle}>Configure shipping costs for Egypt's 27 governorates</p>
    </div>

    {/* Minimum Order Amount Card */}
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '20px 24px',
      marginBottom: 24
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        gap: 16
      }}>
        <div>
          <h3 style={{
            margin: '0 0 6px 0',
            fontSize: '1rem',
            fontWeight: 700,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            💰 Minimum Order Amount
          </h3>
          <p style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.50)'
          }}>
            Orders below this amount will not be accepted
          </p>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{
              position: 'absolute',
              left: 14,
              color: theme.color,
              fontWeight: 700,
              fontSize: '1rem'
            }}>
              {theme.symbol}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={operations.minimumOrderAmount}
              onChange={(e) => handleUpdateMinOrder(e.target.value)}
              style={{
                width: 140,
                padding: '10px 14px 10px 34px',
                background: 'rgba(255,255,255,0.06)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'rgba(255,255,255,0.12)',
                borderRadius: 10,
                fontSize: '1rem',
                fontWeight: 700,
                color: '#ffffff',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.color
                e.target.style.boxShadow = `0 0 0 3px ${theme.color}22`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.12)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
        </div>
      </div>
    </div>

    {/* Governorates Grid */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
      gap: 12
    }}>
      {EGYPT_GOVERNORATES.map((gov) => {
        const currentCost = operations.governorateCosts[gov.id] ?? gov.defaultCost
        const isEditing = editingGovernorate === gov.id
        const isHov = hoveredCard === gov.id
        
        return (
          <div
            key={gov.id}
            style={{
              background: isHov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: isHov ? theme.color + '55' : 'rgba(255,255,255,0.09)',
              borderRadius: 12,
              padding: '16px 20px',
              transition: 'all 0.2s ease',
              transform: isHov ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: isHov ? `0 6px 24px rgba(0,0,0,0.3)` : 'none'
            }}
            onMouseEnter={() => setHoveredCard(gov.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12
            }}>
              <div>
                <h4 style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#ffffff'
                }}>
                  {gov.name}
                </h4>
                <span style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255,255,255,0.50)',
                  fontFamily: 'system-ui'
                }}>
                  {gov.nameAr}
                </span>
              </div>
              
              {!isEditing && (
                <button
                  onClick={() => setEditingGovernorate(gov.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.12)'
                    e.target.style.color = '#ffffff'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.06)'
                    e.target.style.color = 'rgba(255,255,255,0.75)'
                  }}
                >
                  ✏️ Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const input = e.target.elements.cost
                  handleUpdateGovernorateCost(gov.id, input.value)
                }}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center'
                }}
              >
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: theme.color,
                    fontWeight: 700
                  }}>
                    {theme.symbol}
                  </span>
                  <input
                    name="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={currentCost}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 32px',
                      background: 'rgba(255,255,255,0.08)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: theme.color + '50',
                      borderRadius: 8,
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={operationsLoading}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: 8,
                    background: theme.color,
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: operationsLoading ? 'not-allowed' : 'pointer',
                    opacity: operationsLoading ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  {operationsLoading ? '⟳' : '💾'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGovernorate(null)}
                  style={{
                    padding: '10px 12px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(255,255,255,0.14)',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.65)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </form>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  color: theme.color
                }}>
                  {theme.symbol} {currentCost.toFixed(2)}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.40)',
                  textTransform: 'uppercase'
                }}>
                  Shipping
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  </>
)}

        {/* Products Section */}
        {activeTab === 'products' && (
          <>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>📦 Products<span style={s.sectionCount}>{filteredProducts.length}</span></h2>
              {searchQuery && <p style={s.sectionSubtitle}>Search results for "{searchQuery}"</p>}
            </div>

            {isLoading && !dataLoaded ? (
              <div style={s.productsGrid}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={s.skeletonCard}>
                    <div className="skeleton" style={s.skeletonImage} />
                    <div style={s.skeletonContent}>
                      <div className="skeleton" style={s.skeletonLine('70%')} />
                      <div className="skeleton" style={s.skeletonLine('40%')} />
                      <div className="skeleton" style={s.skeletonLine('60%')} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {filteredProducts.length > 0 ? (
                  <div style={s.productsGrid}>
                    {filteredProducts.map(p => (
                      <div key={p.id} style={s.productCard(hoveredProduct === p.id)} onMouseEnter={() => setHoveredProduct(p.id)} onMouseLeave={() => setHoveredProduct(null)}>
                        <div style={s.productImageContainer}>
                          {p.syncedFrom && (
                            <div style={{ position: 'absolute', top: 12, right: 12, background: themes[p.syncedFrom.toLowerCase()]?.gradient || theme.gradient, color: '#ffffff', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, zIndex: 10 }}>
                              Synced from {p.syncedFrom}
                            </div>
                          )}
                          {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={s.productImage(hoveredProduct === p.id)} /> : <div style={s.productPlaceholder}>📦</div>}
                        </div>
                        <div style={s.productContent}>
                          <h3 style={s.productName}>{p.name}</h3>
                          <p style={s.productPrice}>{theme.symbol} {p.price?.toFixed(2)}</p>
                          <div style={s.productMeta}>
                            <span>📦 {p.piecesPerBox} pieces per box</span>
                            {p.flavors?.length > 0 && <span>🎨 {p.flavors.length} flavor{p.flavors.length !== 1 ? 's' : ''}</span>}
                            {p.stock !== undefined && <span style={{color: p.stock === 0 ? '#e11d48' : p.stock < 10 ? '#f59e0b' : '#059669', fontWeight: 600}}>📊 Stock: {p.stock}</span>}
                          </div>
                          <div style={s.productActions}>
                            <button onClick={() => handleEdit(p)} style={s.productBtn('edit', hoveredButton === `edit-${p.id}`)} onMouseEnter={() => setHoveredButton(`edit-${p.id}`)} onMouseLeave={() => setHoveredButton(null)}>Edit</button>
                            <button onClick={() => setDeleteConfirm(p)} style={s.productBtn('delete', hoveredButton === `delete-${p.id}`)} onMouseEnter={() => setHoveredButton(`delete-${p.id}`)} onMouseLeave={() => setHoveredButton(null)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={s.emptyState}>
                    <div style={s.emptyIcon}>📭</div>
                    <p style={s.emptyText}>{searchQuery ? 'No products match your search' : 'No products found. Create your first product!'}</p>
                    {!searchQuery && <button onClick={() => setShowForm(true)} style={s.emptyButton(hoveredButton === 'empty')} onMouseEnter={() => setHoveredButton('empty')} onMouseLeave={() => setHoveredButton(null)}><span>➕</span>Add First Product</button>}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Coupons Section */}
        {activeTab === 'coupons' && (
          <>
            <div style={s.sectionHeader}>
      <h2 style={s.sectionTitle}>
        🎫 Coupons
        <span style={s.sectionCount}>{filteredCoupons.length}</span>
      </h2>
      <p style={s.sectionSubtitle}>
        Manage discount coupons for EGP store • 
        <span style={{ color: theme.color, fontWeight: 600 }}>
          {' '}{coupons.filter(c => c.isActive && !isCouponExpired(c) && (c.usedCount || 0) === 0).length} ready to print
        </span>
      </p>
    </div>

            {filteredCoupons.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredCoupons.map(coupon => {
                  const expired = isCouponExpired(coupon)
                  const isHov = hoveredCard === coupon.id
                  return (
                    <div
                      key={coupon.id}
                      style={{
                        background: isHov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isHov ? theme.color + '55' : 'rgba(255,255,255,0.09)'}`,
                        borderLeft: `3px solid ${expired ? '#f59e0b' : !coupon.isActive ? '#ef4444' : theme.color}`,
                        borderRadius: 12,
                        padding: isMobile ? '14px 16px' : '16px 20px',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        gap: 16,
                        transition: 'all 0.2s ease',
                        opacity: (!coupon.isActive || expired) ? 0.65 : 1,
                        transform: isHov ? 'translateY(-2px)' : 'translateY(0)',
                        boxShadow: isHov ? `0 6px 24px rgba(0,0,0,0.3)` : 'none'
                      }}
                      onMouseEnter={() => setHoveredCard(coupon.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      {/* Coupon Code + Meta */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        
                        {/* Code + Status badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: isMobile ? '0.95rem' : '1.05rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            letterSpacing: '1.5px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            padding: '5px 12px',
                            borderRadius: 7
                          }}>
                            {coupon.code}
                          </span>

                          {coupon.isActive && !expired && (
                            <span style={{
                              background: 'rgba(16,185,129,0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16,185,129,0.25)',
                              padding: '2px 9px', borderRadius: 20,
                              fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>● Active</span>
                          )}
                          {!coupon.isActive && (
                            <span style={{
                              background: 'rgba(239,68,68,0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239,68,68,0.25)',
                              padding: '2px 9px', borderRadius: 20,
                              fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>● Inactive</span>
                          )}
                          {expired && (
                            <span style={{
                              background: 'rgba(245,158,11,0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245,158,11,0.25)',
                              padding: '2px 9px', borderRadius: 20,
                              fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>● Expired</span>
                          )}
                        </div>

                        {/* Meta row */}
                        <div style={{
                          display: 'flex', gap: 14, flexWrap: 'wrap',
                          fontSize: '0.76rem', color: 'rgba(255,255,255,0.50)'
                        }}>
                          <span>📅 Created: {coupon.createdAt?.toLocaleDateString('en-GB')}</span>
                          <span>⏳ Expires: {coupon.expiresAt?.toLocaleDateString('en-GB')}</span>
                          <span>🔁 Used: {coupon.usedCount || 0}×</span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{
                        textAlign: isMobile ? 'left' : 'center',
                        minWidth: 110,
                        padding: isMobile ? '8px 0 0' : '0',
                        borderTop: isMobile ? '1px solid rgba(255,255,255,0.07)' : 'none'
                      }}>
                        <div style={{
                          fontSize: isMobile ? '1.4rem' : '1.6rem',
                          fontWeight: 800,
                          color: theme.color,
                          letterSpacing: '-0.5px'
                        }}>
                          {theme.symbol} {coupon.amount?.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Discount
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggleCouponStatus(coupon)}
                          style={{
                            padding: '7px 13px',
                            borderRadius: 8,
                            border: `1px solid ${coupon.isActive ? 'rgba(255,255,255,0.14)' : theme.color + '55'}`,
                            background: coupon.isActive ? 'rgba(255,255,255,0.06)' : `${theme.color}18`,
                            color: coupon.isActive ? 'rgba(255,255,255,0.65)' : theme.color,
                            fontSize: '0.80rem', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)' }}
                          onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)' }}
                        >
                          {coupon.isActive ? '⏸ Deactivate' : '▶ Activate'}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => setEditingCoupon(coupon)}
                          style={{
                            padding: '7px 13px',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.14)',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.75)',
                            fontSize: '0.80rem', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(255,255,255,0.12)'
                            e.target.style.color = '#ffffff'
                            e.target.style.transform = 'translateY(-1px)'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(255,255,255,0.06)'
                            e.target.style.color = 'rgba(255,255,255,0.75)'
                            e.target.style.transform = 'translateY(0)'
                          }}
                        >
                          ✏️ Edit
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteCouponConfirm(coupon)}
                          style={{
                            padding: '7px 13px',
                            borderRadius: 8,
                            border: '1px solid rgba(239,68,68,0.25)',
                            background: 'rgba(239,68,68,0.10)',
                            color: '#f87171',
                            fontSize: '0.80rem', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#ef4444'
                            e.target.style.borderColor = '#ef4444'
                            e.target.style.color = '#ffffff'
                            e.target.style.transform = 'translateY(-1px)'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(239,68,68,0.10)'
                            e.target.style.borderColor = 'rgba(239,68,68,0.25)'
                            e.target.style.color = '#f87171'
                            e.target.style.transform = 'translateY(0)'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>🎫</div>
                <p style={s.emptyText}>
                  {couponSearchQuery ? 'No coupons match your search' : 'No coupons generated yet'}
                </p>
                {!couponSearchQuery && (
                  <button
                    onClick={() => setShowCouponForm(true)}
                    style={s.emptyButton(hoveredButton === 'empty-coupon')}
                    onMouseEnter={() => setHoveredButton('empty-coupon')}
                    onMouseLeave={() => setHoveredButton(null)}
                  >
                    <span>🎫</span>Generate First Coupon
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Orders Section - EGP specific with customer details */}
        {activeTab === 'orders' && (
          <>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>🛒 Pending EGP Orders<span style={s.sectionCount}>{filteredOrders.length}</span></h2>
              <p style={s.sectionSubtitle}>Cash on delivery orders awaiting confirmation for shipping</p>
            </div>

            {filteredOrders.length > 0 ? (
              <div style={s.ordersContainer}>
                <table style={s.ordersTable}>
                  <thead>
                    <tr>
                      <th style={s.tableHeader}>Order Details</th>
                      <th style={s.tableHeader}>Customer</th>
                      <th style={s.tableHeader}>Items</th>
                      <th style={s.tableHeader}>Total</th>
                      <th style={s.tableHeader}>Date</th>
                      <th style={s.tableHeader}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => (
                      <tr key={order.id}>
                        <td style={s.tableCell}>
                          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                            <span style={s.orderId}>{order.orderId}</span>
                            <span style={s.statusBadge(order.status)}>⏳ Pending</span>
                          </div>
                        </td>
                        
                        <td style={s.tableCell}>
                          <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                            <span style={{fontWeight: 600, color: '#0f172a'}}>{order.customerName}</span>
                            <span style={{fontSize: '0.85rem', color: '#64748b'}}>📞 {order.customerPhone}</span>
                            {order.customerAddress && (
                              <span style={{fontSize: '0.8rem', color: '#94a3b8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                📍 {order.customerAddress}
                              </span>
                            )}
                            {order.customerLocation && (
                              <a 
                                href={`https://www.google.com/maps?q=${order.customerLocation.latitude},${order.customerLocation.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{fontSize: '0.75rem', color: theme.color, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4}}
                              >
                                🗺️ View Map
                              </a>
                            )}
                          </div>
                        </td>

                        <td style={{...s.tableCell, ...s.orderItems}}>
                          {order.items?.map((item, idx) => (
                            <div key={idx} style={s.orderItem}>
                              <div style={s.itemPlaceholder}>📦</div>
                              <div style={s.itemDetails}>
                                <span style={s.itemName}>{item.name}</span>
                                <span style={s.itemMeta}>{item.quantity} × {theme.symbol} {item.price?.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </td>
                        
                        <td style={s.tableCell}>
                          <span style={s.orderTotal}>{theme.symbol} {order.totalPrice?.toFixed(2)}</span>
                          <span style={s.currencyBadge}>{order.currency}</span>
                        </td>
                        
                        <td style={s.tableCell}>{formatDate(order.createdAt)}</td>
                        
                        <td style={s.tableCell}>
                          <button onClick={() => setConfirmPaymentModal(order)} style={s.confirmBtn(hoveredButton === `confirm-${order.id}`)} onMouseEnter={() => setHoveredButton(`confirm-${order.id}`)} onMouseLeave={() => setHoveredButton(null)}>✓ Confirm</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>📭</div>
                <p style={s.emptyText}>{searchQuery ? 'No orders match your search' : 'No pending EGP orders'}</p>
              </div>
            )}
          </>
        )}

        {/* Confirmed Payments Section - EGP specific with customer details */}
        {activeTab === 'confirmed' && (
          <>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>✅ Confirmed EGP Orders<span style={s.sectionCount}>{filteredConfirmedPayments.length}</span></h2>
              <p style={s.sectionSubtitle}>Cash on delivery orders confirmed and ready for shipping</p>
            </div>

            {filteredConfirmedPayments.length > 0 ? (
              <div style={s.confirmedGrid}>
                {filteredConfirmedPayments.map(payment => (
                  <div key={payment.id} style={s.confirmedCard(hoveredCard === payment.id)} onMouseEnter={() => setHoveredCard(payment.id)} onMouseLeave={() => setHoveredCard(null)}>
                    <div style={s.confirmedHeader}>
                      <div style={s.confirmedIds}>
                        <div style={s.confirmedOrderId}>{payment.orderId}</div>
                      </div>
                      <span style={s.confirmedDate}>✓ {formatDate(payment.confirmedAt)}</span>
                    </div>

                    {/* Customer Info for EGP */}
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      marginBottom: 16
                    }}>
                      {/* Header row */}
                      <div style={{
                        padding: '8px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.40)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        Customer Details
                      </div>

                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                        {/* Name */}
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'nowrap' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: `${theme.color}18`,
                            border: `1px solid ${theme.color}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.8rem'
                          }}>👤</div>
                          <span style={{
                            fontWeight: 700, fontSize: '0.88rem', color: '#ffffff',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            {payment.customerInfo?.customerName || payment.customerName}
                          </span>
                        </div>

                        {/* Phone */}
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'nowrap' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: 'rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.22)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.8rem'
                          }}>📞</div>
                          <span style={{
                            fontSize: '0.82rem', color: 'rgba(255,255,255,0.80)',
                            fontFamily: "'JetBrains Mono', monospace",
                            letterSpacing: '0.3px', whiteSpace: 'nowrap'
                          }}>
                            {payment.customerInfo?.customerPhone || payment.customerPhone}
                          </span>
                        </div>

                        {/* Address */}
                        {(payment.customerInfo?.customerAddress || payment.customerAddress) && (
                          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 10, flexWrap: 'nowrap' }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                              background: 'rgba(245,158,11,0.12)',
                              border: '1px solid rgba(245,158,11,0.22)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem', marginTop: 2
                            }}>📍</div>
                            <span style={{
                              fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)',
                              lineHeight: 1.5, flex: 1
                            }}>
                              {payment.customerInfo?.customerAddress || payment.customerAddress}
                            </span>
                          </div>
                        )}

                        {(payment.customerInfo?.customerLocation || payment.customerLocation) && (
                          <a
                            href={`https://www.google.com/maps?q=${(payment.customerInfo?.customerLocation || payment.customerLocation).latitude},${(payment.customerInfo?.customerLocation || payment.customerLocation).longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', flexDirection: 'row', alignItems: 'center',
                              gap: 6, padding: '6px 12px',
                              background: `${theme.color}15`,
                              border: `1px solid ${theme.color}30`,
                              borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                              color: theme.color, textDecoration: 'none',
                              alignSelf: 'flex-start', whiteSpace: 'nowrap'
                            }}
                          >
                            🗺️ Open in Google Maps
                          </a>
                        )}

                      </div>
                    </div>

                    <div style={s.confirmedSection}>
                      <div style={s.confirmedLabel}>Order Items</div>
                      <div style={s.confirmedItemsList}>
                        {payment.items?.map((item, idx) => (
                          <div key={idx} style={{...s.confirmedItem, borderBottom: idx === payment.items.length - 1 ? 'none' : '1px solid #e2e8f0'}}>
                            <div style={s.confirmedItemInfo}>
                              <div style={{fontSize: '1.5rem'}}>📦</div>
                              <div>
                                <div style={s.confirmedItemName}>{item.name}</div>
                                <div style={s.confirmedItemQty}>Qty: {item.quantity}</div>
                              </div>
                            </div>
                            <div style={s.confirmedItemPrice}>{theme.symbol} {(item.price * item.quantity).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={s.confirmedTotal}>
                      <span style={s.confirmedTotalLabel}>Total Amount</span>
                      <span style={s.confirmedTotalAmount}>{theme.symbol} {payment.totalPrice?.toFixed(2)}</span>
                    </div>

                    <div style={s.confirmedMeta}>
                      <div style={s.confirmedMetaItem}>📅 Confirmed: {formatDate(payment.confirmedAt)}</div>
                      <div style={s.confirmedMetaItem}>👤 By: {payment.confirmedByEmail}</div>
                      <div style={{...s.confirmedMetaItem, marginTop: 8}}>
                        <span style={s.shippingStatus(payment.shippingStatus)}>🚚 {payment.shippingStatus === 'shipped' ? 'Shipped' : 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>📭</div>
                <p style={s.emptyText}>No confirmed EGP orders for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                <p style={{fontSize: '0.9rem', color: '#94a3b8', marginTop: 8}}>Try selecting a different date from the filter above</p>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div style={s.modalOverlay} onClick={() => setDeleteConfirm(null)}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <div style={s.modalHeader}>
                <h3 style={s.modalTitle}>🗑️ Delete Product</h3>
                <p style={s.modalSubtitle}>Are you sure you want to delete this product? This action cannot be undone.</p>
              </div>
              <div style={s.modalSection}>
                <p style={s.deleteModalText}>You are about to delete:<span style={s.deleteModalProductName}>📦 {deleteConfirm.name}</span></p>
                <p style={{fontSize: '0.85rem', color: '#94a3b8'}}>Price: {theme.symbol} {deleteConfirm.price?.toFixed(2)} | ID: {deleteConfirm.id}</p>
              </div>
              <div style={s.modalActions}>
                <button onClick={() => setDeleteConfirm(null)} style={s.modalBtn('cancel', hoveredModalBtn.cancel)} onMouseEnter={() => setHoveredModalBtn({...hoveredModalBtn, cancel: true})} onMouseLeave={() => setHoveredModalBtn({...hoveredModalBtn, cancel: false})}>Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm.id)} style={{...s.modalBtn('confirm', hoveredModalBtn.confirm), background: hoveredModalBtn.confirm ? '#dc2626' : '#e11d48', borderColor: '#e11d48'}} onMouseEnter={() => setHoveredModalBtn({...hoveredModalBtn, confirm: true})} onMouseLeave={() => setHoveredModalBtn({...hoveredModalBtn, confirm: false})}>🗑️ Delete Product</button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Payment Modal - EGP specific with customer details */}
        {confirmPaymentModal && (
          <div style={s.modalOverlay} onClick={() => setConfirmPaymentModal(null)}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <div style={s.modalHeader}>
                <h3 style={s.modalTitle}>✅ Confirm EGP Order for Shipping</h3>
                <p style={s.modalSubtitle}>Review cash on delivery order before confirming for shipping</p>
              </div>

              <div style={s.modalSection}>
                <div style={s.modalSectionTitle}>Order Information</div>
                <div style={{display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12}}>
                  <div>
                    <div style={{fontSize: '0.85rem', color: '#64748b'}}>Order ID</div>
                    <div style={{fontWeight: 700, color: '#0f172a'}}>{confirmPaymentModal.orderId}</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.85rem', color: '#64748b'}}>Customer Name</div>
                    <div style={{fontWeight: 600}}>{confirmPaymentModal.customerName}</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.85rem', color: '#64748b'}}>Phone</div>
                    <div>{confirmPaymentModal.customerPhone}</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.85rem', color: '#64748b'}}>Order Date</div>
                    <div>{formatDate(confirmPaymentModal.createdAt)}</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.85rem', color: '#64748b'}}>Status</div>
                    <span style={s.statusBadge(confirmPaymentModal.status)}>{confirmPaymentModal.status}</span>
                  </div>
                </div>

                {/* EGP Customer Location Map */}
                {confirmPaymentModal.customerLocation && (
                  <div style={{marginTop: 16}}>
                    <div style={{fontSize: '0.85rem', color: '#64748b', marginBottom: 8}}>Delivery Location</div>
                    <div style={{height: 150, borderRadius: 8, overflow: 'hidden', border: `2px solid ${theme.borderColor}`}}>
                      <iframe
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${confirmPaymentModal.customerLocation.longitude - 0.01}%2C${confirmPaymentModal.customerLocation.latitude - 0.01}%2C${confirmPaymentModal.customerLocation.longitude + 0.01}%2C${confirmPaymentModal.customerLocation.latitude + 0.01}&marker=${confirmPaymentModal.customerLocation.latitude}%2C${confirmPaymentModal.customerLocation.longitude}`}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Customer Location"
                      />
                    </div>
                    <a 
                      href={`https://www.google.com/maps?q=${confirmPaymentModal.customerLocation.latitude},${confirmPaymentModal.customerLocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.85rem', color: theme.color, textDecoration: 'none'}}
                    >
                      🗺️ Open in Google Maps
                    </a>
                  </div>
                )}

                {/* EGP Address */}
                {confirmPaymentModal.customerAddress && (
                  <div style={{marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8}}>
                    <div style={{fontSize: '0.85rem', color: '#64748b', marginBottom: 4}}>Delivery Address</div>
                    <div style={{fontSize: '0.95rem', color: '#0f172a', fontWeight: 500}}>{confirmPaymentModal.customerAddress}</div>
                  </div>
                )}
              </div>

              <div style={s.modalSection}>
                <div style={s.modalSectionTitle}>Order Items ({confirmPaymentModal.totalItems})</div>
                <div style={s.modalItems}>
                  {confirmPaymentModal.items?.map((item, idx) => (
                    <div key={idx} style={s.modalItem}>
                      <div style={s.modalItemInfo}>
                        <div style={{fontSize: '1.5rem'}}>📦</div>
                        <div style={s.modalItemDetails}>
                          <h4 style={s.modalItemDetailsH4}>{item.name}</h4>
                          <p style={s.modalItemDetailsP}>Qty: {item.quantity} × {theme.symbol} {item.price?.toFixed(2)}</p>
                        </div>
                      </div>
                      <div style={s.modalItemPrice}>{theme.symbol} {(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{...s.modalSection, ...s.modalSummary}}>
                <div style={s.modalSummaryRow}><span>Total Items:</span><span>{confirmPaymentModal.totalItems}</span></div>
                <div style={s.modalSummaryRow}><span>Currency:</span><span>{confirmPaymentModal.currency}</span></div>
                <div style={{...s.modalSummaryRow, ...s.modalSummaryRowLast}}><span>Total Amount:</span><span>{theme.symbol} {confirmPaymentModal.totalPrice?.toFixed(2)}</span></div>
              </div>

              <div style={s.modalActions}>
                <button onClick={() => setConfirmPaymentModal(null)} style={s.modalBtn('cancel', hoveredModalBtn.cancel)} onMouseEnter={() => setHoveredModalBtn({...hoveredModalBtn, cancel: true})} onMouseLeave={() => setHoveredModalBtn({...hoveredModalBtn, cancel: false})}>Cancel</button>
                <button onClick={() => onConfirmPayment(confirmPaymentModal)} style={s.modalBtn('confirm', hoveredModalBtn.confirm)} onMouseEnter={() => setHoveredModalBtn({...hoveredModalBtn, confirm: true})} onMouseLeave={() => setHoveredModalBtn({...hoveredModalBtn, confirm: false})}>✓ Confirm for Shipping</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}