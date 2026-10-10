export const createStyles = (theme, otherTheme, isMobile, isTablet) => ({
  dashboard: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#e8e8f0',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    overflow: 'hidden'
  },
  header: {
    display: 'none'  // hidden — switcher bar already shows store name
  },
  headerContent: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? 10 : 16,
    flexWrap: 'wrap'
  },
  headerTitle: {
    fontSize: isMobile ? '0.88rem' : '0.95rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.3px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    whiteSpace: 'nowrap'
  },
  headerBadge: {
    background: `linear-gradient(135deg, ${theme.color}22, ${theme.color}11)`,
    color: theme.color,
    border: `1px solid ${theme.color}33`,
    padding: '3px 9px',
    borderRadius: 6,
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    whiteSpace: 'nowrap'
  },
  logoutBtn: {
    padding: isMobile ? '5px 11px' : '6px 14px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.80)',   // ↑ was 0.6
    fontWeight: 600,
    fontSize: isMobile ? '0.8rem' : '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    letterSpacing: '0.2px'
  },
  main: {
    padding: isMobile ? '20px 14px' : isTablet ? '28px 20px' : '36px 32px',
    maxWidth: 1400,
    margin: '0 auto',
    width: '100%'
  },
  navTabs: {
    display: 'flex',
    gap: 4,
    marginBottom: isMobile ? 24 : 36,
    background: 'rgba(255,255,255,0.05)',
    padding: 4,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.09)',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch'
  },
  navTab: (isActive) => ({
    padding: isMobile ? '10px 16px' : '11px 28px',
    border: 'none',
    background: isActive ? theme.color : 'transparent',
    color: isActive ? '#ffffff' : 'rgba(255,255,255,0.65)',  // ↑ was 0.45
    fontWeight: 700,
    fontSize: isMobile ? '0.82rem' : '0.9rem',
    cursor: 'pointer',
    borderRadius: 9,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? 6 : 8,
    whiteSpace: 'nowrap',
    boxShadow: isActive ? `0 2px 12px ${theme.color}55` : 'none',
    flexShrink: 0,
    letterSpacing: '0.2px'
  }),
  tabBadge: (isActive) => ({
    background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',  // ↑ was 0.08
    color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',  // ↑ was 0.4
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: '0.72rem',
    minWidth: 22,
    textAlign: 'center',
    display: isMobile ? 'none' : 'inline-block',
    fontWeight: 700
  }),
  actionsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: isMobile ? 10 : 16,
    marginBottom: isMobile ? 24 : 32,
    flexWrap: isMobile ? 'wrap' : 'nowrap'
  },
  addBtn: {
    padding: isMobile ? '10px 18px' : '11px 22px',
    background: theme.color,
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: isMobile ? '0.85rem' : '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: `0 4px 16px ${theme.color}44`,
    whiteSpace: 'nowrap',
    flex: isMobile ? '1 1 auto' : 'auto',
    letterSpacing: '0.2px'
  },
  searchBox: {
    flex: 1,
    maxWidth: isMobile ? '100%' : 420,
    position: 'relative',
    minWidth: isMobile ? '100%' : 0
  },
  searchInput: {
    width: '100%',
    padding: isMobile ? '10px 14px 10px 38px' : '11px 16px 11px 42px',
    border: '1px solid rgba(255,255,255,0.14)',  // ↑ was 0.10
    borderRadius: 10,
    fontSize: isMobile ? '0.88rem' : '0.92rem',
    background: 'rgba(255,255,255,0.07)',  // ↑ was 0.05
    color: '#f0f0f8',  // brighter than before
    transition: 'all 0.2s ease',
    outline: 'none',
    letterSpacing: '0.2px'
  },
  formSection: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: isMobile ? 20 : 32,
    marginBottom: isMobile ? 28 : 40,
    backdropFilter: 'blur(10px)',
    animation: 'slideDown 0.35s ease-out'
  },
  formSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: '1px solid rgba(255,255,255,0.09)',
    gap: 12,
    flexWrap: isMobile ? 'wrap' : 'nowrap'
  },
  formSectionTitle: {
    fontSize: isMobile ? '1.05rem' : '1.2rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.3px'
  },
  closeBtn: {
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.70)',  // ↑ was 0.5
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '0.85rem'
  },
  sectionHeader: {
    marginBottom: isMobile ? 20 : 28
  },
  sectionTitle: {
    fontSize: isMobile ? '1.15rem' : '1.35rem',
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? 8 : 12,
    flexWrap: 'wrap',
    letterSpacing: '-0.5px'
  },
  sectionCount: {
    background: `${theme.color}22`,
    color: theme.color,
    border: `1px solid ${theme.color}44`,  // ↑ was 33
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: isMobile ? '0.72rem' : '0.8rem',
    fontWeight: 700
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.65)',  // ↑ was 0.55
    fontSize: isMobile ? '0.82rem' : '0.9rem',
    letterSpacing: '0.1px'
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(270px, 1fr))',
    gap: isMobile ? 14 : isTablet ? 18 : 22
  },
  productCard: (isHovered) => ({
    background: isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',  // ↑ both
    border: `1px solid ${isHovered ? theme.color + '55' : 'rgba(255,255,255,0.10)'}`,
    borderRadius: 14,
    overflow: 'hidden',
    transition: 'all 0.25s ease',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: isHovered ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${theme.color}22` : '0 2px 8px rgba(0,0,0,0.2)',
    transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
    animation: 'fadeIn 0.35s ease-out'
  }),
  productImageContainer: {
    width: '100%',
    height: isMobile ? 190 : 220,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    position: 'relative'
  },
  productImage: (isHovered) => ({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.4s ease',
    transform: isHovered ? 'scale(1.06)' : 'scale(1)'
  }),
  productPlaceholder: {
    fontSize: isMobile ? '2.5rem' : '3rem',
    animation: 'float 3s ease-in-out infinite',
    opacity: 0.6  // ↑ was 0.5
  },
  productContent: {
    padding: isMobile ? 16 : 20,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? 10 : 14
  },
  productName: {
    fontSize: isMobile ? '0.95rem' : '1rem',
    fontWeight: 700,
    color: '#ffffff',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    letterSpacing: '-0.2px'
  },
  productPrice: {
    fontSize: isMobile ? '1.3rem' : '1.45rem',
    fontWeight: 800,
    color: theme.color,
    letterSpacing: '-0.5px'
  },
  productMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: isMobile ? '0.78rem' : '0.83rem',
    color: 'rgba(255,255,255,0.70)'  // ↑ was 0.55
  },
  productActions: {
    display: 'flex',
    gap: 10,
    marginTop: 'auto'
  },
  productBtn: (type, isHovered) => ({
    flex: 1,
    padding: isMobile ? '8px 10px' : '9px 14px',
    border: `1px solid ${type === 'edit' ? 'rgba(255,255,255,0.20)' : '#e11d4844'}`,  // ↑
    borderRadius: 8,
    fontWeight: 700,
    fontSize: isMobile ? '0.78rem' : '0.83rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: isHovered ? (type === 'edit' ? 'rgba(255,255,255,0.12)' : '#e11d4828') : 'transparent',
    color: isHovered ? (type === 'edit' ? '#ffffff' : '#fca5a5') : (type === 'edit' ? 'rgba(255,255,255,0.75)' : '#f87171'),  // ↑ both
    transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
    letterSpacing: '0.2px'
  }),
  ordersContainer: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 14,
    overflow: isMobile ? 'auto' : 'hidden',
    WebkitOverflowScrolling: 'touch'
  },
  ordersTable: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: isMobile ? '900px' : 'auto'
  },
  tableHeader: {
    background: 'rgba(255,255,255,0.06)',  // ↑ was 0.04
    padding: isMobile ? '12px 10px' : '14px 18px',
    textAlign: 'left',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.55)',  // ↑ was 0.35
    fontSize: isMobile ? '0.72rem' : '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    borderBottom: '1px solid rgba(255,255,255,0.09)',
    whiteSpace: 'nowrap'
  },
  tableCell: {
    padding: isMobile ? '14px 10px' : '18px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',  // ↑ was 0.05
    color: 'rgba(255,255,255,0.90)',  // ↑ was 0.85
    fontSize: isMobile ? '0.83rem' : '0.88rem',
    verticalAlign: 'top'
  },
  orderId: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: isMobile ? '0.72rem' : '0.78rem',
    color: 'rgba(255,255,255,0.65)',  // ↑ was 0.5
    background: 'rgba(255,255,255,0.08)',  // ↑ was 0.06
    padding: '4px 8px',
    borderRadius: 5,
    display: 'inline-block',
    letterSpacing: '0.3px'
  },
  paymentId: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.60)',  // ↑ was 0.45
    marginTop: 4,
    fontFamily: "'JetBrains Mono', monospace"
  },
  orderItems: {
    maxWidth: isMobile ? 150 : 260
  },
  orderItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: isMobile ? '0.8rem' : '0.85rem',
    color: 'rgba(255,255,255,0.80)',  // ↑ was 0.7
    marginBottom: 6,
    padding: '4px 0'
  },
  itemPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 7,
    background: `${theme.color}22`,
    border: `1px solid ${theme.color}33`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    flexShrink: 0
  },
  itemDetails: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  itemName: {
    fontWeight: 600,
    color: 'rgba(255,255,255,0.95)',  // ↑ was 0.9
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  itemMeta: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.65)'  // ↑ was 0.5
  },
  orderTotal: {
    fontWeight: 800,
    fontSize: isMobile ? '1rem' : '1.1rem',
    color: theme.color,
    display: 'block',
    letterSpacing: '-0.3px'
  },
  currencyBadge: {
    display: 'inline-block',
    background: `${theme.color}22`,
    color: theme.color,
    border: `1px solid ${theme.color}44`,
    padding: '2px 8px',
    borderRadius: 5,
    fontSize: '0.7rem',
    fontWeight: 700,
    marginTop: 4,
    letterSpacing: '0.5px'
  },
  statusBadge: (status) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: status === 'completed' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.18)',  // ↑
    color: status === 'completed' ? '#34d399' : '#fbbf24',  // ↑ brighter variants
    border: `1px solid ${status === 'completed' ? '#10b98133' : '#f59e0b33'}`
  }),
  confirmBtn: (isHovered) => ({
    padding: isMobile ? '8px 14px' : '9px 18px',
    background: isHovered ? theme.color : `${theme.color}22`,
    color: isHovered ? '#ffffff' : theme.color,
    border: `1px solid ${theme.color}55`,  // ↑ was 44
    borderRadius: 8,
    fontWeight: 700,
    fontSize: isMobile ? '0.78rem' : '0.82rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
    boxShadow: isHovered ? `0 4px 16px ${theme.color}44` : 'none',
    whiteSpace: 'nowrap',
    letterSpacing: '0.2px'
  }),
  confirmedGrid: {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : 'repeat(auto-fill, minmax(370px, 1fr))',
    gap: isMobile ? 14 : isTablet ? 18 : 22
  },
  confirmedCard: (isHovered) => ({
    background: isHovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${isHovered ? theme.color + '55' : 'rgba(255,255,255,0.09)'}`,
    borderRadius: 14,
    padding: isMobile ? 16 : 22,
    boxShadow: isHovered ? `0 8px 28px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'all 0.25s ease',
    borderLeft: `3px solid ${theme.color}`,
    animation: 'fadeIn 0.35s ease-out',
    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)'
  }),
  confirmedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottom: '1px solid rgba(255,255,255,0.09)',
    gap: 12,
    flexWrap: isMobile ? 'wrap' : 'nowrap'
  },
  confirmedIds: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  confirmedOrderId: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: isMobile ? '0.8rem' : '0.85rem',
    color: 'rgba(255,255,255,0.90)',  // ↑ was 0.85
    fontWeight: 700
  },
  confirmedPaymentId: {
    fontSize: isMobile ? '0.72rem' : '0.76rem',
    color: 'rgba(255,255,255,0.55)',  // ↑ was 0.35
    fontFamily: "'JetBrains Mono', monospace"
  },
  confirmedDate: {
    fontSize: isMobile ? '0.72rem' : '0.76rem',
    color: theme.color,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: `${theme.color}18`,
    border: `1px solid ${theme.color}33`,
    padding: '5px 10px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
    letterSpacing: '0.2px'
  },
  confirmedSection: {
    marginBottom: 14
  },
  confirmedLabel: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.60)',  // ↑ was 0.45
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 8,
    fontWeight: 700
  },
  confirmedItemsList: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: isMobile ? 10 : 14,
    border: '1px solid rgba(255,255,255,0.08)'
  },
  confirmedItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isMobile ? '7px 0' : '9px 0',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    gap: 8,
    flexWrap: 'wrap'
  },
  confirmedItemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  confirmedItemName: {
    fontWeight: 600,
    color: 'rgba(255,255,255,0.92)',  // ↑ was 0.88
    fontSize: '0.88rem',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  confirmedItemQty: {
    fontSize: isMobile ? '0.72rem' : '0.76rem',
    color: 'rgba(255,255,255,0.65)'  // ↑ was 0.5
  },
  confirmedItemPrice: {
    fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',  // ↑ was 0.85
    whiteSpace: 'nowrap',
    fontSize: '0.88rem'
  },
  confirmedTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isMobile ? '12px 14px' : '14px 16px',
    background: `${theme.color}12`,
    border: `1px solid ${theme.color}33`,
    borderRadius: 10,
    marginTop: 14,
    gap: 8,
    flexWrap: 'wrap'
  },
  confirmedTotalLabel: {
    fontWeight: 600,
    color: 'rgba(255,255,255,0.65)',  // ↑ was 0.5
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  confirmedTotalAmount: {
    fontSize: isMobile ? '1.2rem' : '1.35rem',
    fontWeight: 800,
    color: theme.color,
    letterSpacing: '-0.5px'
  },
  confirmedMeta: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    fontSize: isMobile ? '0.74rem' : '0.78rem',
    color: 'rgba(255,255,255,0.65)'  // ↑ was 0.5
  },
  confirmedMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 7
  },
  shippingStatus: (status) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: isMobile ? '0.68rem' : '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: status === 'shipped' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(245, 158, 11, 0.18)',  // ↑
    color: status === 'shipped' ? '#93c5fd' : '#fbbf24',  // ↑ brighter
    border: `1px solid ${status === 'shipped' ? '#3b82f633' : '#f59e0b33'}`,
    whiteSpace: 'nowrap'
  }),
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.80)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    animation: 'fadeIn 0.2s ease-out',
    padding: isMobile ? 16 : 24,
    backdropFilter: 'blur(8px)'
  },
  modal: {
    background: '#13131c',  // slightly lighter than before
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: isMobile ? 22 : 36,
    maxWidth: isMobile ? '100%' : 600,
    width: '100%',
    boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
    animation: 'slideUp 0.3s ease-out',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  modalHeader: {
    marginBottom: 24
  },
  modalTitle: {
    fontSize: isMobile ? '1.15rem' : '1.4rem',
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: '-0.4px'
  },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.65)',  // ↑ was 0.55
    fontSize: isMobile ? '0.83rem' : '0.88rem'
  },
  modalSection: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: isMobile ? 16 : 20,
    marginBottom: 16
  },
  modalSectionTitle: {
    fontSize: '0.72rem',
    color: 'rgba(255,255,255,0.60)',  // ↑ was 0.45
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 700,
    marginBottom: 14
  },
  modalItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  modalItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.09)',
    gap: 8,
    flexWrap: 'wrap'
  },
  modalItemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  modalItemDetails: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  modalItemDetailsH4: {
    fontWeight: 700,
    color: 'rgba(255,255,255,0.95)',  // ↑ was 0.9
    marginBottom: 3,
    fontSize: '0.9rem'
  },
  modalItemDetailsP: {
    fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.65)'  // ↑ was 0.5
  },
  modalItemPrice: {
    fontWeight: 800,
    color: theme.color,
    fontSize: isMobile ? '1rem' : '1.05rem',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.3px'
  },
  modalSummary: {
    background: `${theme.color}0e`,
    border: `1px solid ${theme.color}28`
  },
  modalSummaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: isMobile ? '0.83rem' : '0.88rem',
    color: 'rgba(255,255,255,0.65)'  // ↑ was 0.5
  },
  modalSummaryRowLast: {
    marginBottom: 0,
    paddingTop: 12,
    borderTop: `1px solid ${theme.color}22`,
    fontWeight: 800,
    fontSize: isMobile ? '0.88rem' : '0.95rem',
    color: theme.color
  },
  modalActions: {
    display: 'flex',
    gap: 10,
    marginTop: 22,
    flexDirection: isMobile ? 'column' : 'row'
  },
  modalBtn: (type, isHovered) => ({
    flex: 1,
    padding: isMobile ? '12px 16px' : '13px 22px',
    border: '1px solid',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: isMobile ? '0.88rem' : '0.92rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: type === 'cancel'
      ? (isHovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)')
      : (isHovered ? theme.color : `${theme.color}cc`),
    borderColor: type === 'cancel' ? 'rgba(255,255,255,0.14)' : 'transparent',
    color: type === 'cancel' ? (isHovered ? '#ffffff' : 'rgba(255,255,255,0.70)') : '#ffffff',  // ↑ was 0.5
    boxShadow: type === 'confirm' ? (isHovered ? `0 6px 20px ${theme.color}55` : `0 3px 12px ${theme.color}33`) : 'none',
    transform: type === 'confirm' && isHovered ? 'translateY(-1px)' : 'translateY(0)',
    letterSpacing: '0.2px'
  }),
  emptyState: {
    textAlign: 'center',
    padding: isMobile ? '50px 20px' : '80px 40px',
    color: 'rgba(255,255,255,0.35)'
  },
  emptyIcon: {
    fontSize: isMobile ? '2.8rem' : '3.5rem',
    marginBottom: 14,
    animation: 'float 3s ease-in-out infinite',
    opacity: 0.5  // ↑ was 0.4
  },
  emptyText: {
    fontSize: isMobile ? '0.95rem' : '1rem',
    color: 'rgba(255,255,255,0.50)',  // ↑ was 0.35
    marginBottom: 22,
    letterSpacing: '0.1px'
  },
  emptyButton: (isHovered) => ({
    padding: '11px 26px',
    background: isHovered ? theme.color : `${theme.color}22`,
    color: isHovered ? '#ffffff' : theme.color,
    border: `1px solid ${theme.color}55`,
    borderRadius: 10,
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: isHovered ? `0 4px 16px ${theme.color}44` : 'none'
  }),
  skeletonCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    overflow: 'hidden',
    height: 380
  },
  skeletonImage: {
    width: '100%',
    height: isMobile ? 190 : 220,
    background: 'rgba(255,255,255,0.05)'
  },
  skeletonContent: {
    padding: isMobile ? 16 : 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14
  },
  skeletonLine: (width) => ({
    height: 14,
    width: width || '100%',
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 4,
    animation: 'shimmer 1.5s infinite'
  }),
  syncButton: (status) => ({
    padding: isMobile ? '10px 16px' : '11px 22px',
    background: status === 'synced' ? '#10b98118' : status === 'error' ? '#ef444418' : `${otherTheme.color}18`,
    color: status === 'synced' ? '#34d399' : status === 'error' ? '#f87171' : otherTheme.color,  // ↑ brighter
    border: `1px solid ${status === 'synced' ? '#10b98144' : status === 'error' ? '#ef444444' : otherTheme.color + '44'}`,
    borderRadius: 10,
    fontWeight: 700,
    fontSize: isMobile ? '0.85rem' : '0.9rem',
    cursor: status === 'syncing' ? 'wait' : 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    opacity: status === 'syncing' ? 0.7 : 1,
    width: isMobile ? '100%' : 'auto'
  }),
  syncNote: {
    fontSize: isMobile ? '0.78rem' : '0.82rem',
    color: 'rgba(255,255,255,0.55)',  // ↑ was 0.35
    marginTop: 10,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderLeft: `3px solid ${otherTheme.color}66`
  },
  dateFilterContainer: {
    marginBottom: isMobile ? 20 : 28,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 12,
    padding: isMobile ? 14 : 18
  },
  dateFilterLabel: {
    fontSize: isMobile ? '0.78rem' : '0.82rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.65)',  // ↑ was 0.5
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  dateButton: (isSelected, isToday) => ({
    padding: isMobile ? '7px 12px' : '8px 14px',
    border: '1px solid',
    borderColor: isSelected ? theme.color : 'rgba(255,255,255,0.14)',  // ↑ was 0.10
    borderRadius: 8,
    background: isSelected ? theme.color : isToday ? `${theme.color}15` : 'transparent',
    color: isSelected ? '#ffffff' : isToday ? theme.color : 'rgba(255,255,255,0.60)',  // ↑ was 0.45
    fontWeight: isSelected || isToday ? 700 : 500,
    fontSize: isMobile ? '0.73rem' : '0.78rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    boxShadow: isSelected ? `0 2px 10px ${theme.color}44` : 'none',
    letterSpacing: '0.2px'
  }),
  deleteModalText: {
    fontSize: isMobile ? '0.88rem' : '0.92rem',
    color: 'rgba(255,255,255,0.75)',  // ↑ was 0.6
    marginBottom: 16,
    lineHeight: 1.6
  },
  deleteModalProductName: {
    fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',  // ↑ was 0.85
    display: 'block',
    marginTop: 10,
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    borderLeft: `3px solid ${theme.color}`,
    fontSize: '0.9rem'
  }
})