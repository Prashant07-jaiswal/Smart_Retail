# Smart Retail Intelligence Platform

A local, real-time retail platform connecting a **customer** and a **store owner** on separate
devices — with instant order notifications, live status updates, POS billing, barcode support,
and lightweight AI-powered demand/stock-out/recommendation insights.

Built entirely with free, open-source technology. No paid APIs, no cloud services, no payment
gateway — everything runs on your own machine(s).

---

## 1. Architecture

```
┌─────────────────┐        HTTP/REST         ┌──────────────────┐
│  React Frontend │ ───────────────────────▶ │  Node/Express     │
│  (Vite, :5173)  │ ◀─────────────────────── │  Backend (:5000)   │
│                 │        Socket.IO          │  + Socket.IO       │
└─────────────────┘ ◀════════════════════▶  └─────────┬──────────┘
        │                                              │
        │ HTTP (AI calls)                              │ SQL
        ▼                                              ▼
┌─────────────────┐                          ┌──────────────────┐
│  FastAPI AI      │                          │   PostgreSQL     │
│  Service (:8000) │ ───────────SQL──────────▶│   (:5432)        │
└─────────────────┘                          └──────────────────┘
```

- The **backend** owns all writes (orders, inventory, sales) and pushes real-time events via Socket.IO.
- The **AI service** only *reads* from PostgreSQL — it never writes, keeping it safely decoupled.
- The **frontend** talks to both the backend (`/api/...`) and the AI service (`:8000/...`) directly.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, React Router DOM, Axios, Socket.IO Client, Recharts, html5-qrcode |
| Backend | Node.js, Express, PostgreSQL (`pg`), JWT, bcrypt, Socket.IO, dotenv, cors |
| AI Service | Python, FastAPI, Uvicorn, pandas, scikit-learn, psycopg2 |
| Database | PostgreSQL |
| Tooling | `selfsigned` (free local HTTPS certs for network/camera access — Section 10.5) |

---

## 3. Folder Structure

```
smart-retail/
├── frontend/           React + Vite app (customer + owner UI)
├── backend/            Express API + Socket.IO server
├── ai-service/         FastAPI AI microservice
├── database/           schema.sql, seed.sql
├── scripts/            Network/HTTPS tooling (set-network.js, generate-certs.js)
├── certs/              Generated self-signed TLS cert (created by scripts/, gitignored)
├── docs/               Additional documentation
├── PROJECT_SPEC.md
├── IMPLEMENTATION_STATUS.md
├── FINAL_TEST_REPORT.md
└── README.md           (this file)
```

---

## 4. Prerequisites (Windows)

Install these first:

1. **Node.js 18+** — https://nodejs.org (LTS version)
2. **Python 3.10+** — https://www.python.org/downloads/ (check "Add Python to PATH" during install)
3. **PostgreSQL 14+** — https://www.postgresql.org/download/windows/
   During install, set a password for the `postgres` superuser and remember it.
4. **Git** (optional, if cloning) — https://git-scm.com

Verify installs in a Command Prompt / PowerShell:
```
node --version
python --version
psql --version
```

---

## 5. Database Setup

Open **Command Prompt** (or **pgAdmin** if you prefer a GUI) and run:

```
# Create the database
psql -U postgres -c "CREATE DATABASE smart_retail;"

# Apply the schema
psql -U postgres -d smart_retail -f database\schema.sql

# Load demo data
psql -U postgres -d smart_retail -f database\seed.sql
```

You'll be prompted for the `postgres` user's password each time.

This creates:
- 1 owner account + 5 customer accounts (all use password `password123`)
- 8 categories, 28 realistic products with barcodes
- Realistic inventory (some products intentionally low-stock, some overstocked, for AI demo purposes)
- 45 days of historical sales data and a handful of sample orders

---

## 6. Backend Setup

```
cd backend
copy .env.example .env
```

Edit `.env` and set your PostgreSQL password:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/smart_retail
JWT_SECRET=any_long_random_string_here
```

Install and run:
```
npm install
npm start
```

You should see:
```
Smart Retail backend running on http://localhost:5000
```

Verify: open http://localhost:5000/api/health in a browser — you should see `{"status":"ok",...}`.

---

## 7. AI Service Setup

Open a **new** terminal window:

```
cd ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` if your PostgreSQL password/user differs from the default.

Run it:
```
uvicorn main:app --reload --port 8000
```

Verify: open http://localhost:8000/docs — you'll see interactive API documentation (Swagger UI).

---

## 8. Frontend Setup

Open a **third** terminal window:

```
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open the URL it prints (typically **http://localhost:5173**).

---

## 9. Demo Accounts

All seeded accounts use the password: **`password123`**

| Role | Email |
|---|---|
| Owner | owner@smartretail.com |
| Customer | aditi@example.com |
| Customer | rohan@example.com |
| Customer | neha@example.com |
| Customer | karan@example.com |
| Customer | priya@example.com |

New customers can also self-register from the app.

---

## 10. Testing the Real-Time Customer ↔ Owner Flow

This is the platform's core feature — verify it across **two different browsers or devices**
(e.g. a normal window + an incognito window, or two different computers on the same network,
both pointed at the same backend URL):

1. **Browser/Device A (Owner):** go to `http://localhost:5173/owner/login`, sign in as
   `owner@smartretail.com`. Open the **Orders** page and leave it open.
2. **Browser/Device B (Customer):** go to `http://localhost:5173/login`, sign in as
   `aditi@example.com`. Browse products, add a couple to the cart, and click **Place order**.
3. On the **Owner** screen, a 🔔 toast and a new order card should appear **instantly** —
   no refresh needed.
4. Click **Accept** on the owner side. Watch the **Customer's** Orders page — the status
   should flip to `ACCEPTED` live.
5. Move it through `PREPARING → READY → COMPLETED` on the owner side and watch each
   update land instantly on the customer's screen.

> To test across two physical computers, see **Section 10.5 — Running on a Network IP
> (Multi-Device / Presenting to Others)** below for the full setup, including HTTPS
> (required if you need the camera/barcode scanner to work on a non-host device).

---

## 10.5. Running on a Network IP (Multi-Device / Presenting to Others)

By default, everything runs on `localhost`, which only works on one machine. To run the
customer interface on one laptop and the owner interface on another (e.g. presenting to
judges), point the whole project at your host laptop's network IP instead.

**Important:** browsers only allow **camera access** (for barcode scanning) on a "secure
context" — `https://`, or `http://localhost` specifically. A plain `http://<ip>` address is
always blocked for camera use, no matter what. There's no way around this with plain HTTP.
If you only need the *customer* device to work (no camera there anyway), plain HTTP is fine.
If the *owner* device also needs to scan barcodes while accessed via IP, you need HTTPS —
covered below.

### Recommended: keep it simple by using `localhost` on the owner's own device

If the owner's laptop is the one running all three services (the usual setup), you don't need
HTTPS at all — just always open the app via `http://localhost:5173` **on that laptop**
specifically (not the IP), even while a second laptop connects via the IP. `localhost` is
always a secure context, so the camera works there with zero extra setup. Only the customer's
laptop needs the IP, and it never touches the camera.

### If you need the camera to work on a non-localhost device too (HTTPS setup)

A one-time setup script handles this — it generates a free self-signed certificate for your
chosen IP and reconfigures all three services to use it.

**One-time setup:**
```
cd scripts
npm install
```

**Every time you want to switch to a network IP** (e.g. a different Wi-Fi/hotspot each demo):
```
cd scripts
node set-network.js 192.168.1.50
```
Replace `192.168.1.50` with your actual host laptop's IP (find it via `ipconfig`). This single
command:
- Generates an HTTPS certificate valid for that IP (`certs/cert.pem`, `certs/key.pem`)
- Rewrites `backend/.env` and `frontend/.env` to point at that IP over HTTPS
- Prints the exact commands to run next

**To switch back to local-only development later:**
```
node set-network.js localhost
```

**Then start all three services** (the script prints these exact commands too):
```
# Terminal 1
cd backend
npm start

# Terminal 2
cd ai-service
venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile ../certs/key.pem --ssl-certfile ../certs/cert.pem

# Terminal 3
cd frontend
npm run dev -- --host 0.0.0.0
```

Open `https://<your-ip>:5173` on **every** device — owner and customer laptops alike.

**One unavoidable step per device:** since the certificate is self-signed (free, not issued by
a public certificate authority), every browser will show a **"Your connection is not
private"** warning the first time. This is expected, not an error — click
**Advanced → Proceed to site (unsafe)** once per device/browser. After that, the session works
normally, camera included.

**Also allow the ports through Windows Firewall** (PowerShell, run as Administrator, one-time):
```
New-NetFirewallRule -DisplayName "SmartRetail-5000" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "SmartRetail-5173" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "SmartRetail-8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

**Tip:** conference/venue Wi-Fi often blocks devices from seeing each other ("client
isolation"). If two devices can't reach each other even with the above set up correctly, turn
on a phone mobile hotspot and connect both laptops to that instead — it's more reliable than
fighting venue network restrictions.

---

## 11. Testing POS / Billing

1. Sign in as the owner, go to **POS / Billing**.
2. Type a barcode (e.g. `89100000001` for Maggi Noodles) into the barcode field and press Enter,
   or click **📷 Scan with camera** to use a webcam (camera stays open across scans — see the
   Barcode System section below).
3. Adjust quantity, pick a payment method, click **Complete sale**.
4. A printable receipt appears — inventory is deducted immediately and the sale is recorded.
5. Use the **Download statement (CSV)** control at the top of this page to export a transaction
   statement for a chosen date range — it covers both POS sales and completed customer orders.

---

## 12. Testing AI Features

With the AI service running, go to **Owner → AI Insights**:
- **Stock-out risk** — shows every product's estimated days until stock-out and a risk level.
  Try it right after seeding: "Maggi Noodles 70g" and "Coca-Cola 750ml" are seeded with low
  stock and healthy sales velocity, so they should show as MEDIUM/HIGH risk immediately.
- **Demand forecast** — 7/30-day predicted units and a recommended reorder quantity per product.
- **Dead/slow stock** — "Harpic Toilet Cleaner", notebooks, and pens are seeded with high stock
  and almost no recent sales, so they'll appear here with a discount/bundle recommendation.

Product recommendations appear automatically on any **Product Detail** page for customers.

---

## 13. Barcode System

- **Manual entry**: type any barcode into the search bar (customer) or POS barcode field (owner).
- **USB barcode scanners**: work out of the box — they behave like a keyboard, typing the code
  followed by Enter, which the POS field listens for.
- **Webcam scanning**: click "📷 Scan barcode" on the POS page, Products page, or Inventory page.
  The scanner lists all cameras connected to your device and lets you pick which one to use
  (useful on laptops/phones with more than one camera). It's configured for **EAN-13** — the
  standard retail barcode format. Uses the free, open-source `html5-qrcode` library. In POS
  billing specifically, the camera **stays open across multiple scans** (with a 2-second
  per-barcode cooldown to avoid double-adding) so you can scan a whole basket of items without
  reopening the camera each time.
- **Camera requires a secure context**: browsers only allow camera access on `https://` or
  `http://localhost` — never plain `http://<ip>`. This only matters if you're accessing the app
  from a network IP instead of localhost; see **Section 10.5** for the HTTPS setup needed in
  that case.
- **Online auto-fill when adding a product**: scanning a barcode while adding a new product
  (from either the Products page or the Inventory page) automatically looks it up against
  **Open Food Facts** — a free, open, keyless product database — and pre-fills the name and
  description if a match is found. Price and category are never available online, so you always
  fill those in yourself; if there's no online match, the barcode is still captured and you can
  fill in the rest by hand. Manual entry (no scanning at all) is always available too.
- Products without a barcode can still be added manually by the owner via **Products → Add product**
  or **Inventory → Add product**.

---

## 14. Inventory Strategy (Important)

- Adding an item to a cart does **not** touch inventory.
- Placing an order only **validates** stock is available — it does not deduct it yet.
- Stock is deducted **only when the owner clicks Accept** (PENDING → ACCEPTED). This is the
  single point of deduction, preventing double-deduction.
- If an accepted order is later rejected, the previously deducted stock is **restored**.
- POS sales deduct stock immediately, since a POS sale is a completed transaction at the counter.
- All of the above run inside PostgreSQL transactions with row-level locking (`FOR UPDATE`),
  so concurrent requests can never push stock negative or double-count a change.
- Every change is logged in `stock_movements` with a `movement_type` (`RESTOCK`,
  `MANUAL_ADJUSTMENT`, `SALE`, `ORDER_RESERVE`, `ORDER_RESTORE`, `CORRECTION`) for a full audit trail.
- **Completing a customer order collects payment**: moving an order to `READY → COMPLETED`
  opens a payment-collection step (Cash/UPI/Card), records the transaction in the same `sales`
  table POS billing uses, and shows a printable receipt — so completed online orders and POS
  sales both appear together in the transaction statement export (Section 11).

---

## 15. Known Limitations

- Payment methods (Cash/UPI/Card) are simulated — no real payment gateway is integrated.
- The webcam barcode scanner requires camera permission in the browser and works best in
  good lighting with a clear, non-glossy barcode. It's configured for EAN-13; if you need to
  scan other formats, adjust the `formats` prop passed to `BarcodeScanner`.
- Camera access requires HTTPS when accessed via a network IP (browsers block it on plain
  `http://<ip>`). The bundled HTTPS setup (Section 10.5) uses a free self-signed certificate,
  which means every device will show a one-time "not secure" browser warning to click through —
  this is expected for self-signed certs, not a bug, and doesn't affect functionality afterward.
- The online barcode lookup (Open Food Facts) has strongest coverage for packaged grocery/FMCG
  products — not every barcode will have a match, especially store-specific or regional products.
  When there's no match, the barcode is still captured and you fill in the rest by hand.
- The AI models are intentionally simple (linear regression / rule-based heuristics) —
  appropriate for a demo dataset, not tuned for large-scale production forecasting.
- No automated end-to-end browser test suite ships with this project (see
  `FINAL_TEST_REPORT.md` for exactly what *was* tested and how).
- Single-store only; no multi-tenant support.

---

## 16. Future Scope (Hardware Integrations — Not Required Today)

The current prototype is designed to run on ordinary computers/laptops with, at most, a USB
barcode scanner or a webcam. Documented here for future extension, **not required to run the
project today**:

- **Raspberry Pi** as an in-store kiosk running the customer or POS interface.
- **Arduino + weight sensors** on shelves for automatic stock-level detection.
- **RFID tags** on products for frictionless inventory counts (replacing manual barcode scans).
- **IoT smart shelves** that push stock-movement events directly into the `stock_movements` table.
- **Automated physical inventory reconciliation** via periodic RFID/weight-sensor sweeps compared
  against the `inventory` table.

None of this hardware is required for the current prototype — it runs entirely on standard
computers and browsers.
## 🤖 Local AI Store Assistant — Gemma 4

Smart Retail Intelligence Platform includes a locally running AI chatbot powered by **Gemma 4 (`gemma4:e2b`) through Ollama**. It provides a conversational interface for the store owner without depending on a paid AI API.

### ✨ Features

- **Local AI inference:** Runs the Gemma 4 model through Ollama on the local machine.
- **Store-owner assistant:** Provides a chat interface within the authenticated store-owner area.
- **Natural-language interaction:** Allows the owner to ask questions and interact with the assistant using everyday language.
- **No paid AI API:** Does not require a paid OpenAI or other hosted-model API key.
- **Local model execution:** Prompts are sent to the local Ollama service rather than a third-party hosted AI provider.
- **Existing authentication:** The chatbot is intended for the authenticated store-owner interface, keeping it separate from customer-facing pages.
- **Lightweight integration:** Uses the existing application stack and Ollama's local HTTP API.

### 🧠 Technology Stack

| Component | Technology |
|---|---|
| Language model | Gemma 4 (`gemma4:e2b`) |
| Local model runtime | Ollama |
| Model API | Ollama Chat API (`/api/chat`) |
| Application backend | Node.js + Express |
| Frontend | React |
| Access | Authenticated store-owner interface |

### 🔒 Privacy & Deployment

The model runs locally through Ollama, so chatbot inference does not inherently require sending prompts to a hosted AI provider. The application and Ollama must be running on the relevant machine, and the local model must be downloaded before use.

The chatbot is designed to avoid requiring a paid AI API key. Actual privacy boundaries depend on the application's implementation, logging, and any external services used by other features.

### ⚙️ Setup

1. Install [Ollama](https://ollama.com/).
2. Download the configured model:

   ```bash
   ollama pull gemma4:e2b
   ```

3. Start Ollama and ensure the model is available locally.
4. Start the Smart Retail backend and frontend using the project's normal setup instructions.
5. Sign in to the store-owner interface and open the AI chat feature.

### 🚀 Future Enhancements

- Connect the assistant to current inventory and sales data through controlled backend tools.
- Ask natural-language questions about low-stock items and reorder suggestions.
- Summarize sales trends and slow-moving products.
- Generate draft distributor order lists.
- Support Hindi and English conversations.
- Provide context-aware assistance based on the store's actual data, with role-based access controls.

> **Current capability note:** Inventory queries, sales analysis, reorder actions, and Hindi support should be described as implemented only after they have been integrated and tested. A locally running language model alone does not automatically have access to the store database.