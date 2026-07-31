# Laundry Home — AI-Powered Laundry Aggregator

Full-stack laundry booking platform: customers book pickup/delivery laundry services from verified vendors, track orders through 18 lifecycle stages in real time, and manage wallet/loyalty — while vendors, delivery executives, admins, and super admins get dedicated role-based apps.

---

## 1. Project Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────────┐
│  React SPA       │ ───▶ │  Express API      │ ───▶ │  Supabase               │
│  (Vite, :5173)   │  /api│  (server/, :8080) │      │  · PostgreSQL           │
│                  │ ◀─── │                  │ ◀─── │  · Auth (cookies/SSR)   │
└─────────────────┘      └──────────────────┘      │  · Realtime (WebSocket)  │
                                                   └─────────────────────────┘
```

- **Frontend** — React 19 SPA in `src/`, role-based apps (`customer`, `vendor`, `delivery`, `admin`, `superadmin`).
- **Backend** — Express 5 API in `server/`, mounted under `/api`, backed by Supabase JS v2.
- **Database** — Supabase Postgres; schema managed as numbered SQL migrations in `supabase/migrations/`.
- **Deployment** — Vercel serves the SPA and the API bundle (`api/index.js` built from `server/api-entry.ts`).

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS 4, shadcn/ui, Radix UI, lucide-react |
| State | Zustand (auth/global), TanStack Query (server state) |
| Routing | React Router 7 |
| Backend | Express 5.2, `path-to-regexp` v8 (route wildcard syntax: `/{*any}`) |
| Data access | `@supabase/supabase-js` v2, `@supabase/ssr` (cookie sessions) |
| Maps | Leaflet + react-leaflet, `@vis.gl/react-google-maps` |
| Payments | Razorpay (server SDK) |
| Charts | Recharts |
| Forms | react-hook-form, zod |
| Misc | framer-motion, sonner (toasts), embla-carousel, dnd-kit |

---

## 3. Project Structure

```
Laundry-Home/
├── api/                  # Vercel serverless entry (esbuild output of server/api-entry.ts)
├── server/
│   ├── app.ts            # Express app — middleware + all route mounts
│   ├── index.ts          # Local dev server (static dist + startup order-fix)
│   ├── api-entry.ts      # Vercel serverless entry (re-exports app)
│   ├── supabase.ts       # createAdminClient / createServerClientWithCookies / ensureSystemTables
│   ├── pricing.ts        # Server-side pricing engine (DB-driven)
│   ├── middleware/
│   │   └── auth.ts       # Public / role / authenticated route enforcement
│   └── routes/           # 42 route modules (see §10)
├── src/
│   ├── App.tsx           # Router + AuthGate + error boundary + role app lazy loading
│   ├── components/
│   │   ├── customer/     # booking-flow-v2.tsx (active booking flow)
│   │   ├── vendor/       # vendor app
│   │   ├── delivery/     # delivery app
│   │   ├── admin/        # admin app
│   │   ├── superadmin/   # super admin app
│   │   ├── shared/       # AppShell, ProfilePage, SettingsPage
│   │   └── auth/         # AuthLanding
│   └── lib/
│       ├── api/client.ts # HTTP client — convertKeys (snake→camel) on responses
│       ├── store.ts      # Zustand auth store + realtime notifications
│       ├── supabase.ts   # Browser client (anon key) + admin client (never in client bundle)
│       ├── types.ts      # Shared TS interfaces
│       ├── hooks/        # useFetch, useRouterView, useRealtime, useOrders, ...
│       └── data/         # stages.ts (ORDER_STAGE_FLOW), areas, slots
├── supabase/
│   └── migrations/       # 40 numbered SQL migrations
├── scripts/              # One-off SQL scripts (e.g. backfill-orders-customer-name.sql)
├── dist/                 # Vite build output
└── vercel.json           # Vercel build + rewrite config
```

---

## 4. Environment Variables

Required in `.env` (root) for the local backend and for Vercel:

| Variable | Purpose | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Required by all clients |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (RLS-restricted) | Used by browser client + cookie session client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS) | **Server only** — used by `createAdminClient()` |
| `OPENROUTESERVICE_API_KEY` | OpenRouteService for geocoding/routing | Optional; used by geocode/routing routes |

> ⚠️ **Security:** The service-role key must **never** be exposed to the browser. `VITE_SUPABASE_SERVICE_ROLE_KEY` in `.env` is a legacy duplicate of the service role key and is **not** referenced by server code — keep it out of client builds.

---

## 5. Local Development

```bash
npm install --legacy-peer-deps   # match Vercel installCommand

npm run dev                     # concurrently: Vite (:5173) + tsx watch backend (:8080)
npm run dev:frontend            # Vite only
npm run dev:backend             # backend only (tsx watch server/index.ts)
npm test                        # Vitest suite
npm run lint                    # ESLint
npm run build                   # Vite build + esbuild serverless bundle (api/index.js)
npm start                       # production server (serves dist/ on :8080)
```

- Vite proxies `/api` → `http://localhost:8080` (`vite.config.ts`).
- The backend reads `.env` from the project root and serves `dist/` statically when self-hosted.
- Backend logs can be captured with `npx tsx watch server/index.ts | Tee-Object server.log` (useful for debugging).

---

## 6. Deployment (Vercel)

- **Auto-deploy:** every push to `main` triggers a Vercel production deployment. Local-only changes will **not** appear on Vercel — commit and push.
- `vercel.json`:
  - `buildCommand: "npm run build"` (Vite build + esbuild bundle of `server/api-entry.ts` → `api/index.js`)
  - `installCommand: "npm install --legacy-peer-deps"`
  - Rewrites: `/api/(.*)` → `/api`, all other paths → `/index.html` (SPA fallback)
- **Env vars:** configure all four variables above in Vercel project settings.
- **After deploy:** hard-refresh (`Ctrl+Shift+R`) — stale hashed JS chunks from the previous deploy cause "Failed to fetch dynamically imported module" errors.

---

## 7. Database (Supabase)

### 7.1 Migrations (40 total)

| Range | Focus |
|---|---|
| `00001` | Core schema: enums, user_profiles, vendors, orders, coupons, addresses, reviews, notifications, delivery_tasks, subscriptions, RBAC-ish tables, `handle_new_user()` trigger |
| `00002` | Analytics tables (KPIs, charts, slots) |
| `00004` | Reviews fixes (order_id nullable) |
| `00005` | Phase 1/2: support_tickets, campaigns, feature_flags, audit_logs, api_keys, webhooks, reports, user_profiles.email, user_subscriptions.status |
| `00006` | favorite_vendors |
| `00007` | Superadmin tables (user_profiles.suspended) |
| `00008` | RBAC tables (roles, role_permissions) |
| `00009` | Auto profile trigger (idempotent upsert) |
| `00010` | role_permissions.updated_at |
| `00011` | Seed order_stage_definitions (18 stages) |
| `00012` | Auto vendor notification on new order |
| `00013` | Geo tracking: orders lat/lng, delivery_live_locations |
| `00014` | Realtime publications |
| `00015` | Delivery OTP + photos, support ticket responses |
| `00016` | Delivery exec profiles (is_available, coords, max_daily_orders) |
| `00017` | Delivery signature |
| `00018` | Vendor service config (business_hours, radius, express) |
| `00019` | Pricing breakdown columns on orders |
| `00020` | Cancel notification trigger |
| `00021` | payment_details jsonb on orders |
| `00022` | **Service catalog rewrite**: service_categories, services (new schema), service_items |
| `00023` | service_items fixes |
| `00024`–`00025` | Location system: locations, service_areas, addresses.location_id |
| `00026` | Dynamic pricing coefficients |
| `00027` | Multi-city: cities, vendors.city_id |
| `00028`–`00030` | Address/flat_no fixes, dedup fixes |
| `00031`–`00036` | item_master, order_items, orders new columns, weight, unique constraints, service_items.item_master_id |
| `00037` | service_categories.grouping (`main` / `addon`) |
| `00038` | orders.delivery_address / delivery_area |
| `00039` | vendors.website_url / thumbnail_url |
| `00040` | Unique constraints: `pickup_slots(slot)`, `delivery_slots(slot)`, `delivery_live_locations(exec_id)` |

### 7.2 Core Tables

| Table | Purpose |
|---|---|
| `user_profiles` | Extends `auth.users`; role, name, phone, avatar, email, wallet_balance, loyalty_points, delivery-exec fields, suspended |
| `orders` | Core order entity; denormalized customer/vendor info, pricing columns, geo, verification workflow, payment_details |
| `order_items` | Normalized line items (service + item_master FK), triple-count verification (customer/pickup/vendor qty) |
| `order_stage_definitions` / `order_stage_events` | 18-stage lifecycle lookup + per-order stage tracking |
| `vendors` | Laundry partners; ratings, capacity, KYC, business hours, location, service_ids |
| `service_categories` / `services` / `service_items` / `item_master` | Hierarchical catalog: category → service (unit: kg/item/flat) → items with default_price → canonical item master |
| `vendor_service_prices` | Vendor-specific price overrides (unique: vendor_id, service_id, item_id) |
| `coupons` / `user_coupons` | Discounts (PK is `code` — **no `id` column**) + usage tracking |
| `user_subscriptions` / `subscription_plans` | Recurring savings plans |
| `addresses` | Saved user addresses (location_id → locations) |
| `locations` / `cities` / `service_areas` / `vendor_service_areas` | Geo hierarchy: Google Places cache → cities → localities → vendor coverage |
| `delivery_tasks` | Pickup/delivery dispatch; OTP, photos, signature, status lifecycle |
| `delivery_live_locations` | Real-time exec GPS (one row per exec — unique `exec_id`) |
| `wallet_transactions` | Wallet ledger |
| `reviews` | Multi-dimensional ratings + vendor replies |
| `notifications` / `chat_messages` | Push/email/SMS records; AI assistant history |
| `roles` / `role_permissions` | RBAC matrix |
| `pickup_slots` / `delivery_slots` | Available time slots (unique `slot`) |
| `garment_inventory`, `support_tickets`, `campaigns`, `feature_flags`, `system_config`, `audit_logs`, `api_keys`, `webhooks`, `reports`, `scheduled_reports`, `area_waitlist`, `favorite_vendors`, `vendor_staff`, `payment_methods`, `pricing_coefficients`, analytics tables | Supporting modules |

### 7.3 Enums

`user_role` (guest/customer/vendor/delivery/admin/superadmin), `order_status` (19 values incl. cancelled), `payment_status` (paid/pending/refunded), `task_status`, `task_type`, `notification_type`, `notification_channel`, `coupon_type`, `kyc_status` (**approved/pending/rejected** — no `not_submitted`), `chat_role`, `wallet_txn_type`, `staff_role`, `subscription_interval`, `ticket_status`, `ticket_priority`, `campaign_type`, `campaign_status`.

### 7.4 Triggers & Functions

- `handle_new_user()` — AFTER INSERT on `auth.users`; auto-creates `user_profiles` row from `raw_user_meta_data` (role, name, email, phone, avatar). **This is why customer names come from the DB.**
- `update_updated_at_column()` — BEFORE UPDATE on user_profiles, vendors, orders, delivery_tasks, system_config, role_permissions.
- `notify_vendor_on_new_order()` — AFTER INSERT on orders → vendor notification.
- `notify_stakeholders_on_cancel()` — AFTER UPDATE on orders (status → cancelled) → notify all parties.
- `get_user_role()`, `get_order_with_stages()`, `get_admin_dashboard()`, `get_vendor_analytics()` — helper functions.

### 7.5 RLS Summary

- **Public read:** vendors, coupons, reviews, subscription_plans, service_categories, services, service_items, item_master, cities, service_areas, roles, role_permissions.
- **User-owned:** user_profiles, addresses, notifications, chat_messages, wallet_transactions, user_subscriptions, favorite_vendors, payment_methods.
- **Order-scoped:** orders (own / assigned vendor / assigned exec), order_items, order_stage_events.
- **Admin/superadmin only:** system_config, admin tables, audit_logs, api_keys, webhooks, reports.
- **Vendor self-service:** vendor_service_prices, vendor_service_areas, vendor_staff.
- **Delivery self-service:** delivery_tasks (own exec_id), delivery_live_locations.

### 7.6 Applying Migrations

```bash
npx supabase link --project-ref <PROJECT_REF>   # once
npx supabase db push                            # push pending migrations
```

Or run SQL manually in the Supabase Dashboard → SQL Editor.

---

## 8. Database Integration Patterns (Critical)

### 8.1 Three Client Types

| Client | Where | Key | Behavior |
|---|---|---|---|
| `createAdminClient()` | `server/supabase.ts` | service-role | **Bypasses RLS** — server only, never in client bundle |
| `createServerClientWithCookies()` | `server/supabase.ts` | anon + session cookies | Authenticates the current user from `req.cookies` |
| Browser client (`src/lib/supabase.ts`) | frontend | anon | Used for auth + realtime subscriptions |

### 8.2 Casing Conventions (Important)

| Direction | Case | Handled by |
|---|---|---|
| API **responses** | `snake_case` → `camelCase` | `convertKeys()` in `src/lib/api/client.ts` (automatic) |
| API **request bodies** | `snake_case` (manual) | Developer must send `vendor_id`, `pickup_area`, etc. |
| **Query params** | `snake_case` (manual) | e.g. `?include_inactive=true` |
| **Realtime payloads** | `snake_case` (raw DB columns) | Must be mapped manually (`store.ts` does this for notifications) |

### 8.3 Key Gotchas

- `coupons` PK is `code` — there is **no `id` column**. Always select/update by `code`.
- `orders` uses `customer_id` (not `user_id`) as the FK to `user_profiles`.
- `services` table has **no** `base_price` / `pricing_type` columns (dropped in migration 00022) — use `service_items.default_price` + `unit`.
- Upserts require unique constraints (migration 00040) — `pickup_slots(slot)`, `delivery_slots(slot)`, `delivery_live_locations(exec_id)`.
- `kyc_status` enum values are only `approved` / `pending` / `rejected`.
- Express 5 catch-all route must be `app.get("/{*any}", ...)` — bare `*` throws a `PathError` from `path-to-regexp` v8.

---

## 9. Auth & Roles

### 9.1 Roles

`guest` → `customer` → `vendor` / `delivery` / `admin` / `superadmin` (stored on `user_profiles.role`).

### 9.2 Route Resolution (server/middleware/auth.ts)

1. Non-`/api` paths → pass through.
2. `PUBLIC_ROUTES` prefix match → pass through (no auth):
   `/api/auth/`, `/api/services`, `/api/coupons`, `/api/vendors`, `/api/slots`, `/api/seed`, `/api/subscriptions/plans`, `/api/geocode`
3. `ROLE_ROUTES` prefix match → authenticate + enforce role:
   - `/api/admin` → admin, superadmin
   - `/api/vendor` → vendor, admin, superadmin
   - `/api/delivery` → delivery, admin, superadmin
4. Everything else → any **authenticated** user (cookie session required).

> Note: `/api/vendors` (plural) is fully public — do not mount vendor-protected routes under it. `/api/delivery-executives` is NOT covered by the `/api/delivery` role route (hyphen breaks the prefix match).

### 9.3 Frontend Routing

`src/App.tsx` → `AuthGate` → `AuthenticatedApp` redirects `/` → `/{role}/dashboard`. Every role app must render a `"dashboard"` view (superadmin's Control Center is registered as `"dashboard"` — see troubleshooting §12).

---

## 10. API Route Inventory

All mounted in `server/app.ts`. Auth levels: 🟢 public · 🔵 authenticated · 🔴 role-gated.

| Mount | Router file | Auth | Purpose |
|---|---|---|---|
| `/api/auth` | `routes/auth.ts` | 🟢 | Login, OTP, signup, session, profile |
| `/api/orders` | `routes/orders.ts` | 🔵 | Create order, pricing calc, reorder, stage transitions, delivery task creation |
| `/api/vendors` | `routes/vendors.ts` | 🟢 | Vendor listings/detail |
| `/api/addresses` | `routes/addresses.ts` | 🔵 | Saved addresses CRUD |
| `/api/delivery-tasks` | `routes/delivery-tasks.ts` | 🔵 | Task list, status updates, OTP verify, photos, signature |
| `/api/delivery-executives` | `routes/delivery-executives.ts` | 🔵 | Exec listings |
| `/api/notifications` | `routes/notifications.ts` | 🔵 | User notifications |
| `/api/slots` | `routes/slots.ts` | 🟢 | Pickup/delivery slots (seeds defaults) |
| `/api/wallet` | `routes/wallet.ts` | 🔵 | Balance, transactions, top-up |
| `/api/reviews` | `routes/reviews.ts` | 🔵 | Reviews CRUD, vendor replies |
| `/api/services` | `routes/services.ts` | 🟢 | `GET /catalog` — nested categories/services/items |
| `/api/service-categories` | `routes/service-categories.ts` | 🔵 | Category admin |
| `/api/service-items` | `routes/service-items.ts` | 🔵 | Item CRUD (upserts into item_master) |
| `/api/coupons/validate` | `routes/coupon-validate.ts` | 🔵 | **Mounted BEFORE `/api/coupons`** (route-order sensitive) |
| `/api/coupons` | `routes/coupons.ts` | 🟢 | Coupon listings |
| `/api/admin` | `routes/admin.ts` | 🔴 admin | Orders, KPIs, analytics |
| `/api/admin/*` | `routes/admin-*.ts` (11 files) | 🔴 admin | Campaigns, features, audit logs, integrations, reports, users, config, RBAC, commission |
| `/api/vendor/analytics` | `routes/vendor-analytics.ts` | 🔴 vendor | Vendor dashboards |
| `/api/vendor/staff` | `routes/vendor-staff.ts` | 🔴 vendor | Staff management |
| `/api/vendor/onboarding` | `routes/vendor-onboarding.ts` | 🔴 vendor | KYC onboarding, pending list |
| `/api/subscriptions` | `routes/subscriptions.ts` | 🔵 | Plans (public) + user subscriptions |
| `/api/garments` | `routes/garments.ts` | 🔵 | Garment inventory |
| `/api/wallet/methods` | `routes/wallet-methods.ts` | 🔵 | Saved payment methods |
| `/api/support/tickets` | `routes/support-tickets.ts` | 🔵 | Support tickets |
| `/api/order-stages` | `routes/order-stages.ts` | 🔵 | Stage definitions |
| `/api/chat` | `routes/chat.ts` | 🔵 | AI assistant — **GET filters by user_id** (no cross-user leak) |
| `/api/favorites` | `routes/favorites.ts` | 🔵 | Favorite vendors |
| `/api/geocode` | `routes/geocode.ts` | 🟢 | Geocoding |
| `/api/routing` | `routes/routing.ts` | 🔵 | Route/ETA calculations |
| `/api/delivery/location` | `routes/delivery-location.ts` | 🔴 delivery | GPS upsert (unique exec_id) |
| `/api/payments` | `routes/payments.ts` | 🔵 | Razorpay gateway |

---

## 11. Key Business Flows

### 11.1 Booking Flow (`src/components/customer/booking-flow-v2.tsx`)

1. Fetch catalog: `GET /api/services/catalog` → categories → services → items (DB-driven).
2. User selects service → items (from `service_items`), quantities, laundry-bag mode, addresses, slot.
3. Live pricing via `POST /api/orders/pricing` → `calculatePricing()` in `server/pricing.ts`.
4. Place order: `POST /api/orders` → server validates, re-prices from DB, fetches customer profile from `user_profiles` (name/avatar), creates order + stage events, applies wallet/rewards/coupon effects.

### 11.2 Pricing Engine (`server/pricing.ts`)

DB-driven, in this order: subtotal (from `service_items.default_price` + optional `vendor_service_prices` override) → coupon (`coupons` by code) → subscription (`user_subscriptions` × `subscription_plans.savings_pct`) → reward points (`user_profiles.loyalty_points`) → platform fee (25) + delivery fee (40) → express surcharge (50) → peak/premium-area surge → GST 18%.

### 11.3 Order Lifecycle

18 stages (`order_stage_definitions`): placed → vendor_assigned → … → completed (+ cancelled). Stage transitions via `PATCH /api/orders/:id/stage`; `order_stage_events` records each stage's timestamp. Delivery tasks are auto-created when an order reaches `pickup_scheduled` and `ready_for_dispatch` (task starts unassigned — `exec_id` nullable until an exec claims it).

### 11.4 Wallet & Loyalty

`user_profiles.wallet_balance` / `loyalty_points`; every change is mirrored to `wallet_transactions`. Order placement debits wallet/points atomically via `applyPricingToOrder()`.

---

## 12. Troubleshooting Guide

| Symptom | Root cause | Fix |
|---|---|---|
| Customer name shows "Customer" | Order created before profile lookup existed, or profile missing | New orders: server fetches `user_profiles.name`. Existing orders: run `scripts/backfill-orders-customer-name.sql` in Supabase SQL Editor |
| 403 on `/api/vendors` | Auth middleware matched `/api/vendor` role prefix too broadly | Fixed — role routes use boundary matching (`prefix` or `prefix + "/"`) |
| Blank page after superadmin login | Superadmin app used `"overview"` view but router redirects to `/{role}/dashboard` | Fixed — superadmin views renamed to `"dashboard"` |
| "Failed to fetch dynamically imported module" | Browser cached old hashed JS chunk from previous Vercel deploy | Hard refresh (`Ctrl+Shift+R`) |
| Upsert fails: "column 'slot'/'exec_id' was not found" | Missing unique constraints | Migration `00040` adds UNIQUE(slot) and UNIQUE(exec_id) |
| Reorder endpoint returns "Order not found" | Code queried `orders.user_id` — column doesn't exist | Fixed — uses `customer_id` |
| Chat "pricing" query errors | `base_price`/`pricing_type` columns dropped in migration 00022 | Fixed — queries `name, unit` |
| Coupon order fails post-processing | `coupons.id` selected but PK is `code` | Fixed — select/update by `code` |
| `invalid input value for enum kyc_status: 'not_submitted'` | Enum only allows approved/pending/rejected | Fixed — filter uses `pending` only |
| Express server crashes: `Missing parameter name at index 1: *` | `app.get("*")` invalid in path-to-regexp v8 | Use `app.get("/{*any}", ...)` |
| Catalog services not in order | Nested relation un-ordered | `order("display_order", { foreignTable: "services" })` |
| Changes not visible on Vercel | Vercel deploys from git, not local files | Commit + push to `main`; verify deployment |

---

## 13. Utilities & Scripts

| File / Command | Purpose |
|---|---|
| `scripts/backfill-orders-customer-name.sql` | Backfill `orders.customer_name`/`customer_avatar` from `user_profiles` for legacy orders |
| `supabase/migrations/00040_add_unique_constraints.sql` | Unique constraints for slots + live locations |
| `npm run supabase:types` | Regenerate `src/lib/database.types.ts` from linked Supabase project |
| `npx supabase db push` | Apply pending migrations to the remote database |
| `npx tsx watch server/index.ts` | Local backend with hot reload (logs to console; pipe to `server.log` if needed) |

---

## 14. Maintenance Checklist

- [ ] Backend changes must be **committed and pushed** for Vercel to pick them up.
- [ ] DB schema changes → add a **numbered migration** (next: `00041`) and run `npx supabase db push`.
- [ ] Data backfills → SQL script under `scripts/` + run in Supabase SQL Editor (they're not migrations).
- [ ] Never put `SUPABASE_SERVICE_ROLE_KEY` in `src/` or client bundles.
- [ ] New API routes → update `PUBLIC_ROUTES` / `ROLE_ROUTES` in `server/middleware/auth.ts` if auth behavior differs from the default.
