const Anthropic = require('@anthropic-ai/sdk');
const { formatCurrency } = require('../utils/format');
const logger = require('../utils/logger');

let anthropicClient;

function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

/**
 * Generate weekly spending insights for a pro user using Claude API.
 * @param {object} user - user object { name, plan }
 * @param {object} weekData - { total, topCategory, categories: { food: 1200, ... }, previousTotal }
 * @returns {Promise<string>} insights text
 */
async function generateWeeklyInsights(user, weekData) {
  const { total, topCategory, categories, previousTotal } = weekData;

  const categoryBreakdown = Object.entries(categories)
    .map(([cat, amt]) => `- ${cat}: ${formatCurrency(amt)}`)
    .join('\n');

  const changePct = previousTotal > 0
    ? Math.round(((total - previousTotal) / previousTotal) * 100)
    : null;

  const changeText = changePct !== null
    ? `This is ${Math.abs(changePct)}% ${changePct >= 0 ? 'more' : 'less'} than last week.`
    : '';

  const prompt = `You are a friendly personal finance assistant for an Indian user named ${user.name || 'there'}.

Here is their spending summary for the past week:
Total spent: ${formatCurrency(total)}
${changeText}

Category breakdown:
${categoryBreakdown}

Top category: ${topCategory}

Please provide 2-3 short, actionable, friendly insights about their spending.
Keep it concise (under 150 words), encouraging, and specific to Indian context.
Use simple language. Do not use bullet points — write in natural short paragraphs.`;

  const client = getClient();

  const message = await client.messages.create({
    model: 'claude-haiku-20240307',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const insights = message.content[0]?.text || '';
  logger.info('Generated weekly insights', { userId: user.id });
  return insights;
}

module.exports = { generateWeeklyInsights };
