const express = require('express');
const PDFDocument = require('pdfkit');
const { requireAuth } = require('../middleware/auth');
const { requirePro } = require('../middleware/plan');
const { apiRateLimit } = require('../middleware/rateLimit');
const { getAllExpenses } = require('../db/queries');
const { formatCurrency, formatDateTime } = require('../utils/format');

const router = express.Router();
router.use(requireAuth);
router.use(requirePro);
router.use(apiRateLimit);

/**
 * GET /api/export/csv
 * Download all expenses as a CSV file.
 */
router.get('/csv', async (req, res, next) => {
  try {
    const expenses = await getAllExpenses(req.user.id);

    const headers = ['Date', 'Amount (INR)', 'Category', 'Description', 'Note', 'Platform'];
    const rows = expenses.map((e) => [
      formatDateTime(e.created_at),
      parseFloat(e.amount).toFixed(2),
      e.category,
      e.description || '',
      e.note || '',
      e.platform || '',
    ]);

    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="xpense-export-${Date.now()}.csv"`
    );
    res.send(csvLines.join('\r\n'));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/export/pdf
 * Download all expenses as a PDF file.
 */
router.get('/pdf', async (req, res, next) => {
  try {
    const expenses = await getAllExpenses(req.user.id);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="xpense-export-${Date.now()}.pdf"`
    );
    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor('#1D9E75').text('Xpense', 50, 50);
    doc
      .fontSize(12)
      .fillColor('#666')
      .text(`Expense Report — ${req.user.name || 'User'}`, 50, 78);
    doc.moveDown();

    // Total summary
    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    doc.fontSize(14).fillColor('#111').text(`Total Expenses: ${formatCurrency(total)}`);
    doc.fontSize(11).fillColor('#666').text(`${expenses.length} transactions`);
    doc.moveDown();

    // Table header
    const tableTop = doc.y + 10;
    const colX = { date: 50, amount: 200, category: 310, description: 390 };

    doc
      .fontSize(10)
      .fillColor('#fff')
      .rect(50, tableTop, 500, 20)
      .fill('#1D9E75');

    doc
      .fillColor('#fff')
      .text('Date', colX.date, tableTop + 5)
      .text('Amount', colX.amount, tableTop + 5)
      .text('Category', colX.category, tableTop + 5)
      .text('Description', colX.description, tableTop + 5);

    let y = tableTop + 25;

    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const rowBg = i % 2 === 0 ? '#f9f9f9' : '#fff';

      if (y > 720) {
        doc.addPage();
        y = 50;
      }

      doc.rect(50, y - 3, 500, 18).fill(rowBg);
      doc
        .fillColor('#222')
        .fontSize(9)
        .text(formatDateTime(e.created_at).substring(0, 15), colX.date, y)
        .text(formatCurrency(parseFloat(e.amount)), colX.amount, y)
        .text(e.category, colX.category, y)
        .text((e.description || '—').substring(0, 30), colX.description, y);

      y += 18;
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
