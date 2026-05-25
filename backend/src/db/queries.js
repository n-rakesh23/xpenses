const pool = require('./pool');

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * Find or create a user by platform and platform_user_id.
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @param {string} platformUserId
 * @param {object} [defaults] - { phone, name }
 * @returns {Promise<object>} user row
 */
async function upsertUser(platform, platformUserId, defaults = {}) {
  const { rows } = await pool.query(
    `INSERT INTO users (platform, platform_user_id, phone, name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (platform, platform_user_id)
     DO UPDATE SET
       phone = COALESCE(EXCLUDED.phone, users.phone),
       name  = COALESCE(EXCLUDED.name,  users.name)
     RETURNING *`,
    [platform, platformUserId, defaults.phone || null, defaults.name || null]
  );
  return rows[0];
}

/**
 * Find a user by ID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Find a user by platform and platform_user_id.
 * @param {string} platform
 * @param {string} platformUserId
 * @returns {Promise<object|null>}
 */
async function getUserByPlatform(platform, platformUserId) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE platform = $1 AND platform_user_id = $2',
    [platform, platformUserId]
  );
  return rows[0] || null;
}

/**
 * Find a user by phone number.
 * @param {string} phone
 * @returns {Promise<object|null>}
 */
async function getUserByPhone(phone) {
  const { rows } = await pool.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [phone]);
  return rows[0] || null;
}

/**
 * Update user plan.
 * @param {string} userId
 * @param {string} plan - 'free' | 'pro'
 * @param {Date|null} expiresAt
 * @returns {Promise<object>}
 */
async function updateUserPlan(userId, plan, expiresAt) {
  const { rows } = await pool.query(
    'UPDATE users SET plan = $2, plan_expires_at = $3 WHERE id = $1 RETURNING *',
    [userId, plan, expiresAt]
  );
  return rows[0];
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

/**
 * Create a new session.
 * @param {string} userId
 * @param {string} tokenHash - SHA-256 hash of the session token
 * @returns {Promise<object>}
 */
async function createSession(userId, tokenHash) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, token_hash)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, tokenHash]
  );
  return rows[0];
}

/**
 * Find a valid (non-expired) session by token hash.
 * @param {string} tokenHash
 * @returns {Promise<object|null>}
 */
async function getSessionByTokenHash(tokenHash) {
  const { rows } = await pool.query(
    `SELECT s.*, u.id as user_id, u.platform, u.platform_user_id, u.phone, u.name, u.plan, u.plan_expires_at
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
}

/**
 * Delete a session by token hash.
 * @param {string} tokenHash
 * @returns {Promise<void>}
 */
async function deleteSession(tokenHash) {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

/**
 * Delete all sessions for a user.
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteUserSessions(userId) {
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

/**
 * Create a new expense.
 * @param {string} userId
 * @param {object} data - { amount, category, description, note, messageId, platform }
 * @returns {Promise<object>}
 */
async function createExpense(userId, data) {
  const { rows } = await pool.query(
    `INSERT INTO expenses (user_id, amount, category, description, note, message_id, platform)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      data.amount,
      data.category,
      data.description || null,
      data.note || null,
      data.messageId || null,
      data.platform || null,
    ]
  );
  return rows[0];
}

/**
 * Get a single expense by ID, scoped to the user.
 * @param {string} userId
 * @param {string} expenseId
 * @returns {Promise<object|null>}
 */
async function getExpenseById(userId, expenseId) {
  const { rows } = await pool.query(
    'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
    [expenseId, userId]
  );
  return rows[0] || null;
}

/**
 * Get expenses for a user with period filtering and pagination.
 * @param {string} userId
 * @param {object} opts - { period, page, limit }
 * @returns {Promise<object[]>}
 */
async function getExpenses(userId, opts = {}) {
  const { period = 'monthly', page = 1, limit = 50 } = opts;
  const offset = (page - 1) * limit;

  let interval;
  if (period === 'daily') interval = '1 day';
  else if (period === 'weekly') interval = '7 days';
  else interval = '30 days';

  const { rows } = await pool.query(
    `SELECT * FROM expenses
     WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '${interval}'
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

/**
 * Get all expenses for a user (no date filter) — used for exports.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function getAllExpenses(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM expenses WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

/**
 * Update an expense.
 * @param {string} userId
 * @param {string} expenseId
 * @param {object} data - { note?, category?, amount?, receipt_url? }
 * @returns {Promise<object|null>}
 */
async function updateExpense(userId, expenseId, data) {
  const fields = [];
  const values = [userId, expenseId];
  let idx = 3;

  if (data.note !== undefined) { fields.push(`note = $${idx++}`); values.push(data.note); }
  if (data.category !== undefined) { fields.push(`category = $${idx++}`); values.push(data.category); }
  if (data.amount !== undefined) { fields.push(`amount = $${idx++}`); values.push(data.amount); }
  if (data.receipt_url !== undefined) { fields.push(`receipt_url = $${idx++}`); values.push(data.receipt_url); }

  if (fields.length === 0) return null;

  const { rows } = await pool.query(
    `UPDATE expenses SET ${fields.join(', ')}
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

/**
 * Delete an expense.
 * @param {string} userId
 * @param {string} expenseId
 * @returns {Promise<boolean>}
 */
async function deleteExpense(userId, expenseId) {
  const { rowCount } = await pool.query(
    'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
    [expenseId, userId]
  );
  return rowCount > 0;
}

/**
 * Get daily totals for a calendar month.
 * @param {string} userId
 * @param {number} year
 * @param {number} month - 1-based
 * @returns {Promise<object>} - { "2024-01-15": 450, ... }
 */
async function getCalendarData(userId, year, month) {
  const { rows } = await pool.query(
    `SELECT
       TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
       SUM(amount) AS total
     FROM expenses
     WHERE user_id = $1
       AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata') = $2
       AND EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata') = $3
     GROUP BY day
     ORDER BY day`,
    [userId, year, month]
  );
  const result = {};
  for (const row of rows) {
    result[row.day] = parseFloat(row.total);
  }
  return result;
}

/**
 * Get category totals for a period.
 * @param {string} userId
 * @param {string} period - 'daily' | 'weekly' | 'monthly'
 * @returns {Promise<object>} - { food: 1200, transport: 800, ... }
 */
async function getCategoryTotals(userId, period = 'monthly') {
  let interval;
  if (period === 'daily') interval = '1 day';
  else if (period === 'weekly') interval = '7 days';
  else interval = '30 days';

  const { rows } = await pool.query(
    `SELECT category, SUM(amount) AS total
     FROM expenses
     WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '${interval}'
     GROUP BY category`,
    [userId]
  );
  const result = {};
  for (const row of rows) {
    result[row.category] = parseFloat(row.total);
  }
  return result;
}

/**
 * Check if an expense with the given message_id already exists (idempotency).
 * @param {string} messageId
 * @returns {Promise<boolean>}
 */
async function expenseExistsByMessageId(messageId) {
  const { rows } = await pool.query(
    'SELECT id FROM expenses WHERE message_id = $1 LIMIT 1',
    [messageId]
  );
  return rows.length > 0;
}

/**
 * Get the last expense for a user.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getLastExpense(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM expenses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

/**
 * Get dashboard stats for a user.
 * @param {string} userId
 * @param {string} period
 * @returns {Promise<object>}
 */
async function getDashboardStats(userId, period = 'monthly') {
  let interval;
  if (period === 'daily') interval = '1 day';
  else if (period === 'weekly') interval = '7 days';
  else interval = '30 days';

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(amount), 0) AS total,
       COALESCE(AVG(amount), 0) AS avg,
       COUNT(*) AS count,
       (SELECT category FROM expenses
        WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY category ORDER BY SUM(amount) DESC LIMIT 1) AS top_category
     FROM expenses
     WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '${interval}'`,
    [userId]
  );
  return rows[0];
}

/**
 * Get daily spending totals for a period (for chart).
 * @param {string} userId
 * @param {string} period
 * @returns {Promise<object[]>}
 */
async function getDashboardSummary(userId, period = 'monthly') {
  let interval, groupBy;
  if (period === 'daily') {
    interval = '1 day';
    groupBy = `TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'HH24:00')`;
  } else if (period === 'weekly') {
    interval = '7 days';
    groupBy = `TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`;
  } else {
    interval = '30 days';
    groupBy = `TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`;
  }

  const { rows } = await pool.query(
    `SELECT
       ${groupBy} AS label,
       SUM(amount) AS total
     FROM expenses
     WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '${interval}'
     GROUP BY label
     ORDER BY label`,
    [userId]
  );
  return rows;
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

/**
 * Get all budgets for a user.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function getBudgets(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM budgets WHERE user_id = $1 ORDER BY category',
    [userId]
  );
  return rows;
}

/**
 * Get a budget for a specific category.
 * @param {string} userId
 * @param {string} category
 * @returns {Promise<object|null>}
 */
async function getBudgetByCategory(userId, category) {
  const { rows } = await pool.query(
    'SELECT * FROM budgets WHERE user_id = $1 AND category = $2',
    [userId, category]
  );
  return rows[0] || null;
}

/**
 * Create or update a budget.
 * @param {string} userId
 * @param {string} category
 * @param {number} monthlyLimit
 * @returns {Promise<object>}
 */
async function upsertBudget(userId, category, monthlyLimit) {
  const { rows } = await pool.query(
    `INSERT INTO budgets (user_id, category, monthly_limit)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, category)
     DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit
     RETURNING *`,
    [userId, category, monthlyLimit]
  );
  return rows[0];
}

/**
 * Delete a budget.
 * @param {string} userId
 * @param {string} category
 * @returns {Promise<boolean>}
 */
async function deleteBudget(userId, category) {
  const { rowCount } = await pool.query(
    'DELETE FROM budgets WHERE user_id = $1 AND category = $2',
    [userId, category]
  );
  return rowCount > 0;
}

/**
 * Get monthly total for a specific category (for budget alert).
 * @param {string} userId
 * @param {string} category
 * @returns {Promise<number>}
 */
async function getMonthlyTotalForCategory(userId, category) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE user_id = $1
       AND category = $2
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`,
    [userId, category]
  );
  return parseFloat(rows[0].total);
}

// ─── Conversation State ───────────────────────────────────────────────────────

/**
 * Get conversation state for a user.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getConversationState(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM conversation_state WHERE user_id = $1 AND expires_at > NOW()',
    [userId]
  );
  return rows[0] || null;
}

/**
 * Set conversation state for a user.
 * @param {string} userId
 * @param {string} state
 * @param {object} [extras] - { pendingCategory, pendingExpenseId, context }
 * @returns {Promise<object>}
 */
async function setConversationState(userId, state, extras = {}) {
  const { rows } = await pool.query(
    `INSERT INTO conversation_state (user_id, state, pending_category, pending_expense_id, context, updated_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '10 minutes')
     ON CONFLICT (user_id) DO UPDATE SET
       state              = EXCLUDED.state,
       pending_category   = EXCLUDED.pending_category,
       pending_expense_id = EXCLUDED.pending_expense_id,
       context            = EXCLUDED.context,
       updated_at         = NOW(),
       expires_at         = NOW() + INTERVAL '10 minutes'
     RETURNING *`,
    [
      userId,
      state,
      extras.pendingCategory || null,
      extras.pendingExpenseId || null,
      extras.context ? JSON.stringify(extras.context) : null,
    ]
  );
  return rows[0];
}

/**
 * Clear conversation state for a user.
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function clearConversationState(userId) {
  await pool.query('DELETE FROM conversation_state WHERE user_id = $1', [userId]);
}

module.exports = {
  // Users
  upsertUser,
  getUserById,
  getUserByPlatform,
  getUserByPhone,
  updateUserPlan,
  // Sessions
  createSession,
  getSessionByTokenHash,
  deleteSession,
  deleteUserSessions,
  // Expenses
  createExpense,
  getExpenseById,
  getExpenses,
  getAllExpenses,
  updateExpense,
  deleteExpense,
  getCalendarData,
  getCategoryTotals,
  expenseExistsByMessageId,
  getLastExpense,
  // Dashboard
  getDashboardStats,
  getDashboardSummary,
  // Budgets
  getBudgets,
  getBudgetByCategory,
  upsertBudget,
  deleteBudget,
  getMonthlyTotalForCategory,
  // Conversation state
  getConversationState,
  setConversationState,
  clearConversationState,
};
