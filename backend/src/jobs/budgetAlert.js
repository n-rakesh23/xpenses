const { getBudgetByCategory, getMonthlyTotalForCategory } = require('../db/queries');
const { get, set } = require('../services/state');
const { sendWhatsApp, sendTelegram } = require('../services/reply');
const { formatCurrency } = require('../utils/format');
const logger = require('../utils/logger');

/**
 * Run budget alert check after an expense is saved.
 * Sends 80% and 100% alerts once per month per category per user.
 * @param {object} user - { id, platform, platform_user_id, plan }
 * @param {object} expense - { amount, category }
 */
async function runBudgetAlert(user, expense) {
  try {
    const budget = await getBudgetByCategory(user.id, expense.category);
    if (!budget) return; // No budget set for this category

    const monthTotal = await getMonthlyTotalForCategory(user.id, expense.category);
    const limit = parseFloat(budget.monthly_limit);
    const percentage = (monthTotal / limit) * 100;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (percentage >= 100) {
      const redisKey = `alert_sent:100:${user.id}:${expense.category}:${monthKey}`;
      const alreadySent = await get(redisKey);
      if (!alreadySent) {
        const msg = `🚨 Budget exceeded! You've spent ${formatCurrency(monthTotal)} on ${expense.category} this month (limit: ${formatCurrency(limit)}). That's ${Math.round(percentage)}% of your budget.`;
        await sendAlert(user, msg);
        const ttl = secondsUntilEndOfMonth();
        await set(redisKey, '1', ttl);
        logger.info('Budget exceeded alert sent', { userId: user.id, category: expense.category });
      }
    } else if (percentage >= 80) {
      const redisKey = `alert_sent:80:${user.id}:${expense.category}:${monthKey}`;
      const alreadySent = await get(redisKey);
      if (!alreadySent) {
        const msg = `⚠️ Budget alert! You've used ${Math.round(percentage)}% of your ${expense.category} budget (${formatCurrency(monthTotal)} of ${formatCurrency(limit)}).`;
        await sendAlert(user, msg);
        const ttl = secondsUntilEndOfMonth();
        await set(redisKey, '1', ttl);
        logger.info('Budget 80% alert sent', { userId: user.id, category: expense.category });
      }
    }
  } catch (err) {
    logger.error('Budget alert error', { message: err.message, userId: user.id });
  }
}

/**
 * Send alert via the user's platform.
 * @param {object} user
 * @param {string} message
 */
async function sendAlert(user, message) {
  if (user.platform === 'whatsapp') {
    await sendWhatsApp(user.platform_user_id, message);
  } else if (user.platform === 'telegram') {
    await sendTelegram(user.platform_user_id, message);
  }
}

/**
 * Compute seconds until the end of the current month.
 * @returns {number}
 */
function secondsUntilEndOfMonth() {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return Math.max(1, Math.floor((endOfMonth - now) / 1000));
}

module.exports = { runBudgetAlert };
