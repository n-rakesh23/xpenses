# Xpense — Admin Panel Guide

The admin panel is a separate React app that gives you a private dashboard to
monitor all users, expenses, revenue, and live traffic. It talks exclusively to
the backend API — it never touches the database directly.

---

## How It All Connects

```
Admin Browser
    │
    │  http://localhost:5174  (admin React app)
    │
    ▼
Admin React App (admin/)
    │
    │  POST /api/admin/auth/login   → get JWT token
    │  GET  /api/admin/stats        → dashboard numbers
    │  GET  /api/admin/users        → user list
    │  GET  /api/admin/users/:id    → user detail
    │  GET  /api/admin/expenses     → all expenses
    │
    ▼
Backend API (backend/)   port 3000
    │
    │  adminAuth middleware  →  verifies JWT token
    │  admin routes          →  queries the database
    │
    ▼
PostgreSQL Database
    │
    ├── users table
    ├── expenses table
    ├── sessions table
    └── budgets table
```

The admin panel **never has a direct database connection**. Everything goes
through the backend API which validates the admin token before returning any data.

---

## Running the Admin Panel Locally

You need the backend already running (port 3000). Then open a fourth terminal:

```bash
cd D:/Apps/Xpenses/admin
npm run dev
```

Admin panel opens at: **http://localhost:5174**

### Default login credentials

These are set in `backend/.env`:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=xpense-admin-secret-change-this
```

Change these before using in production.

---

## Full Terminal Setup (all 4 together)

```bash
# Terminal 1 — PostgreSQL + Redis are running as services (auto-start after install)

# Terminal 2 — Backend API
cd D:/Apps/Xpenses/backend
npm run dev

# Terminal 3 — User-facing frontend
cd D:/Apps/Xpenses/frontend
npm run dev

# Terminal 4 — Admin panel
cd D:/Apps/Xpenses/admin
npm run dev

# Terminal 5 — Telegram bot (optional)
cd D:/Apps/Xpenses/backend
node poll.js
```

| App | URL |
|---|---|
| User dashboard | http://localhost:5173 |
| Admin panel | http://localhost:5174 |
| Backend API | http://localhost:3000 |

---

## How Authentication Works

```
1. You open http://localhost:5174/login
2. Enter admin username + password
3. Admin panel POSTs to /api/admin/auth/login
4. Backend checks credentials against ADMIN_USERNAME / ADMIN_PASSWORD in .env
5. Backend returns a signed JWT token
6. Admin panel stores the token in localStorage (key: xpense_admin_token)
7. Every subsequent API request includes:  Authorization: Bearer <token>
8. Backend middleware verifies the token on every /api/admin/* route
9. On 401 response → token removed, redirected to /login automatically
```

**Token storage:** `localStorage['xpense_admin_token']`
**Token expiry:** Controlled by `JWT_SESSION_EXPIRY` in `.env` (default: 7 days)

---

## UI Walkthrough — Every Page

---

### Login Page

URL: `http://localhost:5174/login`

```
┌─────────────────────────────────────┐
│          🟩 Xpense Admin            │
│                                     │
│  Username  [________________]       │
│  Password  [________________]       │
│                                     │
│         [ Sign In ]                 │
│                                     │
│    [ Preview with demo data ]       │
└─────────────────────────────────────┘
```

- Dark theme (gray-900 background)
- "Preview with demo data" button — lets you explore the UI without a real backend using built-in mock data
- Shows error message if credentials are wrong

---

### Dashboard Page

URL: `http://localhost:5174/`

The main overview. Auto-refreshes every 30 seconds.

```
┌────────────────────────────────────────────────────────────┐
│  Xpense Admin          Dashboard  Users  Expenses  Logout  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  Total   │ │   Pro    │ │  Total   │ │  Total   │     │
│  │  Users   │ │  Users   │ │ Expenses │ │ Tracked  │     │
│  │  1,284   │ │   312    │ │  38,420  │ │ ₹92.84L  │     │
│  │+47/week  │ │ ₹62k/mo  │ │4210/mo   │ │          │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                            │
│  ┌──────────────────────┐  ┌──────────────────────┐       │
│  │  Platform Split      │  │  Active Users        │       │
│  │                      │  │  347 in last 24h  🟢 │       │
│  │  Telegram ████ 63%   │  └──────────────────────┘       │
│  │  WhatsApp ███  37%   │                                  │
│  │  (bar chart)         │  ┌──────────────────────┐       │
│  └──────────────────────┘  │  Traffic Right Now   │       │
│                             │  23 req / 5 min   🟢 │       │
│  ┌──────────────────────────────────────────────┐  │       │
│  │  New Signups — Last 30 Days (line chart)     │  └───┘   │
│  │  ⠀⠀⠀⡠⠊⠀⠀⡠⠊⠀⠀⡠⠊⠀⠀⡠⠊⠀⠀⡠⠊                    │        │
│  │  Apr 1 ─────────────────────────── Apr 30   │          │
│  └──────────────────────────────────────────────┘          │
│                                                            │
│  Last updated: 1:45:02 PM                                  │
└────────────────────────────────────────────────────────────┘
```

**Stat Cards — what each shows:**

| Card | Data | Source |
|---|---|---|
| Total Users | All registered users + new this week | `users` table |
| Pro Users | Users on paid plan + monthly revenue (₹199 × count) | `users` table |
| Total Expenses | All-time count + this month's count | `expenses` table |
| Total Tracked | Sum of all expense amounts (INR) | `expenses` table |
| Active Users | Users who logged an expense in last 24 hours | `expenses` table |
| Traffic Right Now | API requests in last 5 minutes | Redis counter |

**Charts:**

- **Platform Split** — bar chart comparing Telegram vs WhatsApp user counts with percentages
- **New Signups** — line chart showing daily signup count over the last 30 days

---

### Users Page

URL: `http://localhost:5174/users`

All registered users in a paginated table (20 per page).

```
┌────────────────────────────────────────────────────────────────────┐
│  Users                                          1,284 total users  │
│                                                                    │
│  [Search by name or phone...]  [All Plans ▼]  [All Platforms ▼]   │
│                                                                    │
│  ┌──────┬───────┬──────────┬──────┬──────┬──────┬──────┬───────┐  │
│  │ Name │ Phone │ Platform │ Plan │ Exp  │ Spent│ Last │ Action│  │
│  ├──────┼───────┼──────────┼──────┼──────┼──────┼──────┼───────┤  │
│  │Rahul │+91 98 │ Telegram │ Free │  42  │₹8.2k │ 2h   │Upgrade│  │
│  │Priya │+91 97 │ WhatsApp │ Pro  │ 120  │₹34k  │ 5min │Downgrde│ │
│  │Ankit │+91 99 │ WhatsApp │ Pro  │  87  │₹19k  │ 1d   │Downgrde│ │
│  │ ...  │  ...  │   ...    │ ...  │ ...  │  ... │ ...  │  ...  │  │
│  └──────┴───────┴──────────┴──────┴──────┴──────┴──────┴───────┘  │
│                                                                    │
│  ← Previous    Page 1 of 65    Next →                             │
└────────────────────────────────────────────────────────────────────┘
```

**Columns:**

| Column | Description |
|---|---|
| Name | User's display name (clickable → goes to user detail) |
| Phone | Phone number if provided |
| Platform | Telegram (blue badge) or WhatsApp (green badge) |
| Plan | Pro (purple badge) or Free (gray badge) |
| Expenses | Total count of logged expenses |
| Spent | Sum of all expenses in ₹ |
| Last Active | How long ago they last logged an expense |
| Action | Upgrade to Pro / Downgrade to Free button |

**Filters:**

- **Search** — filters by name or phone number (client-side, instant)
- **Plan filter** — All / Pro / Free
- **Platform filter** — All / Telegram / WhatsApp

**Clicking a row** → opens User Detail page for that user

---

### User Detail Page

URL: `http://localhost:5174/users/:id`

Deep-dive view for one specific user.

```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Users                                           │
│                                                            │
│  ┌─────────────────────────┐  ┌──────────────────────────┐ │
│  │  👤 Priya Sharma        │  │  Recent Expenses         │ │
│  │                         │  │                          │ │
│  │  📱 +91 97654 32109     │  │  🟢 Swiggy          food │ │
│  │  Platform: WhatsApp 🟢  │  │     ₹450    Apr 22, 2pm  │ │
│  │  Plan: Pro 💜           │  │                          │ │
│  │  Expires: May 22, 2025  │  │  🔵 Uber       transport │ │
│  │                         │  │     ₹200    Apr 22, 1pm  │ │
│  │  Expenses: 120          │  │                          │ │
│  │  Total Spent: ₹34,200   │  │  🟣 Netflix entertainment│ │
│  │  Joined: Jan 15, 2025   │  │     ₹649    Apr 21       │ │
│  │  Last Active: 5 min ago │  │                          │ │
│  │                         │  │  🔴 Pharmacy       health│ │
│  │  [ Delete User ]        │  │     ₹350    Apr 21       │ │
│  └─────────────────────────┘  │                          │ │
│                               │  (10 most recent shown)  │ │
│                               └──────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**User card shows:**
- Name with initial avatar
- Phone number
- Platform (Telegram / WhatsApp)
- Plan type and expiry date
- Total expense count and total amount spent
- Account creation date
- Last active timestamp
- Delete User button (permanent, with confirmation)

**Recent Expenses shows:**
- Last 10 expenses for this user
- Color-coded category dot (green=food, blue=transport, purple=entertainment, red=health, orange=shopping, gray=other)
- Description, category label, date/time, amount

---

### Expenses Page

URL: `http://localhost:5174/expenses`

Every expense logged by every user, paginated (50 per page).

```
┌──────────────────────────────────────────────────────────────────┐
│  All Expenses                                  38,420 total      │
│                                                                  │
│  ┌────────┬─────────────┬──────────────┬──────────┬──────┬─────┐ │
│  │  User  │ Description │   Category   │ Platform │  ₹   │Date │ │
│  ├────────┼─────────────┼──────────────┼──────────┼──────┼─────┤ │
│  │ Rahul  │  Swiggy     │ 🟢 food      │ Telegram │  450 │Apr22│ │
│  │ Priya  │  Uber       │ 🔵 transport │ WhatsApp │  200 │Apr22│ │
│  │ Ankit  │  Amazon     │ 🟠 shopping  │ WhatsApp │ 1200 │Apr21│ │
│  │ Sana   │  Doctor     │ 🔴 health    │ Telegram │  800 │Apr21│ │
│  │  ...   │   ...       │    ...       │   ...    │  ... │ ... │ │
│  └────────┴─────────────┴──────────────┴──────────┴──────┴─────┘ │
│                                                                  │
│  ← Previous    Page 1 of 769    Next →                          │
└──────────────────────────────────────────────────────────────────┘
```

**Columns:**

| Column | Description |
|---|---|
| User | Name of the user who logged this expense |
| Description | What they bought (e.g. "Swiggy", "Uber") |
| Category | Color-coded badge (food / transport / shopping / entertainment / health / other) |
| Platform | Where it was logged from (Telegram / WhatsApp) |
| Amount | In ₹ |
| Date | When it was logged |

---

## How the Admin Connects to the Database

The admin panel **never connects directly to PostgreSQL**. Here is the exact chain:

```
Admin Panel                Backend                    PostgreSQL
─────────                  ───────                    ──────────

Login form
  POST /api/admin/auth/login
                    ──────────►  Check ADMIN_USERNAME
                                 Check ADMIN_PASSWORD
                                 Sign JWT token
                    ◄──────────  { token: "eyJ..." }
Store in localStorage

GET /api/admin/stats
Authorization: Bearer eyJ...
                    ──────────►  Verify JWT token
                                 SELECT COUNT(*) FROM users
                                 SELECT COUNT(*) FROM expenses
                                 SELECT SUM(amount) FROM expenses
                                 GET traffic:* keys from Redis
                    ◄──────────  { users, expenses, revenue, traffic }
Render dashboard

GET /api/admin/users?page=1
Authorization: Bearer eyJ...
                    ──────────►  Verify JWT token
                                 SELECT u.*, COUNT(e.id), SUM(e.amount)
                                 FROM users u
                                 LEFT JOIN expenses e ON e.user_id = u.id
                                 GROUP BY u.id
                                 ORDER BY u.created_at DESC
                                 LIMIT 20 OFFSET 0
                    ◄──────────  { users: [...], total: 1284 }
Render table

PATCH /api/admin/users/:id
{ plan: "pro" }
Authorization: Bearer eyJ...
                    ──────────►  Verify JWT token
                                 UPDATE users SET plan='pro'
                                 WHERE id = :id
                    ◄──────────  { user: { ...updated } }
Update row in table
```

---

## Admin API Endpoints Reference

All routes require `Authorization: Bearer <token>` header.

| Method | Endpoint | What it queries |
|---|---|---|
| `POST` | `/api/admin/auth/login` | Checks env vars, returns JWT |
| `GET` | `/api/admin/stats` | Aggregates from users + expenses + Redis |
| `GET` | `/api/admin/users` | users JOIN expenses with filters + pagination |
| `GET` | `/api/admin/users/:id` | Single user + last 10 expenses |
| `PATCH` | `/api/admin/users/:id` | UPDATE users SET plan |
| `DELETE` | `/api/admin/users/:id` | DELETE user (cascades to expenses) |
| `GET` | `/api/admin/expenses` | All expenses JOIN users, paginated |

---

## Demo Mode (No Backend Required)

Click **"Preview with demo data"** on the login page. This fills the entire UI
with realistic mock data (1,284 users, 38,420 expenses, charts, etc.) without
needing PostgreSQL, Redis, or the backend to be running.

Useful for: showing the UI to someone, testing layout changes, or exploring
before the backend is set up.

---

## Environment Variables

The admin panel reads one optional env variable:

```
# admin/.env (create this file if needed)
VITE_API_URL=http://localhost:3000
```

If not set, it defaults to proxying `/api` through Vite to `http://localhost:3000`.

The backend admin credentials are set in `backend/.env`:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=xpense-admin-secret-change-this
```

**Change the password before using in production.**

---

## Deploying Admin Panel in Production

### Option A — Serve from the same backend (simplest)

Build the admin panel and serve it as static files from Express:

```bash
cd admin
npm run build
# Copy dist/ into backend/public/admin/
cp -r dist/ ../backend/public/admin/
```

Add to `backend/index.js`:
```js
const path = require('path');
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
```

Admin available at: `https://yourdomain.com/admin`

### Option B — Deploy to Vercel (separate URL)

```bash
cd admin
npm run build

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set environment variable in Vercel dashboard:
```
VITE_API_URL = https://api.yourdomain.com
```

Admin available at: `https://xpense-admin.vercel.app`

### Option C — Deploy to S3 + CloudFront (same as frontend)

```bash
cd admin
VITE_API_URL=https://api.yourdomain.com npm run build

aws s3 mb s3://xpense-admin-prod
aws s3 sync dist/ s3://xpense-admin-prod --delete
aws cloudfront create-distribution \
  --origin-domain-name xpense-admin-prod.s3.amazonaws.com \
  --default-root-object index.html
```

---

## Security Checklist

- [ ] Change `ADMIN_PASSWORD` in `.env` from the default value
- [ ] Use a strong `JWT_SECRET` (at least 32 random characters)
- [ ] In production, serve admin panel on a non-obvious path or subdomain
- [ ] Add IP allowlisting in nginx/ALB to restrict admin access to your IP only
- [ ] Never commit `.env` to git (it is in `.gitignore`)
- [ ] Rotate the admin password periodically

---

## Troubleshooting

### "Invalid credentials" on login
Check `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `backend/.env`. Make sure the
backend is running before trying to log in.

### Admin panel shows blank / network error
The backend is not running. Start it first:
```bash
cd D:/Apps/Xpenses/backend && npm run dev
```

### Stats show all zeros
The database has no data yet. Log in to the user dashboard at
http://localhost:5173 and add some expenses first, or send messages to the
Telegram bot.

### Upgrade/Downgrade button does nothing
Check the backend terminal for errors. The `PATCH /api/admin/users/:id` route
requires a valid admin JWT token and the user ID to exist in the database.
