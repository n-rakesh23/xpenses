# Xpense — Local Setup Guide

Run the full Xpense stack on your Windows PC with no Docker, no cloud accounts, and no deployments.
Your data stays on your machine. You only need internet to send/receive Telegram messages.

---

## What You'll Be Running

| Service | Where it runs | URL |
|---|---|---|
| PostgreSQL database | Your PC (native install) | localhost:5432 |
| Redis cache | Your PC (Memurai) | localhost:6379 |
| Backend API | Your PC (Node.js) | http://localhost:3000 |
| Frontend UI | Your PC (Vite) | http://localhost:5173 |
| Telegram bot | Telegram cloud | @YourBotName |

---

## Prerequisites

- **Node.js 20+** — https://nodejs.org (download LTS)
- **PostgreSQL 15** — https://www.postgresql.org/download/windows/
- **Memurai** (Redis for Windows) — https://www.memurai.com/get-memurai
- A **Telegram account** (to create a bot)

---

## Step 1 — Install PostgreSQL

1. Go to https://www.postgresql.org/download/windows/
2. Click **"Download the installer"** → download the latest version
3. Run the installer with these settings:
   - Password for superuser: `postgres`
   - Port: `5432` (default — keep it)
   - Locale: default
   - **Uncheck Stack Builder** at the end
4. After install, open **SQL Shell (psql)** from the Start menu
5. Press **Enter** through all prompts (Server, Database, Port, Username)
6. Type the password: `postgres`
7. Run these commands:

```sql
CREATE USER xpense WITH PASSWORD 'xpense';
CREATE DATABASE xpense OWNER xpense;
\q
```

---

## Step 2 — Install Memurai (Redis for Windows)

1. Go to https://www.memurai.com/get-memurai
2. Download the **Developer Edition** (free, no sign-up required)
3. Run the installer — it installs Redis as a Windows service on port `6379`
4. It starts automatically. No configuration needed.

To verify it's running, open PowerShell and type:
```powershell
Test-NetConnection -ComputerName localhost -Port 6379
```
You should see `TcpTestSucceeded: True`.

---

## Step 3 — Create a Telegram Bot

1. Open Telegram → search **@BotFather** → `/start`
2. Send `/newbot`
3. Give it a name (e.g. `My Xpense Bot`) and a username (e.g. `myxpense_bot`)
4. BotFather gives you a token like:
   ```
   7123456789:AAFxxxxxxxxxxxxxxxxxxxxxx
   ```
5. Copy the token — you'll need it in the next step

---

## Step 4 — Configure Environment Variables

Open `backend/.env` and fill in your Telegram token:

```env
# Database
DATABASE_URL=postgresql://xpense:xpense@localhost:5432/xpense

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=xpense-local-dev-secret-change-in-production-256bit
JWT_MAGIC_LINK_EXPIRY=15m
JWT_SESSION_EXPIRY=7d

# Telegram
TELEGRAM_BOT_TOKEN=YOUR_TOKEN_FROM_BOTFATHER
TELEGRAM_SECRET_TOKEN=xpense-telegram-secret

# App
APP_URL=http://localhost:5173
API_URL=http://localhost:3000
PORT=3000
NODE_ENV=development

# Admin Panel
ADMIN_USERNAME=admin
ADMIN_PASSWORD=xpense-admin-secret-change-this
```

All other values are optional for local use (WhatsApp, Cloudinary, Razorpay).

---

## Step 5 — Install Dependencies

Open a terminal in the project root:

```bash
cd D:/Apps/Xpenses/backend
npm install

cd ../frontend
npm install
```

---

## Step 6 — Initialize the Database

Run this once to create all the tables:

```bash
cd D:/Apps/Xpenses/backend
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(fs.readFileSync('src/db/schema.sql', 'utf8'))
  .then(() => { console.log('✅ Database ready'); pool.end(); })
  .catch(e => { console.error('❌', e.message); pool.end(); });
"
```

You should see: `✅ Database ready`

---

## Step 7 — Start Everything

You need **3 terminal windows** open simultaneously.

### Terminal 1 — Backend

```bash
cd D:/Apps/Xpenses/backend
npm run dev
```

Wait for: `Xpense backend running on port 3000`

### Terminal 2 — Frontend

```bash
cd D:/Apps/Xpenses/frontend
npm run dev
```

Wait for: `Local: http://localhost:5173/`

### Terminal 3 — Telegram Poller

```bash
cd D:/Apps/Xpenses/backend
node poll.js
```

Wait for:
```
🤖  Xpense Telegram Poller
   ✅  Webhook cleared.
   Polling Telegram for updates → forwarding to http://localhost:3000/webhook/telegram
```

---

## Step 8 — Log In to the Dashboard

1. Open **http://localhost:5173** in your browser
2. Click any **demo account card** (Rahul, Priya, Ankit, or Sana) to log in instantly
3. Or enter any phone number → click Continue → copy the `verify_url` from the backend terminal output → paste in browser

---

## Step 9 — Test the Full Flow

Send any of these to your Telegram bot:

```
coffee 80
uber 200 transport
medicine 350
lunch 450 food
netflix 649
1200 amazon shopping
```

The bot replies with a confirmation. Refresh the dashboard at http://localhost:5173 — your expenses appear in real time.

---

## Every Time You Start the App

Just run these in 3 terminals:

```bash
# Terminal 1
cd D:/Apps/Xpenses/backend && npm run dev

# Terminal 2
cd D:/Apps/Xpenses/frontend && npm run dev

# Terminal 3
cd D:/Apps/Xpenses/backend && node poll.js
```

PostgreSQL and Memurai start automatically with Windows — you don't need to start them manually.

---

## Internet Requirements

| Action | Internet needed? |
|---|---|
| View dashboard | No |
| Add/edit expenses from dashboard | No |
| Send expense via Telegram bot | Yes |
| Bot replies | Yes |

---

## Troubleshooting

### `ECONNREFUSED` on backend start
PostgreSQL or Memurai is not running. Check:
```powershell
# Check PostgreSQL
Get-Service -Name postgresql*

# Check Memurai
Test-NetConnection -ComputerName localhost -Port 6379
```

### Demo login fails
Backend is not running. Start Terminal 1 first.

### Bot not responding
- Check Terminal 3 is running (`node poll.js`)
- Make sure `TELEGRAM_BOT_TOKEN` is set in `backend/.env`
- Make sure you're messaging the correct bot

### Dashboard shows no data
You're on a demo session that doesn't match the user the bot saves to. Log in via magic link using your phone number, then message the bot — data will appear.

---

## Optional: Add WhatsApp Support

WhatsApp requires a Meta Developer account and a verified phone number. See `docs/PRODUCTION_SETUP.md` for full WhatsApp + production setup.

---

## Optional: Enable Receipt Uploads

1. Sign up at https://cloudinary.com (free tier)
2. Copy your Cloudinary URL from the dashboard
3. Add to `backend/.env`:
   ```env
   CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
   ```
4. Restart the backend
