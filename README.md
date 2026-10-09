# SIMULATED-DEMO-STORE

> **ShopSphere & AgentGuard AI Security — Modern E-Commerce Marketplace**

**SIMULATED-DEMO-STORE (ShopSphere)** is a complete, full-stack online shopping marketplace and AI agent security platform. Built with a **React + Vite** frontend, Tailwind CSS, an **Express + Node.js** REST backend, **AgentGuard** Gateway protection, and a serverless-ready **SQLite** database prepared for **Vercel** deployment.

---

## Highlights & Features

- **Professional Blue-and-White Branding**: Responsive, modern user interface with smooth transitions, interactive product cards, category carousels, and search filters.
- **Integer Paise Price Engine**: All database storage and server calculations strictly use integer paise (1 INR = 100 paise; e.g. ₹1,499.00 = `149900` paise) to prevent floating-point rounding errors.
- **Atomic Checkout & Inventory Management**: Safe database transactions (`BEGIN IMMEDIATE TRANSACTION`) check stock, compute pricing from database records, deduct stock, and empty carts atomically.
- **Secure Server-Side Sessions & bcrypt**: Passwords salted and hashed with bcrypt. Authenticated state stored via `express-session` with signed, `HttpOnly`, `SameSite=Lax` cookies.
- **Role-Based Access Control**: Server-side route authorization middleware (`requireAuth`, `requireAdmin`) strictly protects admin endpoints and order ownership.
- **Admin Dashboard**: Live metrics (revenue, orders, low stock), live product CRUD, stock adjustment, and full order lifecycle tracking.
- **Simulated Demo Payments**: Explicitly simulated mock checkout with safety disclaimers. Never requests real payment or credit card details.
- **Automated Test Suite**: 23 automated integration tests across Auth, Products, Cart, Checkout transactions, and Admin permissions.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, Lucide Icons, React Router 6 |
| **Backend** | Node.js 20, Express 4, express-session, bcryptjs, helmet, cors, express-rate-limit |
| **Database** | SQLite 3 (`better-sqlite3` with WAL mode & foreign keys enabled) |
| **Testing** | Node.js Native Test Runner (`node:test`, `node:assert`) |

---

## Directory Structure

```
amazon fake/
├── backend/
│   ├── src/
│   │   ├── config/          # Database (WAL mode, busy_timeout) & Session config
│   │   ├── controllers/     # Auth, Products, Cart, Orders, Admin controllers
│   │   ├── db/              # schema.sql, initDb.js, seed.js, seedAdmin.js
│   │   ├── middleware/      # auth (requireAuth, requireAdmin), rateLimiter, validate, errorHandler
│   │   ├── routes/          # authRoutes, productRoutes, cartRoutes, orderRoutes, adminRoutes
│   │   ├── app.js           # Express app setup, CORS, Helmet, routes
│   │   └── server.js        # Server entry point
│   ├── tests/               # Automated integration tests (node:test)
│   ├── .env.example         # Backend environment variable template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Navbar, Footer, ProductCard, RatingStars, Badges, etc.
│   │   ├── context/         # AuthContext, CartContext
│   │   ├── pages/           # Home, Products, Details, Search, Cart, Login, Register, Checkout, Confirmation, Account, Orders, Admin
│   │   ├── services/        # api.js with credentials
│   │   ├── utils/           # formatters.js (integer paise -> ₹)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vite.config.js       # Vite proxy to backend port 5000
│   ├── tailwind.config.js
│   └── package.json
├── API_DOCUMENTATION.md      # Comprehensive REST API endpoint reference
├── README.md                 # Project guide & run instructions
└── package.json              # Root orchestrator scripts
```

---

## Quick Start & Installation

### 1. Prerequisites
- **Node.js** (v18+ or v20+ recommended)
- **npm** (v9+ or v10+)

### 2. Install Dependencies

Install both backend and frontend dependencies:

```bash
# In backend folder
cd backend
npm install

# In frontend folder
cd ../frontend
npm install
```

### 3. Configure Environment Variables

The backend includes a pre-configured `.env` and `.env.example`:

```bash
# Inside backend/
cp .env.example .env
```

Contents of `backend/.env`:
```env
PORT=5000
NODE_ENV=development
SESSION_SECRET=shopsphere_super_secret_dev_session_key_2026_xyz
CLIENT_URL=http://localhost:5173
DATABASE_PATH=./src/db/shopsphere.db
```

---

## Database Initialization & Seeding

### Initialize Database & Sample Products
To create the SQLite schema and seed 25 realistic products across Electronics, Fashion, Books, Accessories, and Home Products:

```bash
# From project root:
npm run seed

# OR from backend directory:
cd backend
npm run db:seed
```

### Creating Administrator Accounts
ShopSphere provides a documented CLI script to securely create administrator accounts:

```bash
# Default admin (admin@shopsphere.com / Admin@123456):
npm run seed:admin

# Custom administrator creation:
node src/db/seedAdmin.js customadmin@shopsphere.com SecurePass@2026 "Lead Admin"
```

---

## Demo Login Credentials

For testing and evaluation, one-click demo login buttons are provided on the login page, or you can enter these credentials manually:

| Account Type | Email | Password | Role |
|---|---|---|---|
| **Administrator** | `admin@shopsphere.com` | `Admin@123456` | `admin` |
| **Customer** | `customer@shopsphere.com` | `Customer@123456` | `customer` |

---

## Running the Application

### Option A: Run Both Services Concurrently
From two separate terminals:

**Terminal 1 — Backend API Server:**
```bash
cd backend
npm start
```
*API runs at:* `http://localhost:5000`  
*Health Check:* `http://localhost:5000/api/health`

**Terminal 2 — Frontend React Client:**
```bash
cd frontend
npm run dev
```
*Frontend runs at:* `http://localhost:5173`

---

## Running Automated Tests

Run the backend integration test suite using Node's built-in test runner:

```bash
cd backend
npm test
```

### Tests Covered:
- **`tests/auth.test.js`**: User registration, duplicate email rejection, session creation, password verification, `me` endpoint, logout.
- **`tests/products.test.js`**: Catalog pagination, category filtering, text search, product detail retrieval, category counts.
- **`tests/cart-checkout.test.js`**: Cart addition, stock limits, subtotal/shipping calculation, atomic checkout transaction, stock decrement, cart clearing, order history, and cross-user ownership isolation.
- **`tests/admin.test.js`**: Unauthenticated 401 rejection, customer 403 Forbidden rejection, admin metrics retrieval, product creation, stock updates, and order status transitions.

---

## Local URLs

- **Storefront Home**: `http://localhost:5173`
- **Product Catalog**: `http://localhost:5173/products`
- **Shopping Cart**: `http://localhost:5173/cart`
- **Checkout**: `http://localhost:5173/checkout`
- **Customer Sign In**: `http://localhost:5173/login`
- **Customer Registration**: `http://localhost:5173/register`
- **Order History**: `http://localhost:5173/orders`
- **Customer Account**: `http://localhost:5173/account`
- **Admin Dashboard**: `http://localhost:5173/admin`
- **Backend Health Check**: `http://localhost:5000/api/health`
