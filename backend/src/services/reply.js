const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Send a WhatsApp message via Meta Cloud API.
 * @param {string} to - recipient phone number (E.164)
 * @param {string} message - plain text message
 * @param {string} [type='text'] - 'text' | 'interactive' | 'template'
 * @param {object} [payload] - for interactive/template messages
 * @returns {Promise<object>} API response data
 */
async function sendWhatsApp(to, message, type = 'text', payload = null) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  let body;

  if (type === 'text') {
    body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    };
  } else if (type === 'interactive') {
    body = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: payload,
    };
  } else if (type === 'template') {
    body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: payload,
    };
  } else {
    body = { messaging_product: 'whatsapp', to, type, ...payload };
  }

  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  logger.debug('WhatsApp message sent', { to, type });
  return response.data;
}

/**
 * Send a Telegram message.
 * @param {string|number} chatId - Telegram chat ID
 * @param {string} text - message text (supports HTML)
 * @param {object} [replyMarkup] - inline_keyboard or keyboard markup
 * @returns {Promise<object>} API response data
 */
async function sendTelegram(chatId, text, replyMarkup = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await axios.post(url, body);
  logger.debug('Telegram message sent', { chatId });
  return response.data;
}

/**
 * Answer a Telegram callback query (dismisses loading spinner).
 * @param {string} callbackQueryId
 * @param {string} [text] - optional notification text
 * @returns {Promise<object>}
 */
async function answerTelegramCallback(callbackQueryId, text = '') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  const response = await axios.post(url, { callback_query_id: callbackQueryId, text });
  return response.data;
}

/**
 * Build a WhatsApp interactive list message for category selection.
 * @returns {object} interactive payload
 */
function buildCategoryListPayload() {
  return {
    type: 'list',
    header: { type: 'text', text: 'Select Category' },
    body: { text: 'Which category does this expense belong to?' },
    footer: { text: 'Tap to choose' },
    action: {
      button: 'Choose category',
      sections: [
        {
          title: 'Food & drinks',
          rows: [
            { id: 'food_meals', title: 'Meals & dining' },
            { id: 'food_coffee', title: 'Coffee & snacks' },
            { id: 'food_grocery', title: 'Groceries' },
          ],
        },
        {
          title: 'Transport',
          rows: [
            { id: 'transport_cab', title: 'Cab / Auto / Uber' },
            { id: 'transport_fuel', title: 'Fuel & parking' },
            { id: 'transport_metro', title: 'Metro / Bus' },
          ],
        },
        {
          title: 'Bills & more',
          rows: [
            { id: 'shopping', title: 'Shopping' },
            { id: 'entertainment', title: 'Subscriptions' },
            { id: 'health', title: 'Health & pharmacy' },
            { id: 'other', title: 'Other' },
          ],
        },
      ],
    },
  };
}

/**
 * Build a WhatsApp interactive button message for post-expense actions.
 * @param {string} bodyText
 * @returns {object} interactive payload
 */
function buildPostExpenseButtonPayload(bodyText) {
  return {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'add_receipt', title: 'Add receipt' } },
        { type: 'reply', reply: { id: 'add_note', title: 'Add note' } },
        { type: 'reply', reply: { id: 'done', title: 'Done' } },
      ],
    },
  };
}

/**
 * Build a Telegram inline keyboard for category selection.
 * @returns {object} reply_markup with inline_keyboard
 */
function buildTelegramCategoryKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Food', callback_data: 'cat:food' },
        { text: 'Transport', callback_data: 'cat:transport' },
      ],
      [
        { text: 'Shopping', callback_data: 'cat:shopping' },
        { text: 'Entertainment', callback_data: 'cat:entertainment' },
      ],
      [
        { text: 'Health', callback_data: 'cat:health' },
        { text: 'Other', callback_data: 'cat:other' },
      ],
    ],
  };
}

/**
 * Build a Telegram inline keyboard for post-expense actions.
 * @param {string} expenseId
 * @returns {object}
 */
function buildTelegramPostExpenseKeyboard(expenseId) {
  return {
    inline_keyboard: [
      [
        { text: 'Add note', callback_data: `note:${expenseId}` },
        { text: 'Add receipt', callback_data: `receipt:${expenseId}` },
        { text: 'Done', callback_data: 'done' },
      ],
    ],
  };
}

module.exports = {
  sendWhatsApp,
  sendTelegram,
  answerTelegramCallback,
  buildCategoryListPayload,
  buildPostExpenseButtonPayload,
  buildTelegramCategoryKeyboard,
  buildTelegramPostExpenseKeyboard,
};
