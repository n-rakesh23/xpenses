const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/adminAuth');
const logger = require('../utils/logger');

const router = express.Router();

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * POST /admin/auth/login
 * body: { username, password }
 */
router.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { role: 'admin', username },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// ─── Overview Stats ───────────────────────────────────────────────────────────

/**
 * GET /admin/stats
 */
router.get('/stats', requireAdmin, async (req, res, next) => {
  try {
    const [usersRes, expensesRes, revenueRes, platformRes, signupsRes, activeRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                        AS total,
          COUNT(*) FILTER (WHERE plan = 'pro')           AS pro,
          COUNT(*) FILTER (WHERE plan = 'free')          AS free,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_this_week
        FROM users
      `),
      pool.query(`
        SELECT
          COUNT(*)                                             AS total,
          COALESCE(SUM(amount), 0)                            AS total_amount,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS this_month
        FROM expenses
      `),
      pool.query(`
        SELECT COUNT(*) * 199 AS monthly_revenue
        FROM users
        WHERE plan = 'pro'
          AND (plan_expires_at IS NULL OR plan_expires_at > NOW())
      `),
      pool.query(`
        SELECT platform, COUNT(*) AS count
        FROM users
        GROUP BY platform
      `),
      pool.query(`
        SELECT DATE_TRUNC('day', created_at)::date AS date, COUNT(*) AS count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT COUNT(DISTINCT user_id) AS active_24h
        FROM expenses
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `),
    ]);

    // Sum last 5 minute buckets from Redis for live traffic
    const trafficRedis = req.app.get('trafficRedis');
    let trafficNow = 0;
    try {
      const now = Math.floor(Date.now() / 60000);
      const keys = Array.from({ length: 5 }, (_, i) => `traffic:${now - i}`);
      const counts = await trafficRedis.mget(...keys);
      trafficNow = counts.reduce((sum, v) => sum + (parseInt(v) || 0), 0);
    } catch { /* Redis unavailable — leave at 0 */ }

    const platformMap = {};
    platformRes.rows.forEach((r) => { platformMap[r.platform] = parseInt(r.count); });

    res.json({
      users: {
        total: parseInt(usersRes.rows[0].total),
        pro: parseInt(usersRes.rows[0].pro),
        free: parseInt(usersRes.rows[0].free),
        newThisWeek: parseInt(usersRes.rows[0].new_this_week),
        active24h: parseInt(activeRes.rows[0].active_24h),
      },
      traffic: { last5Min: trafficNow },
      expenses: {
        total: parseInt(expensesRes.rows[0].total),
        totalAmount: parseFloat(expensesRes.rows[0].total_amount),
        thisMonth: parseInt(expensesRes.rows[0].this_month),
      },
      revenue: {
        monthly: parseInt(revenueRes.rows[0].monthly_revenue),
      },
      platforms: platformMap,
      signupTrend: signupsRes.rows.map((r) => ({
        date: r.date,
        count: parseInt(r.count),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * GET /admin/users?page=1&limit=20&search=&plan=&platform=
 */
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;
    const plan = req.query.plan || null;
    const platform = req.query.platform || null;

    const params = [];
    const conditions = [];

    if (search) {
      params.push(search);
      conditions.push(`(u.name ILIKE $${params.length} OR u.phone ILIKE $${params.length})`);
    }
    if (plan) {
      params.push(plan);
      conditions.push(`u.plan = $${params.length}`);
    }
    if (platform) {
      params.push(platform);
      conditions.push(`u.platform = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT
         u.id, u.name, u.phone, u.platform, u.plan,
         u.plan_expires_at, u.created_at,
         COUNT(e.id)::int          AS expense_count,
         COALESCE(SUM(e.amount),0) AS total_spent,
         MAX(e.created_at)         AS last_active
       FROM users u
       LEFT JOIN expenses e ON e.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM users u ${where}`,
      countParams
    );

    res.json({
      users: rows,
      total: parseInt(countRows[0].count),
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/users/:id
 */
router.get('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         u.*,
         COUNT(e.id)::int          AS expense_count,
         COALESCE(SUM(e.amount),0) AS total_spent,
         MAX(e.created_at)         AS last_active
       FROM users u
       LEFT JOIN expenses e ON e.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const { rows: expenses } = await pool.query(
      `SELECT * FROM expenses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );

    res.json({ user: rows[0], recentExpenses: expenses });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /admin/users/:id
 * body: { plan, plan_expires_at }
 */
router.patch('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const { plan, plan_expires_at } = req.body;
    const allowed = ['free', 'pro'];

    if (plan && !allowed.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET plan = COALESCE($1, plan),
           plan_expires_at = COALESCE($2::timestamptz, plan_expires_at)
       WHERE id = $3
       RETURNING id, name, plan, plan_expires_at`,
      [plan || null, plan_expires_at || null, req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    logger.info('Admin updated user plan', { userId: req.params.id, plan });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /admin/users/:id
 */
router.delete('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    logger.warn('Admin deleted user', { userId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Expenses (all users) ─────────────────────────────────────────────────────

/**
 * GET /admin/expenses?page=1&limit=50&category=&platform=
 */
router.get('/expenses', requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT e.*, u.name AS user_name, u.platform AS user_platform
       FROM expenses e
       JOIN users u ON u.id = e.user_id
       ORDER BY e.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM expenses');

    res.json({
      expenses: rows,
      total: parseInt(countRows[0].count),
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
