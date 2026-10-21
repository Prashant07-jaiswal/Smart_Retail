# PROJECT_SPEC.md — Smart Retail Intelligence Platform

## 1. Purpose

A local, fully open-source retail platform connecting a **customer** and a **store owner**
(on separate devices/browsers) through a shared backend, with **real-time order
notifications and status updates** as the centerpiece feature.

## 2. Roles

| Role | Capabilities |
|---|---|
| Customer | Register/login, browse & search products, manage a cart, place orders, track order status live, get AI recommendations |
| Owner | Login, manage products & inventory, receive live order alerts, update order status, run POS/billing, view dashboard analytics, view AI insights |

## 3. Tech Stack

- **Frontend:** React 19 + Vite, React Router DOM, Axios, Socket.IO Client, Recharts, html5-qrcode
- **Backend:** Node.js + Express, PostgreSQL (`pg`), JWT, bcrypt, Socket.IO, dotenv, cors
- **AI Service:** Python + FastAPI, Uvicorn, pandas, scikit-learn, psycopg2
- **Database:** PostgreSQL

Everything used is free and open-source; no paid APIs or cloud services are required.

## 4. Core Real-Time Flow

```
Customer places order → Backend saves order (PENDING) → Socket.IO "new-order" → Owner sees 🔔 instantly
Owner changes status → Backend updates DB → Socket.IO "order-status-updated" → Customer sees update instantly
```

No polling, no manual refresh, on either side.

## 5. Inventory Strategy

- Stock is **validated** (not deducted) when a customer places an order.
- Stock is **deducted** only when the owner **ACCEPTS** an order (PENDING → ACCEPTED).
- Stock is **restored** if an accepted order is later **REJECTED**.
- POS sales deduct stock immediately (a POS sale is instantaneous, unlike an online order).
- Every quantity change is written to `stock_movements` for a full audit trail.
- Stock can never go negative (enforced by a DB CHECK constraint + row locking in transactions).

## 6. Database Tables

`users`, `categories`, `products`, `inventory`, `stock_movements`, `orders`, `order_items`, `sales`
— see `database/schema.sql` for full definitions (keys, constraints, indexes, triggers).

## 7. AI Modules

1. **Demand prediction** — linear regression trend (fallback: moving average) on daily sales → 7/30-day forecast + reorder quantity.
2. **Stock-out prediction** — current stock ÷ recent sales velocity → days until stock-out, risk level, recommendation.
3. **Dead/slow stock detection** — rule-based: low/no recent sales + high inventory → discount/bundle/stop-reordering recommendation.
4. **Recommendations** — frequently-bought-together (order co-occurrence), similar products (same category + price), alternatives (same category, popularity-ranked).

## 8. Out of Scope (documented, not built)

- Real payment gateways (POS payment methods are simulated).
- Hardware integrations (Raspberry Pi, RFID, IoT shelves) — see README "Future Scope".
- Multi-tenant / multi-store support.
