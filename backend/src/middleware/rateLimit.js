const { checkRateLimit } = require('../services/state');
const logger = require('../utils/logger');

/**
 * Create a Redis-based per-user rate limiter middleware.
 * @param {object} opts
 * @param {number} opts.limit - maximum requests
 * @param {number} opts.windowSeconds - time window in seconds
 * @param {string} opts.keyPrefix - Redis key prefix
 * @returns {Function} Express middleware
 */
function createRateLimiter({ limit, windowSeconds, keyPrefix }) {
  return async (req, res, next) => {
    try {
      // For webhook routes, use platform_user_id from body; for API routes, use req.user.id
      const userId = req.user?.id || req.body?.userId || req.ip;
      const key = `${keyPrefix}:${userId}`;

      const { allowed, current } = await checkRateLimit(key, limit, windowSeconds);

      res.set('X-RateLimit-Limit', limit);
      res.set('X-RateLimit-Remaining', Math.max(0, limit - current));

      if (!allowed) {
        logger.warn('Rate limit exceeded', { userId, keyPrefix, current });
        return res.status(429).json({
          error: 'Too many requests. Please slow down.',
          retryAfter: windowSeconds,
        });
      }

      next();
    } catch (err) {
      // If Redis is down, fail open (don't block the request)
      logger.error('Rate limiter error — failing open', { message: err.message });
      next();
    }
  };
}

// Webhook: max 20 expense messages per user per hour
const webhookRateLimit = createRateLimiter({
  limit: 20,
  windowSeconds: 3600,
  keyPrefix: 'rl:webhook',
});

// API: max 100 requests per user per 15 minutes
const apiRateLimit = createRateLimiter({
  limit: 100,
  windowSeconds: 900,
  keyPrefix: 'rl:api',
});

module.exports = { webhookRateLimit, apiRateLimit, createRateLimiter };
