# IMPLEMENTATION_STATUS.md

Last updated: build session on 2026-08-28.

## ✅ Completed & Verified

### Database
- [x] Full schema (`database/schema.sql`) — 8 tables, FKs, CHECK constraints, indexes, `updated_at` triggers.
- [x] Seed data (`database/seed.sql`) — 6 users, 8 categories, 28 products, inventory, 492 historical sales, 6 orders.
- [x] Verified: applied to a live PostgreSQL 16 instance without errors.

### Backend (Node/Express/Socket.IO)
- [x] JWT auth: register, login, `/me`, bcrypt password hashing.
- [x] Role-based middleware (`authenticate`, `authorize`).
- [x] Products CRUD (owner-only writes, public reads), barcode lookup.
- [x] Categories CRUD.
- [x] Inventory: safe adjust (never negative, transactional, row-locked), threshold updates, movement history.
- [x] Orders: create (stock validated, not deducted), list mine/all, get one, status transitions with
      documented inventory strategy (deduct on ACCEPT, restore on ACCEPT→REJECT).
- [x] Sales/POS: complete a sale (immediate stock deduction), list sales.
- [x] Dashboard summary endpoint (today's sales, revenue, orders, low stock, best/slow sellers, recent orders, 14-day trend).
- [x] Socket.IO: authenticated connections, owner broadcast room, per-customer rooms, `new-order` /
      `order-status-updated` / `low-stock-alert` events.
- [x] Centralized error handling (Postgres constraint violations mapped to clean HTTP errors).
- [x] **Live-tested**: real login, real order placement, real two-socket simulation of an owner device
      and a customer device confirming instant, un-polled delivery of both event types.

### AI Service (FastAPI)
- [x] `/predict-demand`, `/predict-demand/{id}` — linear regression trend + moving-average fallback.
- [x] `/predict-stockout`, `/predict-stockout/{id}` — velocity-based days-to-stockout + risk level.
- [x] `/dead-stock` — rule-based detection with discount/bundle/stop-reorder recommendations.
- [x] `/recommendations/{id}` — frequently-bought-together, similar, and alternative products.
- [x] **Live-tested** against the real seeded database — all 4 endpoints verified returning meaningful,
      demo-ready output (e.g., correctly flagged Maggi Noodles as MEDIUM stock-out risk).

### Frontend (React/Vite)
- [x] Auth (login/register, shared component for customer + owner), protected routes by role.
- [x] Customer: product browse/search/filter, product detail with AI recommendations, cart
      (local, stock-validated at checkout), order placement, live order tracking via Socket.IO.
- [x] Owner: dashboard with KPIs + charts (Recharts), live order management with 🔔 real-time alerts
      and audio cue, product management, inventory management, POS/billing (manual + USB + webcam
      barcode via html5-qrcode) with printable receipt, AI Insights page.
- [x] Loading/error/empty states throughout; toast notification system.
- [x] Custom, non-templated visual design (Fraunces + Inter, spice-market palette, custom tokens.css).
- [x] **Build verified**: `npm run build` succeeds; `npm run lint` (oxlint) — 0 errors; every page
      module transforms cleanly through the Vite dev server.

### Documentation
- [x] PROJECT_SPEC.md, README.md (full setup/run/test instructions for Windows), this file,
      FINAL_TEST_REPORT.md, `.env.example` files for all three services.

## ⚠️ Known Simplifications (Documented, Not Blocking)

- Payment methods are simulated (no real payment gateway), per spec.
- AI models are intentionally simple (linear regression, rule-based heuristics) — appropriate for
  a demo dataset.
- No automated browser (Playwright/Cypress) end-to-end suite ships with the project — the sandbox
  used to build this could not download browser binaries; all logic was instead verified via live
  API/Socket.IO integration tests plus a clean production build and lint pass. See
  FINAL_TEST_REPORT.md for exactly what this covered.

## 🔭 Not Built (Explicitly Out of Scope Per Spec)

- Hardware integrations (Raspberry Pi, RFID, IoT shelves) — documented as future scope only.
- Multi-tenant/multi-store support.

## 📝 Post-Delivery Additions (added after initial handoff, based on user feedback)

- **Sliding cart drawer** — adding a product to the cart now automatically opens a slide-in
  drawer (`CartDrawer.jsx`) showing the updated cart, instead of requiring a navigation to
  the Cart page to see confirmation.
- **Rebuilt camera barcode scanner** (`BarcodeScanner.jsx`) — properly enumerates all available
  cameras via `Html5Qrcode.getCameras()` and lets the user pick one (the original implementation
  only requested a generic "environment-facing" camera with no fallback or selection, which was
  the likely cause of it not working on the user's hardware). Explicitly configured for EAN-13.
- **Online barcode lookup** (`productLookup.js`) — scanning a barcode while adding a new product
  now queries the free, open, keyless Open Food Facts database to auto-fill name/description.
  Price and category are always left for manual entry since they're never in that database.
- **Shared `AddProductModal`** — the scan-or-manual-entry add-product flow is now available from
  both the **Products** page and the **Inventory** page (previously only from Products), addressing
  direct user feedback that it was missing from Inventory management.
- **App-wide new-order notifications** — toast + sound + sidebar badge now fire from `OwnerLayout`
  regardless of which owner page is open (previously only worked while the Orders page itself was
  mounted, requiring a navigation to "see" a new order — the actual root cause of the reported
  "have to refresh" bug). Notification sound rebuilt as a proper bell strike (additive synthesis
  with inharmonic partials, sharp attack + long ring-out, struck twice) using a single
  pre-unlocked `AudioContext` per session, since a fresh context created inside an async socket
  callback gets silently blocked by browser autoplay policy.
- **Payment collection on order completion** — completing a customer order (READY → COMPLETED)
  now opens a Cash/UPI/Card selection step and returns a printable receipt, matching the POS
  billing flow. The backend records the actual chosen payment method in `sales` instead of a
  hardcoded default.
- **Printable receipts scoped correctly** — a print stylesheet now ensures "Print receipt" only
  prints the receipt itself, not the whole app UI.
- **Transaction statement CSV export** — a date-range picker + download button on the POS/Billing
  page exports all transactions (POS sales and completed customer orders together, since both
  write to the same `sales` table) as a CSV with a total row.
- **Camera stays open across POS scans** — previously closed after every single scan; now stays
  open with a 2-second per-barcode cooldown so a whole basket can be scanned without reopening
  the camera each time.
- **HTTPS + network-IP tooling** (`scripts/set-network.js`, `scripts/generate-certs.js`) — since
  browsers block camera access on any non-localhost `http://` origin, added a one-command tool
  that generates a free self-signed certificate for a given IP and reconfigures all three
  services to use it, enabling camera/barcode-scanning access from any device on the network,
  not just the host machine. Falls back cleanly to plain HTTP/localhost when not needed.

