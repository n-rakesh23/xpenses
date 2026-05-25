const express = require('express');
const { body, query, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/rateLimit');
const { handleValidationErrors } = require('../middleware/validate');
const {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getCalendarData,
  getCategoryTotals,
} = require('../db/queries');
const logger = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);
router.use(apiRateLimit);

const VALID_CATEGORIES = ['food', 'transport', 'shopping', 'entertainment', 'health', 'other'];
const VALID_PERIODS = ['daily', 'weekly', 'monthly'];

/**
 * GET /api/expenses
 * List expenses with period and pagination.
 */
router.get(
  '/',
  [
    query('period').optional().isIn(VALID_PERIODS),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { period = 'monthly', page = 1, limit = 50 } = req.query;
      const expenses = await getExpenses(req.user.id, { period, page, limit });
      res.json({ expenses, page, limit });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/expenses/calendar
 * Returns daily totals for a month.
 */
router.get(
  '/calendar',
  [
    query('year').isInt({ min: 2020, max: 2100 }).toInt(),
    query('month').isInt({ min: 1, max: 12 }).toInt(),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { year, month } = req.query;
      const data = await getCalendarData(req.user.id, year, month);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/expenses/categories
 * Returns totals per category for a period.
 */
router.get(
  '/categories',
  [
    query('period').optional().isIn(VALID_PERIODS),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { period = 'monthly' } = req.query;
      const totals = await getCategoryTotals(req.user.id, period);
      res.json(totals);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/expenses/:id
 * Get a single expense.
 */
router.get(
  '/:id',
  [param('id').isUUID(), handleValidationErrors],
  async (req, res, next) => {
    try {
      const expense = await getExpenseById(req.user.id, req.params.id);
      if (!expense) return res.status(404).json({ error: 'Expense not found.' });
      res.json({ expense });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/expenses
 * Create an expense.
 */
router.post(
  '/',
  [
    body('amount').isFloat({ min: 0.01, max: 100000 }),
    body('category').isIn(VALID_CATEGORIES),
    body('description').optional().isString().trim().isLength({ max: 200 }),
    body('note').optional().isString().trim().isLength({ max: 500 }),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { amount, category, description, note } = req.body;
      const expense = await createExpense(req.user.id, {
        amount,
        category,
        description,
        note,
        platform: req.user.platform,
      });
      logger.info('Expense created via API', { userId: req.user.id, expenseId: expense.id });
      res.status(201).json({ expense });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/expenses/:id
 * Update an expense (note, category, amount).
 */
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('note').optional().isString().trim().isLength({ max: 500 }),
    body('category').optional().isIn(VALID_CATEGORIES),
    body('amount').optional().isFloat({ min: 0.01, max: 100000 }),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { note, category, amount } = req.body;
      const updated = await updateExpense(req.user.id, req.params.id, { note, category, amount });
      if (!updated) return res.status(404).json({ error: 'Expense not found.' });
      res.json({ expense: updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/expenses/:id
 */
router.delete(
  '/:id',
  [param('id').isUUID(), handleValidationErrors],
  async (req, res, next) => {
    try {
      const deleted = await deleteExpense(req.user.id, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Expense not found.' });
      logger.info('Expense deleted', { userId: req.user.id, expenseId: req.params.id });
      res.json({ message: 'Expense deleted.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
