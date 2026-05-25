const express = require('express');
const { verifyHmacSha256 } = require('../utils/crypto');
const { parseExpense } = require('../services/parser');
const {
  sendWhatsApp,
  buildCategoryListPayload,
  buildPostExpenseButtonPayload,
} = require('../services/reply');
const { getState, setState, clearState } = require('../services/state');
const {
  upsertUser,
  createExpense,
  updateExpense,
  expenseExistsByMessageId,
} = require('../db/queries');
const { runBudgetAlert } = require('../jobs/budgetAlert');
const { uploadReceiptFromUrl } = require('../services/storage');
const logger = require('../utils/logger');
const { formatCurrency } = require('../utils/format');

const router = express.Router();

// ─── GET: Webhook Verification ────────────────────────────────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  logger.warn('WhatsApp webhook verification failed', { mode, token });
  return res.status(403).json({ error: 'Forbidden' });
});

// ─── POST: Message Handler ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    // Verify HMAC-SHA256 signature
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      logger.warn('WhatsApp webhook missing signature');
      return res.status(403).json({ error: 'Missing signature' });
    }

    const sig = signature.replace('sha256=', '');
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const isValid = verifyHmacSha256(rawBody, process.env.META_APP_SECRET, sig);

    if (!isValid) {
      logger.warn('WhatsApp webhook invalid signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // Always respond 200 quickly
    res.status(200).json({ status: 'ok' });

    // Process asynchronously
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    for (const msg of messages) {
      await handleWhatsAppMessage(msg, value).catch((err) => {
        logger.error('Error handling WhatsApp message', { message: err.message, msgId: msg.id });
      });
    }
  } catch (err) {
    logger.error('WhatsApp webhook error', { message: err.message });
  }
});

/**
 * Handle a single WhatsApp message.
 * @param {object} msg
 * @param {object} value - webhook value context (for contact info)
 */
async function handleWhatsAppMessage(msg, value) {
  const from = msg.from; // E.164 phone number
  const msgId = msg.id;
  const msgType = msg.type;

  // Idempotency check
  if (await expenseExistsByMessageId(msgId)) {
    logger.info('Duplicate WhatsApp message, skipping', { msgId });
    return;
  }

  // Upsert user
  const contact = value?.contacts?.[0];
  const user = await upsertUser('whatsapp', from, {
    phone: from,
    name: contact?.profile?.name,
  });

  const state = (await getState(user.id)) || { state: 'idle' };
  const currentState = state.state;

  // Handle different message types
  if (msgType === 'text') {
    const text = msg.text?.body?.trim() || '';
    await handleTextMessage(user, text, msgId, currentState, state);
  } else if (msgType === 'interactive') {
    const interactive = msg.interactive;
    if (interactive.type === 'list_reply') {
      await handleListReply(user, interactive.list_reply, state);
    } else if (interactive.type === 'button_reply') {
      await handleButtonReply(user, interactive.button_reply, state);
    }
  } else if (msgType === 'image') {
    await handleImageMessage(user, msg.image, state);
  }
}

async function handleTextMessage(user, text, msgId, currentState, state) {
  const lowerText = text.toLowerCase();

  if (lowerText === 'menu' || lowerText === '/menu') {
    await setState(user.id, 'idle');
    await sendWhatsApp(
      user.platform_user_id,
      'Choose a category for your expense:',
      'interactive',
      buildCategoryListPayload()
    );
    return;
  }

  if (currentState === 'awaiting_amount') {
    const amount = parseFloat(text.replace(/[₹,\s]/g, ''));
    if (isNaN(amount) || amount <= 0 || amount > 100000) {
      await sendWhatsApp(user.platform_user_id, 'Please enter a valid amount (1 - 1,00,000).');
      return;
    }

    const expense = await createExpense(user.id, {
      amount,
      category: state.pendingCategory,
      description: null,
      messageId: null,
      platform: 'whatsapp',
    });

    await clearState(user.id);
    await runBudgetAlert(user, expense).catch(() => {});

    const confirmation = `✅ Saved! ${formatCurrency(amount)} in ${state.pendingCategory}.`;
    await sendWhatsApp(
      user.platform_user_id,
      confirmation,
      'interactive',
      buildPostExpenseButtonPayload(confirmation)
    );
    await setState(user.id, 'awaiting_note', { pendingExpenseId: expense.id });
    return;
  }

  if (currentState === 'awaiting_note') {
    await updateExpense(user.id, state.pendingExpenseId, { note: text });
    await clearState(user.id);
    await sendWhatsApp(user.platform_user_id, `Note saved: "${text}". Done!`);
    return;
  }

  // Default: try to parse as expense
  const parsed = parseExpense(text);
  if (!parsed) {
    await sendWhatsApp(
      user.platform_user_id,
      'I couldn\'t understand that. Try: "coffee 80" or "uber 200 transport".\nSend "menu" to pick a category manually.'
    );
    return;
  }

  const expense = await createExpense(user.id, {
    amount: parsed.amount,
    category: parsed.category,
    description: parsed.description,
    messageId: msgId,
    platform: 'whatsapp',
  });

  await runBudgetAlert(user, expense).catch(() => {});

  const confirmation = `✅ Logged ${formatCurrency(parsed.amount)} in *${parsed.category}*${parsed.description ? ` (${parsed.description})` : ''}.`;
  await sendWhatsApp(
    user.platform_user_id,
    confirmation,
    'interactive',
    buildPostExpenseButtonPayload(confirmation)
  );
  await setState(user.id, 'awaiting_note', { pendingExpenseId: expense.id });
}

async function handleListReply(user, listReply, state) {
  const categoryId = listReply.id;
  // Map list IDs to categories
  const categoryMap = {
    food_meals: 'food',
    food_coffee: 'food',
    food_grocery: 'food',
    transport_cab: 'transport',
    transport_fuel: 'transport',
    transport_metro: 'transport',
    shopping: 'shopping',
    entertainment: 'entertainment',
    health: 'health',
    other: 'other',
  };
  const category = categoryMap[categoryId] || 'other';

  await setState(user.id, 'awaiting_amount', { pendingCategory: category });
  await sendWhatsApp(user.platform_user_id, `Got it! *${category}* selected. How much did you spend? (Enter the amount)`);
}

async function handleButtonReply(user, buttonReply, state) {
  const buttonId = buttonReply.id;

  if (buttonId === 'done') {
    await clearState(user.id);
    await sendWhatsApp(user.platform_user_id, 'Done! Send another expense anytime.');
    return;
  }

  if (buttonId === 'add_note') {
    await setState(user.id, 'awaiting_note', { pendingExpenseId: state.pendingExpenseId });
    await sendWhatsApp(user.platform_user_id, 'Please type your note:');
    return;
  }

  if (buttonId === 'add_receipt') {
    await setState(user.id, 'awaiting_receipt', { pendingExpenseId: state.pendingExpenseId });
    await sendWhatsApp(user.platform_user_id, 'Please send a photo of the receipt:');
    return;
  }
}

async function handleImageMessage(user, image, state) {
  if (state.state !== 'awaiting_receipt' || !state.pendingExpenseId) {
    await sendWhatsApp(user.platform_user_id, 'Please log an expense first before adding a receipt.');
    return;
  }

  try {
    // Download the image from WhatsApp
    const axios = require('axios');
    const mediaRes = await axios.get(
      `https://graph.facebook.com/v19.0/${image.id}`,
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
    );
    const mediaUrl = mediaRes.data.url;
    const downloadRes = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    });
    const buffer = Buffer.from(downloadRes.data);

    const { url } = await uploadReceiptFromUrl(
      `data:image/jpeg;base64,${buffer.toString('base64')}`,
      user.id
    );

    await updateExpense(user.id, state.pendingExpenseId, { receipt_url: url });
    await clearState(user.id);
    await sendWhatsApp(user.platform_user_id, '✅ Receipt saved!');
  } catch (err) {
    logger.error('Error uploading WhatsApp receipt', { message: err.message });
    await sendWhatsApp(user.platform_user_id, 'Sorry, failed to upload receipt. Please try again.');
  }
}

module.exports = router;
