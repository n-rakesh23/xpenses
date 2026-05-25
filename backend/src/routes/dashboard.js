const express = require('express');
const { query } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/rateLimit');
const { handleValidationErrors } = require('../middleware/validate');
const { getDashboardStats, getDashboardSummary } = require('../db/queries');

const router = express.Router();
router.use(requireAuth);
router.use(apiRateLimit);

const VALID_PERIODS = ['daily', 'weekly', 'monthly'];

/**
 * GET /api/dashboard/stats
 * Returns total, avg, top category, count for the period.
 */
router.get(
  '/stats',
  [
    query('period').optional().isIn(VALID_PERIODS),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { period = 'monthly' } = req.query;
      const stats = await getDashboardStats(req.user.id, period);

      res.json({
        total: parseFloat(stats.total) || 0,
        avg: parseFloat(stats.avg) || 0,
        count: parseInt(stats.count, 10) || 0,
        topCategory: stats.top_category || null,
        streak: 0, // Placeholder; real streak calculation would require separate query
        platform: req.user.platform,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/dashboard/summary
 * Returns chart data (label + total per day/hour) for the period.
 */
router.get(
  '/summary',
  [
    query('period').optional().isIn(VALID_PERIODS),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { period = 'monthly' } = req.query;
      const rows = await getDashboardSummary(req.user.id, period);
      res.json({
        labels: rows.map((r) => r.label),
        data: rows.map((r) => parseFloat(r.total)),
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
