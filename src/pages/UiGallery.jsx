// Dev-only gallery of the admin design system.
//
// The store app has the same screen for its own components; this one covers
// the pieces only the back-office uses (the stock grid, status pills, the
// admin stepper, the phone bottom bar) alongside the shared controls.
//
// Gated behind import.meta.env.DEV: the route, its components and its strings
// are dropped from the production bundle. Delete this file and its route entry
// together — it is only useful while the design system is still moving.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import {
  Accordion, Badge, BottomSheet, Button, Checkbox, ColorDot, EmptyState, ErrorState, Field,
  IconBack, IconCheck, IconChevron, IconClose, IconFilter, IconMenu, IconMinus, IconPhone,
  IconPlus, IconSearch, IconShare, IconTrash, IconUser, PriceTag, QtyStepper, RadioCard,
  Select, Skeleton, SkeletonGrid, SizePicker, StatusPill, StepHeader, StepperField,
  StockGrid, StockHint, ToastProvider, useToast, variantsToStock, stockToVariants
} from '../ui'

function Row({ label, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8, paddingBlock: 18, borderBottom: "1px solid var(--pa-line)" }}>
      <div className="pa-group-title">{label}</div>
      {children}
    </section>
  )
}

const COLORS = [
  { id: "red", name: { ar: "أحمر", en: "Red" }, hex: "#C8102E" },
  { id: "black", name: { ar: "أسود", en: "Black" }, hex: "#121212" },
  { id: "sage", name: { ar: "مريميّة", en: "Sage" }, hex: "#9CAF88" }
]
const SIZES = ["XS", "S", "M", "L", "XL"]

function Gallery() {
  const { lang, dir, toggleLanguage } = useLanguage()
  const toast = useToast()
  const [color, setColor] = useState("red")
  const [size, setSize] = useState("M")
  const [qty, setQty] = useState(3)
  const [stock, setStock] = useState({ red_XS: 0, red_S: 2, red_M: 3, black_M: 12, black_L: 0 })
  const [sheet, setSheet] = useState(false)
  const [enabled, setEnabled] = useState(true)

  const rows = [...new Set(Object.keys(stock).map((k) => k.split("_")[0]))]

  return (
    <div className="pa-shell">
      <aside className="pa-side">
        <div className="pa-side__brand"><div className="pa-logo">PROACTIVE</div><small>Admin</small></div>
        <a href="#products" aria-current="page">Products</a>
        <a href="#orders">Orders<span className="pa-count">4</span></a>
        <a href="#low-stock">Low stock<span className="pa-count pa-count--low">2</span></a>
        <div className="pa-side__foot">
          <div style={{ fontSize: 12, color: "var(--pa-on-dark-2)" }}>owner@example.com</div>
          <button type="button" onClick={toggleLanguage} style={{ background: "none", border: 0, color: "#fff", fontWeight: 700, cursor: "pointer", padding: 0, textAlign: "start" }}>
            {lang === "ar" ? "English" : "العربية"}
          </button>
        </div>
      </aside>

      <main className="pa-content" dir={dir}>
        <div>
          <h1>Admin design system</h1>
          <div className="pa-subtitle">
            {lang === "ar" ? "كل العناصر والحالات، بالعربية." : "Every component and state, in English."}
          </div>
        </div>

        <Row label="Buttons">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <Button>Primary 48</Button>
            <Button variant="outline">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button size="lg">Sticky 52</Button>
            <Button size="compact">Compact 44</Button>
            <Button className="pa-btn--admin">Admin 44</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Row>

        <Row label="Status pills">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <StatusPill status="pending" label="Pending" />
            <StatusPill status="confirmed" label="Confirmed" />
            <StatusPill status="shipped" label="Shipped" />
            <StatusPill status="delivered" label="Delivered" />
            <StatusPill status="cancelled" label="Cancelled" />
            <StatusPill status="returned" label="Returned" />
            <StatusPill status="active" label="Active" />
            <StatusPill status="draft" label="Draft" />
            <StatusPill status="archived" label="Archived" />
          </div>
        </Row>

        <Row label="Icons">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, color: "var(--pa-ink)" }}>
            {[IconMenu, IconSearch, IconUser, IconBack, IconClose, IconShare, IconFilter, IconCheck,
              IconPlus, IconMinus, IconPhone, IconTrash, IconChevron].map((I, i) => <I key={i} width={22} height={22} />)}
          </div>
        </Row>

        <Row label="Admin fields (40px)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 220px" }}>
              <Field id="g-name" label={lang === "ar" ? "الاسم" : "Full name"} admin placeholder="Sara Mahmoud" />
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <Select id="g-gov" label={lang === "ar" ? "المحافظة" : "Governorate"} admin defaultValue="cairo">
                <option value="cairo">Cairo</option>
                <option value="luxor">Luxor</option>
              </Select>
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <Field id="g-price" label={lang === "ar" ? "السعر" : "Price"} admin defaultValue="450" />
            </div>
          </div>
          <Checkbox id="g-active" label={lang === "ar" ? "مُفعّل" : "Active"} checked={enabled} onChange={setEnabled} />
        </Row>

        <Row label="Stock grid (colour × size)">
          <StockGrid colors={COLORS} sizes={SIZES} stock={stock} onChange={(id, v) => setStock((s) => ({ ...s, [id]: v }))} lang={lang} />
          <div className="pa-subtitle">
            rows: {rows.join(", ")} · grid → variants → grid round-trips:{" "}
            {JSON.stringify(variantsToStock(stockToVariants(COLORS, SIZES, stock)))}
          </div>
        </Row>

        <Row label="Stepper (quick stock edit)">
          <StepperField value={qty} onChange={setQty} labels={{ dec: lang === "ar" ? "إنقاص" : "Decrease", inc: lang === "ar" ? "زيادة" : "Increase" }} />
          <QtyStepper value={qty} onChange={setQty} max={20} />
        </Row>

        <Row label="Colour · size · price">
          <div className="pa-swatches">
            {COLORS.map((c) => <ColorDot key={c.id} color={c} selected={color === c.id} onSelect={setColor} lang={lang} />)}
          </div>
          <SizePicker sizes={SIZES} value={size} stockBySize={{ XS: 0, S: 2, M: 3, L: 0, XL: 1 }} onChange={setSize} />
          <PriceTag price={450} compareAtPrice={600} lang={lang} />
          <StockHint stock={2} where={lang === "ar" ? "أحمر M" : "red, size M"} />
          <Badge kind="sale">-25%</Badge>
          <Badge>NEW</Badge>
        </Row>

        <Row label="Table skeleton">
          <div className="pa-tablebox">
            <div className="pa-table">
              <div className="pa-tr pa-tr--head"><span>Product</span><span>Category</span><span>Price</span><span>Stock</span><span>Status</span><span>Actions</span></div>
              <div className="pa-tr pa-tr--selected">
                <span className="pa-thumb" style={{ background: "var(--pa-stone)" }} />
                <span><b>Summer dress</b><br /><span className="pa-subtitle">SD-RED-M</span></span>
                <span>Dresses</span>
                <span><bdi>450 EGP</bdi><br /><s className="pa-subtitle">600 EGP</s></span>
                <span className="pa-ok">37 in stock</span>
                <span><StatusPill status="active" label="Active" /></span>
                <span><button type="button" className="pa-btn pa-btn--sm">Edit</button></span>
              </div>
              <div className="pa-tr">
                <span className="pa-thumb" style={{ background: "var(--pa-stone)" }} />
                <span><b>Linen shirt</b><br /><span className="pa-subtitle">LS-BLK-L</span></span>
                <span>Shirts</span>
                <span><bdi>320 EGP</bdi></span>
                <span className="pa-error">Low · 2 left</span>
                <span><StatusPill status="draft" label="Draft" /></span>
                <span><button type="button" className="pa-btn pa-btn--sm">Edit</button></span>
              </div>
            </div>
          </div>
        </Row>

        <Row label="Accordion · radio card">
          <Accordion openId="a" items={[
            { id: "a", title: lang === "ar" ? "الوصف" : "Description", body: lang === "ar" ? "مفتوح افتراضياً." : "Open by default." },
            { id: "b", title: lang === "ar" ? "الشحن" : "Shipping", body: lang === "ar" ? "لكل المحافظات." : "All 27 governorates." }
          ]} />
          <div style={{ maxWidth: 420 }}>
            <RadioCard id="rc-1" name="pay" value="cod" checked title="Cash on delivery" description="Pay the courier on arrival" />
          </div>
        </Row>

        <Row label="Toasts · sheet">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => toast.show(lang === "ar" ? "تم الحفظ" : "Saved")}>Toast</Button>
            <Button variant="outline" onClick={() => setSheet(true)}>Sheet</Button>
          </div>
        </Row>

        <Row label="States">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="pa-subtitle">Skeleton</div>
              <SkeletonGrid count={3} />
            </div>
            <div style={{ flex: "1 1 240px" }}>
              <EmptyState title={lang === "ar" ? "مفيش طلبات" : "No orders"} body={lang === "ar" ? "هيظهر هنا أول ما يوصل طلب." : "New orders will show here."} />
            </div>
            <div style={{ flex: "1 1 240px" }}>
              <ErrorState title={lang === "ar" ? "حدث خطأ" : "Something went wrong"} body={lang === "ar" ? "راجع الاتصال." : "Check your connection."} />
            </div>
          </div>
        </Row>

        <Row label="Step header">
          <StepHeader title={lang === "ar" ? "الطلب PA-1043" : "Order PA-1043"} step={2} onBack={() => {}} />
        </Row>

        <p className="pa-subtitle">
          <Link to="/dashboard">{lang === "ar" ? "رجوع للوحة التحكم" : "Back to the dashboard"}</Link>
        </p>
      </main>

      {sheet && (
        <BottomSheet title={lang === "ar" ? "عرض" : "Preview"} onClose={() => setSheet(false)}
          footer={<Button block>{lang === "ar" ? "تم" : "Done"}</Button>}>
          <p className="pa-subtitle">{lang === "ar" ? "التركيز محبوس هنا؛ Escape بيقفل." : "Focus is trapped here; Escape closes."}</p>
          <Skeleton count={3} variant="line" />
        </BottomSheet>
      )}
    </div>
  )
}

export default function UiGallery() {
  return (
    <ToastProvider>
      <Gallery />
    </ToastProvider>
  )
}
