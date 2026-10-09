# ShopSphere + AgentGuard — Vercel Deployment Guide

This guide walks you through deploying the unified ShopSphere full-stack e-commerce marketplace and AgentGuard AI Security suite to **[Vercel](https://vercel.com/)** in minutes.

---

## 1. Architecture on Vercel

```
                               ┌─────────────────────────────────────────────────────────────┐
                               │                    Vercel Edge Network                      │
                               └──────────────────────────────┬──────────────────────────────┘
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                       ▼                                             ▼
                             Static Routes (/*)                            API Routes (/api/*)
                                       │                                             │
                                       ▼                                             ▼
                         ┌───────────────────────────┐                 ┌───────────────────────────┐
                         │   Vite React Storefront   │                 │ Express Serverless Lambda │
                         │     (frontend/dist)       │                 │       (api/index.js)      │
                         └───────────────────────────┘                 └─────────────┬─────────────┘
                                                                                     │
                                                                       ┌─────────────┴─────────────┐
                                                                       ▼                           ▼
                                                             Writable SQLite DB          OpenRouter AI Agents
                                                             (/tmp/shopsphere.db)         & AgentGuard Gateway
```

- **Frontend**: Vite React SPA pre-built to `frontend/dist`, cached globally across Vercel CDN edges.
- **Backend**: Express API deployed as a high-performance Serverless Function at `api/index.js`.
- **Database**: SQLite initialized automatically in `/tmp/shopsphere.db` on serverless cold starts. Pre-seeded with 52 catalog items, demo administrator, and customer account.
- **Routing**: `vercel.json` maps `/api/(.*)` to the serverless function and `/(.*)` to `index.html` (for client-side routing).
- **Authentication**: Stateful sessions stored in SQLite with `trust proxy` enabled for secure HTTPS cookies.

---

## 2. Prerequisites

1. A [Vercel account](https://vercel.com/signup).
2. A [GitHub](https://github.com), GitLab, or Bitbucket account (or the [Vercel CLI](https://vercel.com/docs/cli)).
3. (Optional) An [OpenRouter API Key](https://openrouter.ai/) to activate real LLM responses for the 7 AI agents.

---

## 3. Deployment Methods

### Option A: Deploy via GitHub (Recommended)

1. **Push your code to a GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "feat: complete ShopSphere and AgentGuard Vercel deployment setup"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your repository and click **Import**.

3. **Configure Project Settings**:
   - **Project Name**: `shopsphere` (or your choice).
   - **Framework Preset**: `Vite` (or `Other`).
   - **Root Directory**: `./` (leave as default root).
   - **Build Command**: `npm run build` (detected automatically from `vercel.json`).
   - **Output Directory**: `frontend/dist` (detected automatically from `vercel.json`).

4. **Add Environment Variables** (see Section 4).

5. Click **Deploy**. Vercel will install dependencies, build the frontend, package the serverless function, and give you a live production URL!

---

### Option B: Deploy via Vercel CLI

If you have the Vercel CLI installed:

```bash
# 1. Login to Vercel
vercel login

# 2. Deploy directly from the project directory
vercel

# 3. Deploy to production
vercel --prod
```

---

## 4. Environment Variables Reference

Configure these in the Vercel Dashboard under **Project Settings → Environment Variables**:

| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Optional | `production` | Enables production optimizations. |
| `SESSION_SECRET` | Recommended | `shopsphere_secure_session_key_2026_xyz` | Used to sign session cookies. |
| `OPENROUTER_API_KEY` | Optional | `sk-or-v1-...` | Global API key for the 7 AI Agents (OpenRouter). |
| `ORDER_AGENT_API_KEY` | Optional | `sk-or-v1-...` | Per-agent key for OrderAgent. |
| `PAYMENT_AGENT_API_KEY` | Optional | `sk-or-v1-...` | Per-agent key for PaymentAgent. |
| `WAREHOUSE_AGENT_API_KEY` | Optional | `sk-or-v1-...` | Per-agent key for WarehouseAgent. |
| `TRACKING_AGENT_API_KEY` | Optional | `sk-or-v1-...` | Per-agent key for TrackingAgent. |
| `SUPPORT_AGENT_API_KEY` | Optional | `sk-or-v1-...` | Per-agent key for CustomerSupportAgent. |
| `RETURN_AGENT_API_KEY` | Optional | `sk-or-v1-...` | Per-agent key for ReturnAgent. |
| `REFUND_AGENT_API_KEY` | Optional | `sk-or-v1-...` | Per-agent key for RefundAgent. |
| `CLIENT_URL` | Optional | Auto-detected | Custom frontend origin (auto-permits `*.vercel.app`). |

---

## 5. Verification & Testing

Once deployed to `https://<your-project>.vercel.app`:

1. **Verify Health Endpoint**:
   ```
   GET https://<your-project>.vercel.app/api/health
   ```
   Should return: `{"status":"ok","service":"ShopSphere API","timestamp":"..."}`

2. **Browse Storefront**:
   - Visit `https://<your-project>.vercel.app`
   - Browse catalog, search items, add to cart, and checkout.

3. **Log In to Demo Accounts**:
   - **Customer Account**:
     - Email: `customer@shopsphere.com`
     - Password: `Customer@123456`
   - **Admin Account**:
     - Email: `admin@shopsphere.com`
     - Password: `Admin@123456`

4. **AgentGuard Security Dashboard**:
   - Navigate to `https://<your-project>.vercel.app/admin`
   - Open the **AgentGuard Security** tab.
   - Test connecting/disconnecting the Gateway, live damage metrics, and simulating direct vs protected attacks!
