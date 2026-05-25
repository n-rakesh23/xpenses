require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const logger = require('./src/utils/logger');
const authRouter = require('./src/routes/auth');
const expensesRouter = require('./src/routes/expenses');
const dashboardRouter = require('./src/routes/dashboard');
const budgetsRouter = require('./src/routes/budgets');
const exportRouter = require('./src/routes/export');
const adminRouter = require('./src/routes/admin');
const whatsappWebhook = require('./src/webhooks/whatsapp');
const telegramWebhook = require('./src/webhooks/telegram');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:5173',
  credentials: true,
}));

// Parse JSON bodies — but preserve raw body for webhook HMAC verification
app.use((req, res, next) => {
  if (req.path.startsWith('/webhook/whatsapp')) {
    express.raw({ type: 'application/json' })(req, res, (err) => {
      if (err) return next(err);
      if (req.body && Buffer.isBuffer(req.body)) {
        req.rawBody = req.body;
        try {
          req.body = JSON.parse(req.body.toString('utf8'));
        } catch {
          req.body = {};
        }
      }
      next();
    });
  } else {
    express.json()(req, res, next);
  }
});

app.use(cookieParser());

// Traffic counter — increments a per-minute Redis bucket for admin monitoring
const Redis = require('ioredis');
const trafficRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
trafficRedis.on('error', () => {}); // suppress connection errors if Redis unavailable

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhook/')) {
    const bucket = `traffic:${Math.floor(Date.now() / 60000)}`;
    trafficRedis.multi().incr(bucket).expire(bucket, 300).exec().catch(() => {});
  }
  next();
});

app.set('trafficRedis', trafficRedis);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhooks
app.use('/webhook/whatsapp', whatsappWebhook);
app.use('/webhook/telegram', telegramWebhook);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/export', exportRouter);
app.use('/api/admin', adminRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Xpense backend running on port ${PORT}`);
  });
}

module.exports = app;
