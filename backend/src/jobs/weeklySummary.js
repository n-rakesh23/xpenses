const { Queue, Worker } = require('bullmq');
const cron = require('node-cron');
const pool = require('../db/pool');
const { getCategoryTotals } = require('../db/queries');
const { sendWhatsApp, sendTelegram } = require('../services/reply');
const { generateWeeklyInsights } = require('../services/insights');
const { formatCurrency, getWeekRange } = require('../utils/format');
const logger = require('../utils/logger');

const QUEUE_NAME = 'weekly-summary';

let queue;
let worker;

/**
 * Initialise the BullMQ queue and worker for weekly summaries.
 */
function initWeeklySummaryJob() {
  const connection = {
    host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
    port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379', 10),
  };

  queue = new Queue(QUEUE_NAME, { connection });

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { userId, platform, platformUserId, name, plan } = job.data;
      logger.info('Processing weekly summary', { userId });

      try {
        const categories = await getCategoryTotals(userId, 'weekly');
        const total = Object.values(categories).reduce((a, b) => a + b, 0);

        if (total === 0) {
          logger.info('No expenses this week, skipping summary', { userId });
          return;
        }

        const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
        const { start, end } = getWeekRange(0);

        let message;

        if (plan === 'pro') {
          // Pro users get AI insights
          let insights = '';
          try {
            insights = await generateWeeklyInsights(
              { id: userId, name, plan },
              { total, topCategory, categories, previousTotal: 0 }
            );
          } catch (insightErr) {
            logger.error('Failed to generate insights', { message: insightErr.message });
          }

          const categoryLines = Object.entries(categories)
            .map(([cat, amt]) => `• ${cat}: ${formatCurrency(amt)}`)
            .join('\n');

          message =
            `📊 *Weekly Summary* (${start} – ${end})\n\n` +
            `Total spent: *${formatCurrency(total)}*\n` +
            `Top category: ${topCategory}\n\n` +
            categoryLines +
            (insights ? `\n\n💡 *Insights*\n${insights}` : '');
        } else {
          // Free users get plain text
          const categoryLines = Object.entries(categories)
            .map(([cat, amt]) => `• ${cat}: ${formatCurrency(amt)}`)
            .join('\n');

          message =
            `📊 Weekly Summary (${start} – ${end})\n\n` +
            `Total: ${formatCurrency(total)}\n\n` +
            categoryLines +
            '\n\nUpgrade to Pro for AI insights! Visit ' + process.env.APP_URL + '/upgrade';
        }

        if (platform === 'whatsapp') {
          await sendWhatsApp(platformUserId, message);
        } else {
          await sendTelegram(platformUserId, message);
        }

        logger.info('Weekly summary sent', { userId, platform });
      } catch (err) {
        logger.error('Failed to send weekly summary', { userId, message: err.message });
        throw err; // BullMQ will retry
      }
    },
    { connection, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    logger.error('Weekly summary job failed', { jobId: job?.id, message: err.message });
  });

  // Schedule: every Sunday at 08:00 IST (02:30 UTC)
  cron.schedule('30 2 * * 0', async () => {
    logger.info('Enqueuing weekly summary jobs');
    try {
      const { rows: users } = await pool.query(
        `SELECT id, platform, platform_user_id, name, plan
         FROM users
         WHERE created_at < NOW() - INTERVAL '7 days'`
      );

      for (const user of users) {
        await queue.add('send-summary', {
          userId: user.id,
          platform: user.platform,
          platformUserId: user.platform_user_id,
          name: user.name,
          plan: user.plan,
        });
      }

      logger.info('Weekly summary jobs enqueued', { count: users.length });
    } catch (err) {
      logger.error('Failed to enqueue weekly summary jobs', { message: err.message });
    }
  });

  logger.info('Weekly summary job initialised');
}

module.exports = { initWeeklySummaryJob };
