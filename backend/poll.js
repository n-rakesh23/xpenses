/**
 * Local Telegram polling for development.
 * Run this instead of setting up a webhook + ngrok.
 * It fetches updates from Telegram and delivers them to the local webhook endpoint.
 *
 * Usage: node poll.js
 */

require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_SECRET_TOKEN || 'xpense-telegram-secret';
const PORT = process.env.PORT || 3000;
const LOCAL_WEBHOOK = `http://localhost:${PORT}/webhook/telegram`;

if (!TOKEN) {
  console.error('❌  TELEGRAM_BOT_TOKEN is not set in backend/.env');
  console.error('    Get one from @BotFather on Telegram, then add it to .env');
  process.exit(1);
}

let offset = 0;
let running = true;

async function poll() {
  while (running) {
    try {
      const res = await axios.get(
        `https://api.telegram.org/bot${TOKEN}/getUpdates`,
        {
          params: { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] },
          timeout: 30000,
        }
      );

      const updates = res.data.result || [];
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await axios.post(LOCAL_WEBHOOK, update, {
            headers: {
              'Content-Type': 'application/json',
              'x-telegram-bot-api-secret-token': SECRET,
            },
            timeout: 10000,
          });
        } catch (err) {
          console.error('⚠️  Could not deliver update to backend:', err.message);
          console.error('    Make sure the backend is running (npm run dev)');
        }
      }
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.response?.status === 409) {
        // 409 = another webhook/polling session active, clear it
        if (err.response?.status === 409) {
          console.log('⚠️  Conflict detected, clearing existing webhook...');
          await clearWebhook();
        }
      } else if (!err.response) {
        console.error('⚠️  Network error, retrying in 5s:', err.message);
        await sleep(5000);
      }
    }
  }
}

async function clearWebhook() {
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`, { drop_pending_updates: false });
    console.log('✅  Webhook cleared.');
  } catch (err) {
    console.error('Could not clear webhook:', err.message);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('🤖  Xpense Telegram Poller');
  console.log('   Clearing any existing webhook...');
  await clearWebhook();
  console.log(`   Polling Telegram for updates → forwarding to ${LOCAL_WEBHOOK}`);
  console.log('   Press Ctrl+C to stop.\n');
  await poll();
}

process.on('SIGINT', () => {
  running = false;
  console.log('\n👋  Poller stopped.');
  process.exit(0);
});

main();
