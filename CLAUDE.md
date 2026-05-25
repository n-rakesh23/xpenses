# Xpense — Full Project Specification for Claude Code

## Overview
Xpense is a WhatsApp + Telegram expense tracker. Users message their expenses
("coffee 80", "uber 200 transport") to a bot. The bot parses the amount and
category, saves it to PostgreSQL, and replies with a confirmation. Users log in
to a personal web dashboard to view daily, weekly, monthly, and yearly spending
with charts, a calendar heatmap, and transaction history.

## Freemium Model
- **Free plan**: Telegram bot only. 30-day history. No receipts. No export. No budget alerts.
- **Pro plan** (₹199/month): WhatsApp + Telegram. Unlimited history. Receipts.
  Budget alerts. Weekly auto-summary. CSV/PDF export. AI insights.

---

## Tech Stack

### Backend
- Runtime: Node.js 20
- Framework: Express 4
- Database: PostgreSQL 15 (via `pg` driver)
- Cache / State: Redis 7 (via `ioredis`)
- Job Queue: BullMQ
- Auth: JWT (jsonwebtoken) — magic link only, no passwords
- File Storage: Cloudinary (receipt images)
- HTTP Client: axios
- Logging: Winston
- Validation: express-validator
- Scheduling: node-cron
- PDF Export: pdfkit
- Testing: Jest + supertest

### Frontend
- Framework: React 18 + Vite
- Styling: Tailwind CSS (via @tailwindcss/vite)
- Routing: React Router v6
- Charts: Chart.js + react-chartjs-2
- HTTP: axios (withCredentials: true for cookie auth)
- Date utils: date-fns
- State: React hooks only — no Redux

### Infrastructure
- Backend hosting: Railway (with PostgreSQL and Redis add-ons)
- Frontend hosting: Vercel
- Receipt storage: Cloudinary free tier

---

## Folder Structure

```
xpense-app/
├── CLAUDE.md
├── .env.example
├── README.md
├── docker-compose.yml          # local dev: postgres + redis
│
├── backend/
│   ├── package.json
│   ├── index.js                # Express app, mounts all routes
│   ├── jest.config.js
│   ├── Procfile                # for Railway: web: node index.js
│   ├── railway.json
│   └── src/
│       ├── db/
│       │   ├── schema.sql      # all CREATE TABLE statements
│       │   ├── pool.js         # pg Pool instance
│       │   └── queries.js      # all DB query functions
│       ├── webhooks/
│       │   ├── whatsapp.js     # Express router: GET+POST /webhook/whatsapp
│       │   └── telegram.js     # Express router: POST /webhook/telegram
│       ├── routes/
│       │   ├── auth.js         # magic link, verify, logout
│       │   ├── expenses.js     # CRUD endpoints
│       │   ├── dashboard.js    # stats, summary
│       │   ├── budgets.js      # budget CRUD
│       │   └── export.js       # CSV + PDF (pro only)
│       ├── services/
│       │   ├── parser.js       # expense text parser
│       │   ├── reply.js        # send WhatsApp / Telegram messages
│       │   ├── state.js        # Redis conversation state machine
│       │   ├── storage.js      # Cloudinary upload/download
│       │   └── insights.js     # Claude API weekly insights (pro)
│       ├── middleware/
│       │   ├── auth.js         # JWT session validation
│       │   ├── plan.js         # plan gate (free vs pro)
│       │   ├── rateLimit.js    # per-user rate limits
│       │   └── validate.js     # express-validator helpers
│       ├── jobs/
│       │   ├── weeklySummary.js  # BullMQ worker, every Sunday 8am IST
│       │   └── budgetAlert.js    # triggered after each expense save
│       └── utils/
│           ├── logger.js       # Winston instance
│           ├── crypto.js       # HMAC helpers
│           └── format.js       # currency, date formatters
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   ├── vercel.json
│   └── src/
│       ├── main.jsx            # React Router setup
│       ├── App.jsx
│       ├── api/
│       │   └── client.js       # axios instance with base URL + credentials
│       ├── hooks/
│       │   ├── useAuth.js
│       │   ├── useExpenses.js
│       │   └── useDashboard.js
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx   # overview tab
│       │   ├── Calendar.jsx    # calendar tab
│       │   └── Transactions.jsx # transactions tab
│       └── components/
│           ├── Layout.jsx      # top nav + sub-nav tabs
│           ├── StatsRow.jsx    # 4 metric cards
│           ├── SpendingChart.jsx
│           ├── CategoryDonut.jsx
│           ├── TransactionList.jsx
│           ├── CalendarGrid.jsx
│           ├── YearGrid.jsx
│           ├── BudgetBar.jsx
│           └── PlatformBadge.jsx
│
└── tests/
    └── backend/
        ├── parser.test.js
        ├── auth.test.js
        ├── expenses.test.js
        └── webhooks.test.js
```

---

## Database Schema

### users
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        VARCHAR(20) NOT NULL CHECK (platform IN ('whatsapp','telegram')),
  platform_user_id VARCHAR(100) NOT NULL,
  phone           VARCHAR(20),
  name            VARCHAR(100),
  plan            VARCHAR(10) NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  plan_expires_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, platform_user_id)
);
CREATE INDEX idx_users_platform_id ON users(platform, platform_user_id);
```

### expenses
```sql
CREATE TABLE expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0 AND amount <= 100000),
  category    VARCHAR(20) NOT NULL CHECK (category IN
              ('food','transport','shopping','entertainment','health','other')),
  description TEXT,
  note        TEXT,
  receipt_url TEXT,
  message_id  VARCHAR(100),
  platform    VARCHAR(20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_expenses_user_created ON expenses(user_id, created_at DESC);
CREATE INDEX idx_expenses_user_category ON expenses(user_id, category);
```

### conversation_state
```sql
CREATE TABLE conversation_state (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state            VARCHAR(30) NOT NULL DEFAULT 'idle',
  pending_category VARCHAR(20),
  pending_expense_id UUID REFERENCES expenses(id),
  context          JSONB,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);
```

### sessions
```sql
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
```

### budgets
```sql
CREATE TABLE budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    VARCHAR(20) NOT NULL,
  monthly_limit NUMERIC(10,2) NOT NULL CHECK (monthly_limit > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category)
);
```

---

## Environment Variables

All of these must be in `.env` for local development. Never hardcode any of them.
Create `.env.example` with all keys present but empty values.

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/xpense

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-256-bit-secret-here
JWT_MAGIC_LINK_EXPIRY=15m
JWT_SESSION_EXPIRY=7d

# WhatsApp (Meta Cloud API)
WHATSAPP_TOKEN=your-whatsapp-access-token
WHATSAPP_PHONE_ID=your-phone-number-id
META_APP_SECRET=your-meta-app-secret
META_VERIFY_TOKEN=your-custom-webhook-verify-token

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
TELEGRAM_SECRET_TOKEN=your-custom-secret-for-webhook-header

# Cloudinary
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# App
APP_URL=http://localhost:5173
API_URL=http://localhost:3000
PORT=3000
NODE_ENV=development

# Razorpay (for upgrade payments)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
```

---

## Expense Parser Rules (parser.js)

The `parseExpense(text)` function must handle all of these input formats:

```
"coffee 80"              → { amount: 80,   category: "food",      description: "coffee" }
"uber 200"               → { amount: 200,  category: "transport", description: "uber" }
"spent 450 on lunch"     → { amount: 450,  category: "food",      description: "lunch" }
"₹150 chai"              → { amount: 150,  category: "food",      description: "chai" }
"1200 amazon shopping"   → { amount: 1200, category: "shopping",  description: "amazon" }
"medicine 350"           → { amount: 350,  category: "health",    description: "medicine" }
"800"                    → { amount: 800,  category: "other",     description: null }
"netflix 649"            → { amount: 649,  category: "entertainment", description: "netflix" }
"random text"            → null
```

Category keyword mapping:
- **food**: coffee, chai, tea, lunch, dinner, breakfast, swiggy, zomato, restaurant,
  meal, food, snack, grocery, groceries, biscuit, water, juice, eat, biryani,
  pizza, burger, maggi, dosa, idli
- **transport**: uber, ola, auto, metro, bus, train, petrol, diesel, fuel, cab,
  taxi, fare, toll, parking, rapido, flight, ticket, travel
- **shopping**: amazon, flipkart, meesho, myntra, mall, clothes, shirt, shoes,
  online, order, purchase, buy, bought
- **entertainment**: netflix, hotstar, prime, spotify, youtube, movie, cinema,
  game, pub, bar, concert, match, ticket, subscription
- **health**: pharmacy, medicine, doctor, hospital, clinic, gym, yoga, chemist,
  tablet, injection, test, lab, health, medic
- **other**: anything not matched above

Return format:
```js
{
  amount: Number,        // parsed rupee amount (float)
  category: String,      // one of the 6 categories
  description: String,   // cleaned-up description text
  confidence: 'high' | 'low'  // high = regex matched, low = guessed
}
```

Return `null` if no valid number found or amount is outside 1–100000.

---

## Conversation State Machine

States per user stored in Redis (key: `state:{user_id}`, TTL: 10 minutes):

```
idle              → user sends free-text expense → parse directly
idle              → user sends /menu or "menu"   → show category buttons
awaiting_category → user selects category button → save category, ask for amount
awaiting_amount   → user sends a number          → save expense, send confirmation
awaiting_note     → user sends any text          → save as note, send summary
awaiting_receipt  → user sends a photo           → upload to Cloudinary, attach to expense
```

After saving an expense, always offer: **Add note** | **Add receipt** | **Done**

---

## WhatsApp Message Types

### Interactive list message (category picker)
Use for category selection. Three sections:
- "Food & drinks": Meals & dining (food_meals), Coffee & snacks (food_coffee), Groceries (food_grocery)
- "Transport": Cab / Auto / Uber (transport_cab), Fuel & parking (transport_fuel), Metro / Bus (transport_metro)
- "Bills & more": Shopping (shopping), Subscriptions (entertainment), Health & pharmacy (health), Other (other)

### Interactive button message (post-expense)
Max 3 buttons. Use after expense is logged:
- "Add receipt" (id: add_receipt)
- "Add note" (id: add_note)
- "Done" (id: done)

### Template messages (need Meta approval before use)
- `xpense_welcome`: sent on first contact. Body has {{1}} = user's first name.
- `xpense_weekly_summary`: utility template. Body has {{1}} = week dates, {{2}} = total.
- `xpense_budget_alert`: utility template. Body has {{1}} = category, {{2}} = percentage used.

### Webhook verification
```
GET /webhook/whatsapp
  - verify hub.mode === "subscribe"
  - verify hub.verify_token === META_VERIFY_TOKEN
  - respond with hub.challenge

POST /webhook/whatsapp
  - compute HMAC-SHA256 of raw body using META_APP_SECRET
  - compare with X-Hub-Signature-256 header
  - return 403 immediately if mismatch (do not process)
```

---

## Telegram Message Types

### Inline keyboard (category picker)
2-column grid of buttons. Example:
```
[Food]      [Transport]
[Shopping]  [Entertainment]
[Health]    [Other]
```

### Bot commands (register with /setcommands via BotFather)
- `/start` — welcome message + onboarding
- `/menu` — show main menu with category buttons
- `/summary` — today's total by category
- `/week` — last 7 days spending
- `/budget` — show current budgets vs spending
- `/delete` — delete last expense (with confirm button)
- `/help` — list all commands

### Webhook validation
Every incoming POST to `/webhook/telegram` must have header:
`X-Telegram-Bot-Api-Secret-Token: {TELEGRAM_SECRET_TOKEN}`
Return 403 if missing or wrong.

---

## API Endpoints

All routes under `/api`. All routes except `/auth/*` require valid session cookie.

### Auth
```
POST   /api/auth/magic-link     body: { phone?, platform, platform_user_id }
GET    /api/auth/verify/:token  sets HttpOnly session cookie, redirects to /dashboard
POST   /api/auth/logout         clears session cookie
GET    /api/auth/me             returns current user object
```

### Expenses
```
GET    /api/expenses            query: period=daily|weekly|monthly, page=1, limit=50
GET    /api/expenses/calendar   query: year, month — returns { "2024-01-15": 450, ... }
GET    /api/expenses/categories query: period — returns { food: 1200, transport: 800, ... }
GET    /api/expenses/:id        single expense with receipt URL
POST   /api/expenses            body: { amount, category, description, note }
PATCH  /api/expenses/:id        body: { note?, category?, amount? }
DELETE /api/expenses/:id
```

### Dashboard
```
GET    /api/dashboard/stats     returns { total, avg, topCategory, count, streak }
GET    /api/dashboard/summary   returns chart data for current period
```

### Budgets
```
GET    /api/budgets             returns all budgets for user
POST   /api/budgets             body: { category, monthly_limit }
PUT    /api/budgets/:category   body: { monthly_limit }
DELETE /api/budgets/:category
```

### Export (pro plan only)
```
GET    /api/export/csv          returns CSV file download
GET    /api/export/pdf          returns PDF file download
```

---

## Frontend Pages

### /login (Login.jsx)
- Xpense logo: SVG line-chart icon in a green (#1D9E75) rounded square
- Input: phone number or email
- Primary button: "Continue" → POST /api/auth/magic-link → show success message
- Demo section: 4 clickable user cards (Rahul/Telegram/free, Priya/WhatsApp/pro, Ankit/WhatsApp/pro, Sana/Telegram/free)
- On demo click: immediately set a mock session and redirect to /dashboard

### /dashboard (Dashboard.jsx)
Top navbar contains: logo, "Xpense", flex-1 spacer, user avatar circle (initials), user name, platform badge, logout button.

Sub-navigation tabs: Overview | Calendar | Transactions

Period selector (pill buttons): Daily | Weekly | Monthly

**Overview tab:**
- StatsRow: 4 metric cards (total, average, top category badge, platform badge)
- SpendingChart: line (daily/weekly), bar (monthly), Chart.js, ₹ formatted Y-axis
- CategoryDonut: doughnut chart + custom HTML legend with percentages
- TransactionList: last 6 transactions

**Calendar tab:** renders Calendar.jsx
**Transactions tab:** renders Transactions.jsx

### Calendar.jsx
Sub-tabs: Month | Year

Month view:
- 7-col CSS grid. Day cells: number + ₹amount. Background: 4 green shades as heatmap.
- Click day → detail panel slides in below showing that day's transactions
- Prev/next month arrows

Year view:
- 4×3 grid of month cards. Each: month name, total, progress bar vs highest month.
- Click month card → switch to month view for that month

### Transactions.jsx
- Search input (client-side filter by description)
- Category filter pills (All, Food, Transport, etc.)
- Full transaction list with: category colour dot, description, platform badge, date/time, amount, delete button
- Pagination: load more button (50 per page)
- Export buttons: "Download CSV" and "Download PDF" (pro only — show upgrade prompt if free)

---

## Coding Standards

- Always use `async/await`. Never use callbacks or `.then()` chains.
- Every Express route must have a `try/catch` block. Pass errors to `next(err)`.
- All database queries must use parameterised statements — no string interpolation.
- All user-facing routes must validate inputs with `express-validator`.
- Use `process.env.VARIABLE_NAME` for all secrets. Never hardcode.
- Add JSDoc comments to all exported functions in services/.
- Use Winston for all logging. Never use `console.log` in production code.
- All DB query functions return plain objects, never raw pg RowDataPacket.
- Use UUIDs for all primary keys (`gen_random_uuid()`).
- Every middleware must call `next()` or send a response — never both.
- Frontend: never store JWT or session tokens in localStorage. Cookie only.
- Frontend: all API calls go through `src/api/client.js` (never raw fetch).
- Write at minimum 1 unit test per service function, 1 integration test per route.

---

## Security Rules

1. **Webhook signatures**: always verify X-Hub-Signature-256 (WhatsApp) and
   X-Telegram-Bot-Api-Secret-Token (Telegram). Return 403 immediately on failure.

2. **Row-level access**: every DB query that touches expenses, budgets, or sessions
   MUST include `WHERE user_id = $1` using the authenticated user's ID from the
   session. Never trust a user_id from the request body.

3. **Rate limiting**: apply per-user limits using Redis:
   - Webhook processing: max 20 expense messages per user per hour
   - API routes: max 100 requests per user per 15 minutes

4. **Idempotency**: store the WhatsApp/Telegram message_id on each expense. If the
   same message_id arrives again (duplicate webhook delivery), skip processing and
   return 200 OK.

5. **Plan gating**: the `plan.js` middleware must check `req.user.plan === 'pro'`
   before any premium route. Return `{ error: "upgrade_required", upgrade_url: "..." }`
   with 403 status if plan is free.

6. **Session cookies**: use `httpOnly: true`, `secure: true` (production),
   `sameSite: 'strict'`, `maxAge: 7 days`.

---

## Weekly Summary Job (BullMQ)

Runs every Sunday at 08:00 IST (02:30 UTC). For each active user:

1. Fetch all expenses from the past 7 days grouped by category.
2. Calculate: total spent, top category, biggest single expense, comparison to previous week.
3. Pro users (WhatsApp): send `xpense_weekly_summary` template message.
4. Free users (Telegram): send plain text summary message.
5. Log success/failure per user to Winston.

---

## Budget Alert Job

Triggered synchronously after every successful expense save:

1. Check if user has a budget set for the expense's category.
2. Sum all expenses in that category for the current calendar month.
3. Calculate percentage used: `(monthTotal / budget.monthly_limit) * 100`
4. If >= 80% and < 100%: check Redis for `alert_sent:80:{user_id}:{category}:{month}`.
   If not set: send alert, set Redis key with TTL until end of month.
5. If >= 100%: check Redis for `alert_sent:100:{user_id}:{category}:{month}`.
   If not set: send "exceeded" alert, set Redis key.
6. Never send the same alert level twice in the same month.

---

## Deployment

### Railway (backend)
- `Procfile`: `web: node index.js`
- Add PostgreSQL plugin → sets DATABASE_URL automatically
- Add Redis plugin → sets REDIS_URL automatically
- Set all other env vars in Railway dashboard
- `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": { "startCommand": "node index.js", "healthcheckPath": "/health" }
}
```

### Vercel (frontend)
- `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
- Set `VITE_API_URL` env var in Vercel dashboard pointing to Railway backend URL.

### Docker Compose (local dev)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: xpense
      POSTGRES_USER: xpense
      POSTGRES_PASSWORD: xpense
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

---

## README.md Requirements

The README must include:
1. What the app does (2 sentences)
2. Prerequisites (Node 20, Docker)
3. Local setup steps (clone, .env, docker-compose up, npm install, npm run dev)
4. How to set up the Telegram bot (BotFather steps)
5. How to set up WhatsApp (Meta Developer App steps)
6. All environment variables with descriptions
7. How to run tests
8. How to deploy to Railway + Vercel (step by step)