const express = require('express');
const { parseExpense } = require('../services/parser');
const {
  sendTelegram,
  answerTelegramCallback,
  buildTelegramCategoryKeyboard,
  buildTelegramPostExpenseKeyboard,
} = require('../services/reply');
const { getState, setState, clearState } = require('../services/state');
const {
  upsertUser,
  createExpense,
  updateExpense,
  getLastExpense,
  expenseExistsByMessageId,
  getCategoryTotals,
  getBudgets,
  getMonthlyTotalForCategory,
  deleteExpense,
} = require('../db/queries');
const { runBudgetAlert } = require('../jobs/budgetAlert');
const { uploadReceiptFromUrl } = require('../services/storage');
const logger = require('../utils/logger');
const { formatCurrency } = require('../utils/format');

const router = express.Router();

router.use(express.json());

// ─── POST: Webhook Handler ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    // Verify secret token
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    if (secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
      logger.warn('Telegram webhook invalid secret token');
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Respond 200 immediately
    res.status(200).json({ ok: true });

    const update = req.body;

    if (update.message) {
      await handleMessage(update.message).catch((err) => {
        logger.error('Telegram message handler error', { message: err.message });
      });
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query).catch((err) => {
        logger.error('Telegram callback handler error', { message: err.message });
      });
    }
  } catch (err) {
    logger.error('Telegram webhook error', { message: err.message });
  }
});

/**
 * Handle an incoming Telegram message.
 */
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const fromId = String(msg.from.id);
  const text = msg.text || '';
  const msgId = String(msg.message_id);
  const photo = msg.photo;

  const user = await upsertUser('telegram', fromId, {
    name: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || null,
  });

  const state = (await getState(user.id)) || { state: 'idle' };

  // Handle photo (receipt upload)
  if (photo && photo.length > 0) {
    await handlePhotoMessage(user, chatId, photo, state);
    return;
  }

  if (!text) return;

  // Bot commands
  if (text.startsWith('/')) {
    await handleCommand(user, chatId, text.split(' ')[0], state);
    return;
  }

  // State machine
  await handleTextMessage(user, chatId, text, msgId, state);
}

async function handleCommand(user, chatId, command, state) {
  switch (command) {
    case '/start':
      await clearState(user.id);
      await sendTelegram(
        chatId,
        `👋 Welcome to Xpense${user.name ? `, ${user.name}` : ''}!\n\nSend me your expenses like:\n<code>coffee 80</code>\n<code>uber 200</code>\n<code>lunch 350 food</code>\n\nI'll track them all for you. Use /help to see all commands.`
      );
      break;

    case '/menu':
      await setState(user.id, 'awaiting_category');
      await sendTelegram(chatId, 'Choose a category:', buildTelegramCategoryKeyboard());
      break;

    case '/summary': {
      const categories = await getCategoryTotals(user.id, 'daily');
      if (Object.keys(categories).length === 0) {
        await sendTelegram(chatId, "You haven't logged any expenses today.");
        return;
      }
      const lines = Object.entries(categories)
        .map(([cat, amt]) => `• ${cat}: ${formatCurrency(amt)}`)
        .join('\n');
      const total = Object.values(categories).reduce((a, b) => a + b, 0);
      await sendTelegram(chatId, `<b>Today's Summary</b>\n\n${lines}\n\n<b>Total: ${formatCurrency(total)}</b>`);
      break;
    }

    case '/week': {
      const categories = await getCategoryTotals(user.id, 'weekly');
      if (Object.keys(categories).length === 0) {
        await sendTelegram(chatId, "You haven't logged any expenses this week.");
        return;
      }
      const lines = Object.entries(categories)
        .map(([cat, amt]) => `• ${cat}: ${formatCurrency(amt)}`)
        .join('\n');
      const total = Object.values(categories).reduce((a, b) => a + b, 0);
      await sendTelegram(chatId, `<b>Last 7 Days</b>\n\n${lines}\n\n<b>Total: ${formatCurrency(total)}</b>`);
      break;
    }

    case '/budget': {
      const budgets = await getBudgets(user.id);
      if (budgets.length === 0) {
        await sendTelegram(chatId, 'You have no budgets set. Set them from the web dashboard.');
        return;
      }
      const lines = await Promise.all(
        budgets.map(async (b) => {
          const spent = await getMonthlyTotalForCategory(user.id, b.category);
          const pct = Math.round((spent / parseFloat(b.monthly_limit)) * 100);
          const bar = buildProgressBar(pct);
          return `<b>${b.category}</b>: ${formatCurrency(spent)} / ${formatCurrency(b.monthly_limit)} ${bar} ${pct}%`;
        })
      );
      await sendTelegram(chatId, `<b>Budget Status</b>\n\n${lines.join('\n\n')}`);
      break;
    }

    case '/delete': {
      const last = await getLastExpense(user.id);
      if (!last) {
        await sendTelegram(chatId, 'No recent expenses to delete.');
        return;
      }
      await sendTelegram(
        chatId,
        `Delete last expense?\n<b>${formatCurrency(last.amount)}</b> in ${last.category}${last.description ? ` (${last.description})` : ''}`,
        {
          inline_keyboard: [
            [
              { text: 'Yes, delete', callback_data: `del:${last.id}` },
              { text: 'Cancel', callback_data: 'done' },
            ],
          ],
        }
      );
      break;
    }

    case '/help':
      await sendTelegram(
        chatId,
        '<b>Xpense Commands</b>\n\n' +
          '/start — Welcome message\n' +
          '/menu — Pick expense category\n' +
          '/summary — Today\'s totals\n' +
          '/week — Last 7 days\n' +
          '/budget — Budget vs spending\n' +
          '/delete — Delete last expense\n' +
          '/help — This message\n\n' +
          'Or just type: <code>coffee 80</code> or <code>uber 200</code>'
      );
      break;

    default:
      await sendTelegram(chatId, 'Unknown command. Use /help to see available commands.');
  }
}

async function handleTextMessage(user, chatId, text, msgId, state) {
  const currentState = state.state;

  if (currentState === 'awaiting_amount') {
    const amount = parseFloat(text.replace(/[₹,\s]/g, ''));
    if (isNaN(amount) || amount <= 0 || amount > 100000) {
      await sendTelegram(chatId, 'Please enter a valid amount between 1 and 1,00,000.');
      return;
    }

    const expense = await createExpense(user.id, {
      amount,
      category: state.pendingCategory,
      description: null,
      messageId: null,
      platform: 'telegram',
    });

    await clearState(user.id);
    await runBudgetAlert(user, expense).catch(() => {});

    await sendTelegram(
      chatId,
      `✅ Saved <b>${formatCurrency(amount)}</b> in ${state.pendingCategory}.`,
      buildTelegramPostExpenseKeyboard(expense.id)
    );
    await setState(user.id, 'awaiting_note', { pendingExpenseId: expense.id });
    return;
  }

  if (currentState === 'awaiting_note') {
    await updateExpense(user.id, state.pendingExpenseId, { note: text });
    await clearState(user.id);
    await sendTelegram(chatId, `📝 Note saved: "<i>${text}</i>". All done!`);
    return;
  }

  // Idempotency
  if (await expenseExistsByMessageId(msgId)) {
    logger.info('Duplicate Telegram message, skipping', { msgId });
    return;
  }

  // Try to parse as expense
  const parsed = parseExpense(text);
  if (!parsed) {
    await sendTelegram(
      chatId,
      'I couldn\'t understand that. Try:\n<code>coffee 80</code>\n<code>uber 200</code>\n\nOr use /menu to pick a category.'
    );
    return;
  }

  const expense = await createExpense(user.id, {
    amount: parsed.amount,
    category: parsed.category,
    description: parsed.description,
    messageId: msgId,
    platform: 'telegram',
  });

  await runBudgetAlert(user, expense).catch(() => {});

  const confirmText = `✅ Logged <b>${formatCurrency(parsed.amount)}</b> in <b>${parsed.category}</b>${parsed.description ? ` (${parsed.description})` : ''}.`;
  await sendTelegram(chatId, confirmText, buildTelegramPostExpenseKeyboard(expense.id));
  await setState(user.id, 'awaiting_note', { pendingExpenseId: expense.id });
}

async function handleCallbackQuery(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const fromId = String(callbackQuery.from.id);

  const user = await upsertUser('telegram', fromId, {
    name: [callbackQuery.from.first_name, callbackQuery.from.last_name].filter(Boolean).join(' ') || null,
  });

  await answerTelegramCallback(callbackQuery.id);

  const state = (await getState(user.id)) || { state: 'idle' };

  if (data.startsWith('cat:')) {
    const category = data.split(':')[1];
    await setState(user.id, 'awaiting_amount', { pendingCategory: category });
    await sendTelegram(chatId, `<b>${category}</b> selected. How much did you spend?`);
    return;
  }

  if (data.startsWith('note:')) {
    const expenseId = data.split(':')[1];
    await setState(user.id, 'awaiting_note', { pendingExpenseId: expenseId });
    await sendTelegram(chatId, 'Type your note:');
    return;
  }

  if (data.startsWith('receipt:')) {
    const expenseId = data.split(':')[1];
    await setState(user.id, 'awaiting_receipt', { pendingExpenseId: expenseId });
    await sendTelegram(chatId, 'Send a photo of your receipt:');
    return;
  }

  if (data.startsWith('del:')) {
    const expenseId = data.split(':')[1];
    const deleted = await deleteExpense(user.id, expenseId);
    if (deleted) {
      await sendTelegram(chatId, '🗑️ Expense deleted.');
    } else {
      await sendTelegram(chatId, 'Could not find that expense.');
    }
    return;
  }

  if (data === 'done') {
    await clearState(user.id);
    await sendTelegram(chatId, '👍 Done! Send another expense anytime.');
    return;
  }
}

async function handlePhotoMessage(user, chatId, photos, state) {
  if (state.state !== 'awaiting_receipt' || !state.pendingExpenseId) {
    await sendTelegram(chatId, 'Please log an expense first, then send a receipt photo.');
    return;
  }

  try {
    const axios = require('axios');
    // Use the highest resolution photo
    const photo = photos[photos.length - 1];
    const token = process.env.TELEGRAM_BOT_TOKEN;

    const fileRes = await axios.get(
      `https://api.telegram.org/bot${token}/getFile?file_id=${photo.file_id}`
    );
    const filePath = fileRes.data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    const { url } = await uploadReceiptFromUrl(fileUrl, user.id);
    await updateExpense(user.id, state.pendingExpenseId, { receipt_url: url });
    await clearState(user.id);
    await sendTelegram(chatId, '✅ Receipt saved!');
  } catch (err) {
    logger.error('Error uploading Telegram receipt', { message: err.message });
    await sendTelegram(chatId, 'Failed to upload receipt. Please try again.');
  }
}

function buildProgressBar(pct) {
  const filled = Math.min(10, Math.round(pct / 10));
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

module.exports = router;
