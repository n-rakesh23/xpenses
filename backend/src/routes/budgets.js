const express = require('express');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/rateLimit');
const { handleValidationErrors } = require('../middleware/validate');
const {
  getBudgets,
  upsertBudget,
  deleteBudget,
  getMonthlyTotalForCategory,
} = require('../db/queries');

const router = express.Router();
router.use(requireAuth);
router.use(apiRateLimit);

const VALID_CATEGORIES = ['food', 'transport', 'shopping', 'entertainment', 'health', 'other'];

/**
 * GET /api/budgets
 * Returns all budgets for the user, with current month spending.
 */
router.get('/', async (req, res, next) => {
  try {
    const budgets = await getBudgets(req.user.id);

    // Augment with current spending
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (b) => {
        const spent = await getMonthlyTotalForCategory(req.user.id, b.category);
        const limit = parseFloat(b.monthly_limit);
        return {
          ...b,
          monthly_limit: limit,
          spent,
          percentage: limit > 0 ? Math.round((spent / limit) * 100) : 0,
        };
      })
    );

    res.json({ budgets: budgetsWithSpending });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/budgets
 * Create or update a budget.
 */
router.post(
  '/',
  [
    body('category').isIn(VALID_CATEGORIES),
    body('monthly_limit').isFloat({ min: 1 }),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { category, monthly_limit } = req.body;
      const budget = await upsertBudget(req.user.id, category, monthly_limit);
      res.status(201).json({ budget });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/budgets/:category
 * Update a budget limit.
 */
router.put(
  '/:category',
  [
    param('category').isIn(VALID_CATEGORIES),
    body('monthly_limit').isFloat({ min: 1 }),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { category } = req.params;
      const { monthly_limit } = req.body;
      const budget = await upsertBudget(req.user.id, category, monthly_limit);
      res.json({ budget });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/budgets/:category
 */
router.delete(
  '/:category',
  [param('category').isIn(VALID_CATEGORIES), handleValidationErrors],
  async (req, res, next) => {
    try {
      const deleted = await deleteBudget(req.user.id, req.params.category);
      if (!deleted) return res.status(404).json({ error: 'Budget not found.' });
      res.json({ message: 'Budget deleted.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
