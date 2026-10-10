import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import DashboardPI from './DashboardPi'
import DashboardEGP from './DashboardEGP'
import DashboardDollar from './DashboardDollar'

const TABS = [
  { id: 'pi',     icon: 'π', name: 'Pi Network', desc: 'Web3 Store',       color: '#d4a017' },
  { id: 'egp',    icon: '£', name: 'EGP Store',  desc: 'Cash on Delivery', color: '#818cf8' },
  { id: 'dollar', icon: '$', name: 'Global Store',desc: 'USD Payments',     color: '#10b981' },
]

const SWITCHER_HEIGHT = 44   // ← reduced from 58

export default function DashboardRouter() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [activeDashboard, setActiveDashboard] = useState('pi')
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (!currentUser) navigate('/login')
  }, [currentUser, navigate])

  if (!currentUser) return null

  const handleTabChange = (id) => {
    if (id === activeDashboard) return
    setIsTransitioning(true)
    setTimeout(() => {
      setActiveDashboard(id)
      setIsTransitioning(false)
    }, 150)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=JetBrains+Mono:wght@400;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── SWITCHER BAR ── */
        .dr-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: ${SWITCHER_HEIGHT}px;
          z-index: 9999;
          background: #08080f;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: stretch;
        }
        .dr-bar-inner {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 16px;
          display: flex;
          align-items: stretch;
        }

        /* Brand */
        .dr-brand {
          display: flex;
          align-items: center;
          gap: 7px;
          padding-right: 16px;
          border-right: 1px solid rgba(255,255,255,0.07);
          margin-right: 4px;
          flex-shrink: 0;
        }
        .dr-brand-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #d4a017;
          box-shadow: 0 0 8px #d4a017aa;
          animation: dr-pulse 2.2s ease-in-out infinite;
          flex-shrink: 0;
        }
        .dr-brand-label {
          font-size: 0.65rem;
          font-weight: 800;
          color: rgba(255,255,255,0.50);
          text-transform: uppercase;
          letter-spacing: 2px;
          white-space: nowrap;
        }

        /* Tabs */
        .dr-tabs {
          display: flex;
          align-items: stretch;
          flex: 1;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .dr-tabs::-webkit-scrollbar { display: none; }

        .dr-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.18s ease, color 0.18s ease;
          font-family: inherit;
          outline: none;
          position: relative;
          color: rgba(255,255,255,0.45);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .dr-tab::after {
          content: '';
          position: absolute;
          bottom: -1px; left: 0; right: 0;
          height: 2px;
          background: var(--tc);
          transform: scaleX(0);
          transition: transform 0.22s ease;
          border-radius: 2px 2px 0 0;
        }
        .dr-tab:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.75); }
        .dr-tab.active { color: #fff; }
        .dr-tab.active::after { transform: scaleX(1); }

        .dr-tab-chip {
          width: 26px; height: 26px;   /* ← smaller chip */
          border-radius: 7px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.10);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.85rem;
          font-weight: 800;
          transition: all 0.2s ease;
          flex-shrink: 0;
          color: rgba(255,255,255,0.55);
        }
        .dr-tab.active .dr-tab-chip {
          background: var(--tc);
          border-color: transparent;
          box-shadow: 0 0 12px var(--tc-glow);
          color: #fff;
        }

        .dr-tab-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
        }
        .dr-tab-name {
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
          letter-spacing: -0.1px;
        }
        .dr-tab-sub {
          font-size: 0.60rem;
          font-weight: 500;
          line-height: 1;
          white-space: nowrap;
          color: rgba(255,255,255,0.30);
          transition: color 0.18s ease;
        }
        .dr-tab.active .dr-tab-sub { color: var(--tc); opacity: 0.85; }

        /* ── CONTENT AREA ── */
        .dr-body {
          padding-top: ${SWITCHER_HEIGHT}px;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .dr-body.fading {
          opacity: 0;
          transform: translateY(4px);
          pointer-events: none;
        }

        /* Push child sticky headers below our fixed bar */
        .dr-body header {
          top: ${SWITCHER_HEIGHT}px !important;
        }

        /* ── GLOBAL DARK OVERRIDES ── */
        .dr-body * { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .dr-body input,
        .dr-body textarea,
        .dr-body select {
          color: #e8e8f2 !important;
          caret-color: #fff;
        }
        .dr-body input::placeholder,
        .dr-body textarea::placeholder { color: rgba(255,255,255,0.28) !important; }
        .dr-body input:focus,
        .dr-body textarea:focus {
          outline: none !important;
          border-color: rgba(255,255,255,0.22) !important;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.06) !important;
        }

        /* ── ANIMATIONS ── */
        @keyframes dr-pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slideDown  { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn     { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        @keyframes slideUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes spin       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmer    { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse      { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0.15)} 50%{box-shadow:0 0 0 8px transparent} }

        /* ── SHARED UTILITY CLASSES ── */
        .skeleton {
          background: linear-gradient(90deg,
            rgba(255,255,255,0.05) 25%,
            rgba(255,255,255,0.10) 50%,
            rgba(255,255,255,0.05) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite;
          border-radius: 8px;
        }
        .sync-pulse { animation: pulse 2s infinite; }
        .dashboard-loading {
          min-height: 100vh;
          background: #0d0d14;
          display: flex; align-items: center; justify-content: center;
        }
        .date-filter-scroll {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 2px 0;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.12) transparent;
        }
        .date-filter-scroll::-webkit-scrollbar { height: 3px; }
        .date-filter-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .dr-brand { display: none; }
          .dr-tab { padding: 0 12px; }
          .dr-tab-sub { display: none; }
          table { display: block; overflow-x: auto; white-space: nowrap; }
        }
        @media (max-width: 480px) {
          .dr-tab { padding: 0 8px; flex: 1; justify-content: center; }
          .dr-tab-text { display: none; }
          .dr-tab-chip { width: 24px; height: 24px; font-size: 0.8rem; }
        }
      `}</style>

      {/* ── Fixed top bar ── */}
      <div className="dr-bar">
        <div className="dr-bar-inner">
          <div className="dr-brand">
            <div className="dr-brand-dot" />
            <span className="dr-brand-label">Admin</span>
          </div>
          <div className="dr-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`dr-tab${activeDashboard === tab.id ? ' active' : ''}`}
                style={{ '--tc': tab.color, '--tc-glow': tab.color + '66' }}
                onClick={() => handleTabChange(tab.id)}
              >
                <div className="dr-tab-chip">{tab.icon}</div>
                <div className="dr-tab-text">
                  <span className="dr-tab-name">{tab.name}</span>
                  <span className="dr-tab-sub">{tab.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Page content ── */}
      <div className={`dr-body${isTransitioning ? ' fading' : ''}`}>
        {activeDashboard === 'pi'     && <DashboardPI />}
        {activeDashboard === 'egp'    && <DashboardEGP />}
        {activeDashboard === 'dollar' && <DashboardDollar />}
      </div>
    </div>
  )
}