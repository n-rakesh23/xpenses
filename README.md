# Xpense

Xpense is a WhatsApp + Telegram expense tracker. Users message their expenses ("coffee 80", "uber 200") to a bot, which parses and saves them to PostgreSQL. Users view a personal web dashboard with charts, calendar heatmap, and transaction history.

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- A Telegram bot token (from BotFather)
- A Meta Developer App (for WhatsApp)

## Local Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd xpense-app

# 2. Copy environment variables
cp .env.example .env
# Fill in all values in .env

# 3. Start PostgreSQL and Redis
docker-compose up -d

# 4. Install backend dependencies and run migrations
cd backend
npm install
node -e "require('fs').readFileSync('../backend/src/db/schema.sql','utf8').split(';').filter(s=>s.trim()).forEach(async s=>{ const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); await p.query(s); })"
# Or connect to postgres and run: psql $DATABASE_URL < src/db/schema.sql
npm run dev

# 5. Install frontend dependencies
cd ../frontend
npm install
npm run dev
```

Backend runs on http://localhost:3000  
Frontend runs on http://localhost:5173

## Telegram Bot Setup

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the prompts to create a bot
3. Copy the bot token to `TELEGRAM_BOT_TOKEN` in your `.env`
4. Set a webhook: `POST https://api.telegram.org/bot<TOKEN>/setWebhook` with `url: <YOUR_API_URL>/webhook/telegram` and `secret_token: <TELEGRAM_SECRET_TOKEN>`
5. Register commands via `/setcommands` in BotFather:
   ```
   start - Welcome message and onboarding
   menu - Show main menu with category buttons
   summary - Today's total by category
   week - Last 7 days spending
   budget - Show current budgets vs spending
   delete - Delete last expense
   help - List all commands
   ```

## WhatsApp Setup (Meta Developer App)

1. Go to [developers.facebook.com](https://developers.facebook.com) and create an app
2. Add the "WhatsApp" product to your app
3. Set up a phone number and copy `WHATSAPP_PHONE_ID` and `WHATSAPP_TOKEN`
4. In the Webhook section, set URL to `<YOUR_API_URL>/webhook/whatsapp`
5. Set `META_VERIFY_TOKEN` to your custom string and verify
6. Set `META_APP_SECRET` from your app's Basic Settings
7. Subscribe to `messages` webhook field

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | 256-bit secret for JWT signing |
| `JWT_MAGIC_LINK_EXPIRY` | Magic link token expiry (e.g. `15m`) |
| `JWT_SESSION_EXPIRY` | Session token expiry (e.g. `7d`) |
| `WHATSAPP_TOKEN` | Meta Cloud API access token |
| `WHATSAPP_PHONE_ID` | WhatsApp phone number ID |
| `META_APP_SECRET` | Meta app secret for webhook HMAC |
| `META_VERIFY_TOKEN` | Custom string for webhook verification |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_SECRET_TOKEN` | Custom secret for Telegram webhook header |
| `CLOUDINARY_URL` | Cloudinary connection URL |
| `APP_URL` | Frontend URL (for magic link redirects) |
| `API_URL` | Backend URL |
| `PORT` | Backend server port (default 3000) |
| `NODE_ENV` | `development` or `production` |
| `RAZORPAY_KEY_ID` | Razorpay key ID for payments |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret for payments |

## Running Tests

```bash
cd backend
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Deployment

### Railway (Backend)

1. Create a new Railway project
2. Add a PostgreSQL plugin — `DATABASE_URL` is set automatically
3. Add a Redis plugin — `REDIS_URL` is set automatically
4. Connect your GitHub repo and select the `backend` folder as root
5. Set all remaining environment variables in Railway dashboard
6. Railway will detect the `Procfile` and deploy automatically
7. Run the schema migration: `psql $DATABASE_URL < src/db/schema.sql`

### Vercel (Frontend)

1. Connect your GitHub repo to Vercel
2. Set the root directory to `frontend`
3. Set the environment variable `VITE_API_URL` to your Railway backend URL
4. Deploy — Vercel will detect Vite automatically
5. The `vercel.json` handles SPA routing rewrites
