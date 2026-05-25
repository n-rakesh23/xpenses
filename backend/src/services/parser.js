/**
 * Expense text parser service.
 * Parses natural language expense messages into structured data.
 */

const CATEGORY_KEYWORDS = {
  food: [
    'coffee', 'chai', 'tea', 'lunch', 'dinner', 'breakfast', 'swiggy', 'zomato',
    'restaurant', 'meal', 'food', 'snack', 'grocery', 'groceries', 'biscuit',
    'water', 'juice', 'eat', 'biryani', 'pizza', 'burger', 'maggi', 'dosa', 'idli',
  ],
  transport: [
    'uber', 'ola', 'auto', 'metro', 'bus', 'train', 'petrol', 'diesel', 'fuel',
    'cab', 'taxi', 'fare', 'toll', 'parking', 'rapido', 'flight', 'ticket', 'travel',
  ],
  shopping: [
    'amazon', 'flipkart', 'meesho', 'myntra', 'mall', 'clothes', 'shirt', 'shoes',
    'online', 'order', 'purchase', 'buy', 'bought',
  ],
  entertainment: [
    'netflix', 'hotstar', 'prime', 'spotify', 'youtube', 'movie', 'cinema',
    'game', 'pub', 'bar', 'concert', 'match', 'ticket', 'subscription',
  ],
  health: [
    'pharmacy', 'medicine', 'doctor', 'hospital', 'clinic', 'gym', 'yoga',
    'chemist', 'tablet', 'injection', 'test', 'lab', 'health', 'medic',
  ],
};

// Prepositions/filler words to strip from description
const FILLER_WORDS = ['spent', 'on', 'for', 'paid', 'a', 'the', 'an'];

/**
 * Detect category from text tokens.
 * @param {string[]} tokens - lowercase words
 * @returns {string} category name
 */
function detectCategory(tokens) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const token of tokens) {
      if (keywords.includes(token)) {
        return category;
      }
    }
  }
  return 'other';
}

/**
 * Extract a numeric amount from a string.
 * Supports: 80, 80.50, ₹80, ₹80.50, Rs.80
 * @param {string} text
 * @returns {{ amount: number, index: number }|null}
 */
function extractAmount(text) {
  // Match optional currency prefix (₹, Rs., Rs ) and a number
  const regex = /(?:₹|Rs\.?\s*)?(\d+(?:\.\d{1,2})?)/gi;
  let match;
  let best = null;

  while ((match = regex.exec(text)) !== null) {
    const val = parseFloat(match[1]);
    if (val >= 1 && val <= 100000) {
      best = { amount: val, fullMatch: match[0], index: match.index };
      break; // Take the first valid number
    }
  }

  return best;
}

/**
 * Parse an expense message into structured data.
 * @param {string} text - raw message text from user
 * @returns {{ amount: number, category: string, description: string|null, confidence: 'high'|'low' }|null}
 */
function parseExpense(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const amountResult = extractAmount(trimmed);
  if (!amountResult) return null;

  const { amount } = amountResult;

  // Remove the matched amount string and currency symbol from the text
  const withoutAmount = trimmed
    .replace(/₹\s*\d+(?:\.\d{1,2})?/, '')
    .replace(/Rs\.?\s*\d+(?:\.\d{1,2})?/i, '')
    .replace(/\d+(?:\.\d{1,2})?/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Tokenise remaining text
  const rawTokens = withoutAmount
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  // Filter filler words for category detection but keep for description
  const meaningfulTokens = rawTokens.filter((t) => !FILLER_WORDS.includes(t));

  const category = detectCategory(meaningfulTokens);
  const confidence = category !== 'other' ? 'high' : (meaningfulTokens.length > 0 ? 'low' : 'low');

  // Description is the cleaned meaningful tokens joined
  const descriptionTokens = rawTokens.filter((t) => !FILLER_WORDS.includes(t));
  const description = descriptionTokens.length > 0 ? descriptionTokens.join(' ') : null;

  return { amount, category, description, confidence };
}

module.exports = { parseExpense, detectCategory, CATEGORY_KEYWORDS };
