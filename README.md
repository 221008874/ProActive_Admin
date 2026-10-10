# ProActive_Admin

Admin dashboard for a multi-currency e-commerce store. Client-only React SPA — Firebase
(Auth + Firestore) is the entire backend, Cloudinary handles product images.

## Stores

Three independent stores, each backed by its own set of Firestore collections:

| Store | Currency | Collections |
|---|---|---|
| Pi Network | `PI` | `products_pi`, `orders_pi`, `confirmedPayments_pi` |
| EGP Store | `EGP` | `products_egp`, `orders_egp`, `confirmedPayments_egp` |
| Global Store | `USD` | `products_dollar`, `orders_dollar`, `confirmedPayments_dollar` |

EGP additionally owns operational data: `egp_governorate_costs`, `egp_settings/general`,
`egp_coupons`.

## Features

- **Products** — add / edit / delete, Cloudinary image upload, cross-store product sync
- **Orders** — pending orders awaiting payment confirmation
- **Confirmed** — admin-confirmed orders, filterable by date
- **EGP only** — coupon management with printable PDF/QR export, per-governorate
  shipping costs (27 governorates), minimum order amount

## Getting started

```bash
npm install
npm run dev      # start dev server
npm run build    # production build -> dist/
npm run lint     # eslint
```

## Routing

| Path | Screen |
|---|---|
| `/` | redirects to `/login` |
| `/login` | `SignIn` — Firebase email/password auth |
| `/dashboard/*` | `DashboardRouter` — auth-guarded store switcher |
| `*` | redirects to `/login` |

## Configuration

- `src/services/firebase.js` — Firebase web config, `auth` and `db` singletons,
  local auth persistence
- `src/services/cloudinary.js` — Cloudinary cloud name + unsigned upload preset

> Both configs are client-side. Access control is enforced by Firestore security rules,
> which live in the Firebase console, not in this repository.

## Architecture

```
src/
  main.jsx                      BrowserRouter root
  App.jsx                       route table
  context/AuthContext.jsx       onAuthStateChanged -> currentUser
  services/firebase.js          app init, auth + db singletons
  services/cloudinary.js        uploadImage(file)
  pages/DashboardRouter.jsx     auth guard + store switcher + global styles
  pages/Dashboard{Pi,EGP,Dollar}.jsx   per-store UI
  hooks/useDashboard{PI,EGP,Dollar}.jsx per-store state + Firestore access
  components/ProductForm.jsx    shared product add/edit form
  styles/dashboardStyles.jsx    createStyles(theme, otherTheme, isMobile, isTablet)
  config/themes.jsx             per-store color / symbol tokens
```

Each store has its own hook and page pair. The hooks are intentionally near-identical;
the real differences are the pending-order status filter, the customer fields captured
on confirmation, and the cross-store sync target.

## Status

Fresh repository — imported from the previous `ecommerce-admin` project at its last
committed state.