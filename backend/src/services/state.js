const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    redis.on('error', (err) => {
      logger.error('Redis error in state service', { message: err.message });
    });
  }
  return redis;
}

const STATE_TTL_SECONDS = 600; // 10 minutes

/**
 * Get the conversation state for a user.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getState(userId) {
  const r = getRedis();
  const raw = await r.get(`state:${userId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Set the conversation state for a user (TTL: 10 minutes).
 * @param {string} userId
 * @param {string} state - state name
 * @param {object} [extras] - { pendingCategory, pendingExpenseId, context }
 * @returns {Promise<void>}
 */
async function setState(userId, state, extras = {}) {
  const r = getRedis();
  const data = {
    state,
    pendingCategory: extras.pendingCategory || null,
    pendingExpenseId: extras.pendingExpenseId || null,
    context: extras.context || null,
    updatedAt: new Date().toISOString(),
  };
  await r.setex(`state:${userId}`, STATE_TTL_SECONDS, JSON.stringify(data));
}

/**
 * Clear the conversation state for a user.
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function clearState(userId) {
  const r = getRedis();
  await r.del(`state:${userId}`);
}

/**
 * Check and set a rate-limit counter.
 * @param {string} key - Redis key
 * @param {number} limit - max requests
 * @param {number} windowSeconds - time window in seconds
 * @returns {Promise<{ allowed: boolean, current: number }>}
 */
async function checkRateLimit(key, limit, windowSeconds) {
  const r = getRedis();
  const current = await r.incr(key);
  if (current === 1) {
    await r.expire(key, windowSeconds);
  }
  return { allowed: current <= limit, current };
}

/**
 * Get a Redis key's value.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function get(key) {
  return getRedis().get(key);
}

/**
 * Set a Redis key with optional TTL.
 * @param {string} key
 * @param {string} value
 * @param {number} [ttlSeconds]
 * @returns {Promise<void>}
 */
async function set(key, value, ttlSeconds) {
  const r = getRedis();
  if (ttlSeconds) {
    await r.setex(key, ttlSeconds, value);
  } else {
    await r.set(key, value);
  }
}

module.exports = { getState, setState, clearState, checkRateLimit, get, set };
